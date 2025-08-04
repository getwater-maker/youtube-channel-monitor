import { isLongform, calculateMutantIndex } from './utils.js';
import { loadApiKeys, fetchYoutubeApi } from './api_keys.js';

let myChannels = [];

// DOM 요소
const myChannelCountText = document.getElementById('my-channel-count-text');
const addMyChannelButton = document.getElementById('add-my-channel-button');
const myChannelListContainer = document.getElementById('my-channel-list-container');
const myMutantVideosContainer = document.getElementById('my-channel-mutant-videos-container');

// 내채널관리 전용 검색 결과 모달 및 결과
let myChannelSelectModal, myChannelSearchResults;
document.addEventListener('DOMContentLoaded', () => {
    // 모달 생성(없으면 자동 생성)
    if (!document.getElementById('my-channel-select-modal')) {
        const modal = document.createElement('div');
        modal.id = "my-channel-select-modal";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-button my-channel-select-close">×</span>
                <h2>검색 결과</h2>
                <p>추가할 채널을 선택하세요.</p>
                <div id="my-channel-search-results"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    myChannelSelectModal = document.getElementById('my-channel-select-modal');
    myChannelSearchResults = document.getElementById('my-channel-search-results');

    loadMyChannels();
    updateMyChannelUI();
    addMyChannelButton.addEventListener('click', handleAddMyChannel);

    // 모달 닫기
    document.querySelector('.my-channel-select-close').onclick = () => {
        myChannelSelectModal.style.display = 'none';
    };
    window.addEventListener('click', (event) => {
        if (event.target === myChannelSelectModal) myChannelSelectModal.style.display = 'none';
    });
});

// 1. 내 채널 로드
function loadMyChannels() {
    const data = localStorage.getItem('myChannels');
    myChannels = data ? JSON.parse(data) : [];
}

// 2. 내 채널 저장
function saveMyChannels() {
    localStorage.setItem('myChannels', JSON.stringify(myChannels));
}

// 3. UI 전체 업데이트 (기존과 동일)

async function updateMyChannelUI() {
    myChannelCountText.textContent = `현재 ${myChannels.length}개의 채널이 등록되었습니다.`;
    myChannelListContainer.innerHTML = '';
    if (myChannels.length === 0) {
        myChannelListContainer.innerHTML = '<p>채널을 추가해주세요.</p>';
    } else {
        const grid = document.createElement('div');
        grid.className = 'my-mutant-videos-grid';
        for (const channel of myChannels) {
            const channelCard = document.createElement('div');
            channelCard.className = 'my-channel-card';
            channelCard.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${channel.logo || ''}" alt="채널로고" style="width:40px; height:40px; border-radius:50%;">
                    <span style="font-weight:bold;">${channel.name}</span>
                    <button class="my-delete-channel-btn" data-id="${channel.id}" style="margin-left:auto;">삭제</button>
                </div>
                <div style="font-size:13px; color:#555; margin-top:4px;">
                    구독자: <span>${Number(channel.subscriberCount).toLocaleString()}</span>명
                </div>
            `;
            grid.appendChild(channelCard);
        }
        myChannelListContainer.appendChild(grid);

        document.querySelectorAll('.my-delete-channel-btn').forEach(btn => {
            btn.onclick = function() {
                if (confirm('정말 이 채널을 삭제하시겠습니까?')) {
                    myChannels = myChannels.filter(ch => ch.id !== this.dataset.id);
                    saveMyChannels();
                    updateMyChannelUI();
                }
            }
        });
    }
    updateMyMutantVideosSection();
}

// 4. 채널 추가 핸들러 (검색결과 100개까지)
async function handleAddMyChannel() {
    const name = prompt('추가할 내 채널명을 입력하세요:');
    if (!name) return;

    // YouTube API - 최대 100개까지 반복 요청하여 통합
    let items = [];
    let nextPageToken = null;
    let tried = 0;
    do {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(name)}&type=channel&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const data = await fetchYoutubeApi(url);
        if (data.items) items.push(...data.items);
        nextPageToken = data.nextPageToken;
        tried += (data.items ? data.items.length : 0);
    } while (nextPageToken && tried < 100);

    if (items.length === 0) {
        alert('채널을 찾을 수 없습니다.');
        return;
    }

    displayMyChannelSearchResults(items);
}

// 5. 검색결과 모달 표시 & 선택시 추가
function displayMyChannelSearchResults(results) {
    myChannelSearchResults.innerHTML = '';
    results.forEach(item => {
        const channelId = item.id.channelId;
        const channelTitle = item.snippet.title;
        const channelLogo = item.snippet.thumbnails.default.url;

        // 중복 체크(이미 등록된 채널은 선택불가 표시)
        const alreadyAdded = myChannels.some(c => c.id === channelId);
        const channelEl = document.createElement('div');
        channelEl.classList.add('channel-item');
        channelEl.innerHTML = `
            <div class="channel-info-wrapper" style="display:flex; align-items:center; gap:10px; cursor:${alreadyAdded ? 'not-allowed' : 'pointer'};">
                <img src="${channelLogo}" alt="${channelTitle} 로고" style="width: 40px; height: 40px; border-radius: 50%;">
                <span>${channelTitle}</span>
                ${alreadyAdded ? '<span style="color:#aaa; font-size:13px; margin-left:8px;">(등록됨)</span>' : ''}
            </div>
        `;
        if (!alreadyAdded) {
            channelEl.onclick = () => {
                addMyChannelFromResult(channelId);
                myChannelSelectModal.style.display = 'none';
            }
        }
        myChannelSearchResults.appendChild(channelEl);
    });

    myChannelSelectModal.style.display = 'block';
}

// 6. 채널 상세정보 불러와서 등록
async function addMyChannelFromResult(channelId) {
    // 중복방지
    if (myChannels.some(c => c.id === channelId)) {
        alert('이미 등록된 채널입니다.');
        return;
    }
    try {
        const detailUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
        const detailData = await fetchYoutubeApi(detailUrl);
        const detailItem = detailData.items[0];

        const channel = {
            id: channelId,
            name: detailItem.snippet.title,
            logo: detailItem.snippet.thumbnails.default.url,
            subscriberCount: detailItem.statistics.subscriberCount,
            uploadsPlaylistId: detailItem.contentDetails.relatedPlaylists.uploads
        };

        myChannels.push(channel);
        saveMyChannels();
        updateMyChannelUI();
    } catch (e) {
        alert('채널 추가 중 오류가 발생했습니다.');
    }
}

// 7. 채널별 돌연변이 TOP3 영상 (동일)
async function updateMyMutantVideosSection() {
    myMutantVideosContainer.innerHTML = '';
    if (myChannels.length === 0) {
        myMutantVideosContainer.innerHTML = '<p>채널을 추가해주세요.</p>';
        return;
    }
    const grid = document.createElement('div');
    grid.className = 'my-mutant-videos-grid';

    for (const channel of myChannels) {
        const videos = await getMutantTop3Videos(channel);
        const card = document.createElement('div');
        card.className = 'my-mutant-card';
        card.innerHTML = `
            <div style="font-weight:bold; margin-bottom:6px;">${channel.name}</div>
            <div>
                ${videos.length === 0 ? '<div style="color:#aaa;">돌연변이 영상 없음</div>' : videos.map(video => `
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                        <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">
                            <img src="${video.thumbnail}" alt="썸네일" style="width:60px; height:34px; border-radius:6px;">
                        </a>
                        <div>
                            <div style="font-size:13px; font-weight:bold;">${video.title}</div>
                            <div style="font-size:12px; color:#888;">
                                <span style="background:#c4302b; color:#fff; border-radius:7px; padding:2px 8px; margin-left:5px;">${video.mutantIndex}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        grid.appendChild(card);
    }
    myMutantVideosContainer.appendChild(grid);
}

// 8. 채널별 돌연변이 TOP3 영상 가져오기
async function getMutantTop3Videos(channel) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${channel.uploadsPlaylistId}&maxResults=50`;
    const data = await fetchYoutubeApi(url);
    const items = data.items || [];
    const videoIds = items.map(i => i.contentDetails.videoId);

    if (!videoIds.length) return [];
    const videoDetailUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.slice(0, 50).join(',')}`;
    const videoData = await fetchYoutubeApi(videoDetailUrl);
    const videos = (videoData.items || []).map(item => {
        const thumbnails = item.snippet.thumbnails;
        let thumbnail =
            (thumbnails.medium && thumbnails.medium.url) ||
            (thumbnails.high && thumbnails.high.url) ||
            (thumbnails.default && thumbnails.default.url) ||
            `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`;
        const mutantIndex = calculateMutantIndex(item.statistics.viewCount, channel.subscriberCount);
        return {
            id: item.id,
            title: item.snippet.title,
            thumbnail,
            viewCount: item.statistics.viewCount,
            duration: item.contentDetails.duration,
            mutantIndex
        };
    });

    const mutantVideos = videos
        .filter(video => parseFloat(video.mutantIndex) >= 2.0 && isLongform(video.duration))
        .sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex))
        .slice(0, 3);

    return mutantVideos;
}
