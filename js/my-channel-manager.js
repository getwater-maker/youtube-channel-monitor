// js/my-channel-manager.js
import { fetchYoutubeApi, loadApiKeys, saveApiKeys } from './api_keys.js';
import { isLongform, calculateMutantIndex } from './utils.js';

let myChannels = [];
let myChannelSearchResults = [];
let myCurrentSearchPage = 1;
const perPage = 5;
let mySearchKeyword = "";
let myIsTracking = false;

// DOM 캐싱
const myChannelCount = document.getElementById('my-channel-count');
const myChannelList = document.getElementById('my-channel-list');
const myAddChannelBtn = document.getElementById('my-add-channel-btn');
const myTrackBtn = document.getElementById('my-track-btn');
const myChannelSearchModal = document.getElementById('my-channel-search-modal');
const myChannelSearchResultsDiv = document.getElementById('my-channel-search-results');
const myPagination = document.getElementById('my-pagination');

// 페이지 로딩
document.addEventListener('DOMContentLoaded', () => {
    loadMyChannels();
    renderMyChannelList();
    myAddChannelBtn.addEventListener('click', onClickAddChannel);
    myTrackBtn.addEventListener('click', startTracking);

    // 탭 전환
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.dataset.tab === 'channel-monitor') {
                window.location.href = 'index.html';
            }
        });
    });

    // 검색 모달 닫기
    myChannelSearchModal.querySelector('.close-button').onclick = () => {
        myChannelSearchModal.style.display = 'none';
    };

    window.onclick = function(event) {
        if (event.target === myChannelSearchModal) {
            myChannelSearchModal.style.display = 'none';
        }
    };
});

function loadMyChannels() {
    const saved = localStorage.getItem('myChannels');
    if (saved) myChannels = JSON.parse(saved);
    else myChannels = [];
    myChannelCount.textContent = myChannels.length;
}

function saveMyChannels() {
    localStorage.setItem('myChannels', JSON.stringify(myChannels));
    myChannelCount.textContent = myChannels.length;
}

// 채널 리스트 렌더링
function renderMyChannelList() {
    myChannelList.innerHTML = '';
    if (!myIsTracking) {
        myChannelList.innerHTML = `<div style="text-align:center; margin:32px 0 0 0;">채널 추적을 시작하려면 '추적시작' 버튼을 클릭하세요.</div>`;
        return;
    }
    if (myChannels.length === 0) {
        myChannelList.innerHTML = `<div style="text-align:center; margin:32px 0 0 0;">추적 중인 채널이 없습니다.</div>`;
        return;
    }
    // 한 줄에 3개씩 가로 배치
    const rowWrap = document.createElement('div');
    rowWrap.className = 'my-channel-row-wrap';
    for (let i = 0; i < myChannels.length; i += 3) {
        const row = document.createElement('div');
        row.className = 'my-channel-row';
        myChannels.slice(i, i + 3).forEach(channel => {
            row.appendChild(createMyChannelCard(channel));
        });
        rowWrap.appendChild(row);
    }
    myChannelList.appendChild(rowWrap);
}

function createMyChannelCard(channel) {
    // 안전한 값 처리 (undefined/null 방지)
    const today = channel.today || {};
    const yesterday = channel.yesterday || {};

    // 구독자, 조회수, 시청시간
    const subscribersToday = (today.subscribers ?? 0);
    const subscribersYest = (yesterday.subscribers ?? 0);
    const viewsToday = (today.views ?? 0);
    const viewsYest = (yesterday.views ?? 0);
    const wtToday = (today.watchTime ?? 0);
    const wtYest = (yesterday.watchTime ?? 0);

    // 변화량
    const deltaSubs = subscribersToday - subscribersYest;
    const deltaViews = viewsToday - viewsYest;
    const deltaWatch = wtToday - wtYest;

    const card = document.createElement('div');
    card.className = 'my-channel-card';

    card.innerHTML = `
        <div class="my-channel-header">
            <img src="${channel.logo}" alt="${channel.name} 로고" class="my-channel-logo">
            <div>
                <h3>${channel.name}</h3>
            </div>
        </div>
        <div class="my-channel-stats">
            <div>
                <span>구독자</span>
                <strong>${subscribersToday.toLocaleString()}</strong>
                <span class="delta">${deltaSubs >= 0 ? "+" : ""}${deltaSubs.toLocaleString()}</span>
            </div>
            <div>
                <span>조회수</span>
                <strong>${viewsToday.toLocaleString()}</strong>
                <span class="delta">${deltaViews >= 0 ? "+" : ""}${deltaViews.toLocaleString()}</span>
            </div>
            <div>
                <span>유효시청시간</span>
                <input type="number" class="input-watch-time" data-channel-id="${channel.id}" value="${wtToday}" min="0" style="width:60px;">
                <span class="delta">${deltaWatch >= 0 ? "+" : ""}${deltaWatch.toLocaleString()}</span>
            </div>
        </div>
        <div class="my-channel-top3-wrap">
            <div class="my-channel-top3-title">돌연변이 TOP3</div>
            <div class="my-channel-top3-list" id="top3-${channel.id}"></div>
        </div>
    `;

    // 유효시청시간 입력 이벤트
    card.querySelector('.input-watch-time').addEventListener('change', (e) => {
        channel.today = channel.today || {};
        channel.today.watchTime = parseInt(e.target.value, 10) || 0;
        saveMyChannels();
        renderMyChannelList(); // 값 변경시 리렌더
    });

    // 돌연변이 top3 영상 그리기
    renderTop3Videos(channel, card.querySelector(`#top3-${channel.id}`));
    return card;
}

// 돌연변이 TOP3 렌더링
function renderTop3Videos(channel, container) {
    // 데이터 없으면 빈칸
    if (!channel.videos || channel.videos.length === 0) {
        container.innerHTML = `<div style="color:#bbb; text-align:center; padding:24px 0;">영상 정보 없음</div>`;
        return;
    }
    // mutantIndex 내림차순 정렬
    const top3 = [...channel.videos]
        .filter(v => v.mutantIndex)
        .sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex))
        .slice(0, 3);

    container.innerHTML = '';
    top3.forEach(video => {
        const item = document.createElement('div');
        item.className = 'my-top3-video-card';
        item.innerHTML = `
            <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">
                <div class="my-top3-thumb">
                    <img src="${video.thumbnail}" alt="썸네일">
                </div>
            </a>
            <div class="my-top3-title">
                <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">${video.title}</a>
            </div>
            <div class="my-top3-info">
                <span class="my-top3-views">조회수: ${parseInt(video.viewCount).toLocaleString()}</span>
                <span class="my-top3-mutant"> ${video.mutantIndex}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

// 채널 추가
function onClickAddChannel() {
    mySearchKeyword = prompt('추가할 채널명을 입력하세요:');
    if (!mySearchKeyword) return;
    searchChannels(mySearchKeyword, 1);
}

// API검색 + 페이지네이션
async function searchChannels(keyword, page) {
    myCurrentSearchPage = page;
    let allResults = [];
    let nextPageToken = '';
    let fetchedPages = 0;

    // 20페이지(=100개) 제한(원한다면 더 늘릴 수 있음)
    while (fetchedPages < 20) {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=channel&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const data = await fetchYoutubeApi(url);
        allResults = allResults.concat(data.items);
        if (data.nextPageToken) {
            nextPageToken = data.nextPageToken;
            fetchedPages++;
        } else {
            break;
        }
    }
    myChannelSearchResults = allResults;
    displaySearchResultsPaginated();
    myChannelSearchModal.style.display = 'block';
}

// 검색결과 페이징 표시
function displaySearchResultsPaginated() {
    myChannelSearchResultsDiv.innerHTML = '';
    myPagination.innerHTML = '';

    const total = myChannelSearchResults.length;
    if (total === 0) {
        myChannelSearchResultsDiv.innerHTML = `<div style="padding:32px;text-align:center;">채널을 찾을 수 없습니다.</div>`;
        return;
    }

    const totalPages = Math.ceil(total / perPage);
    const start = (myCurrentSearchPage - 1) * perPage;
    const list = myChannelSearchResults.slice(start, start + perPage);

    list.forEach(item => {
        const channelId = item.id.channelId;
        const channelTitle = item.snippet.title;
        const channelLogo = item.snippet.thumbnails.default.url;

        const channelEl = document.createElement('div');
        channelEl.className = 'channel-item';
        channelEl.innerHTML = `
            <div class="channel-info-wrapper">
                <img src="${channelLogo}" alt="${channelTitle} 로고" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;">
                <span>${channelTitle}</span>
            </div>
        `;
        channelEl.addEventListener('click', async () => {
            // 중복 체크
            if (myChannels.some(c => c.id === channelId)) {
                alert('이미 등록된 채널입니다.');
                return;
            }
            // 상세정보 fetch
            const channelDetails = await getChannelDetails(channelId);
            myChannels.push(channelDetails);
            saveMyChannels();
            myChannelSearchModal.style.display = 'none';
            renderMyChannelList();
        });
        myChannelSearchResultsDiv.appendChild(channelEl);
    });

    // 페이지네이션 (이전/다음 + 숫자 3개)
    if (totalPages > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '이전';
        prevBtn.disabled = myCurrentSearchPage === 1;
        prevBtn.onclick = () => {
            if (myCurrentSearchPage > 1) {
                myCurrentSearchPage--;
                displaySearchResultsPaginated();
            }
        };
        myPagination.appendChild(prevBtn);

        // 현재 페이지 중심, 3개만 노출
        let startNum = Math.max(1, myCurrentSearchPage - 1);
        let endNum = Math.min(totalPages, startNum + 2);
        if (endNum - startNum < 2) startNum = Math.max(1, endNum - 2);

        for (let p = startNum; p <= endNum; p++) {
            const btn = document.createElement('button');
            btn.textContent = p;
            btn.className = (p === myCurrentSearchPage) ? 'active' : '';
            btn.onclick = () => {
                myCurrentSearchPage = p;
                displaySearchResultsPaginated();
            };
            myPagination.appendChild(btn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '다음';
        nextBtn.disabled = myCurrentSearchPage === totalPages;
        nextBtn.onclick = () => {
            if (myCurrentSearchPage < totalPages) {
                myCurrentSearchPage++;
                displaySearchResultsPaginated();
            }
        };
        myPagination.appendChild(nextBtn);
    }
}

// 채널 상세 정보 (기본)
async function getChannelDetails(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const item = data.items[0];
    const uploadsPlaylistId = item.contentDetails.relatedPlaylists.uploads;

    // 영상 데이터 가져오기
    const videos = await getTopMutantVideos(uploadsPlaylistId, item.statistics.subscriberCount);

    return {
        id: channelId,
        name: item.snippet.title,
        logo: item.snippet.thumbnails.default.url,
        subscriberCount: parseInt(item.statistics.subscriberCount) || 0,
        latestUploadDate: item.snippet.publishedAt,
        uploadsPlaylistId: uploadsPlaylistId,
        videos: videos,
        today: {
            subscribers: parseInt(item.statistics.subscriberCount) || 0,
            views: parseInt(item.statistics.viewCount) || 0,
            watchTime: 0
        },
        yesterday: {
            subscribers: 0,
            views: 0,
            watchTime: 0
        }
    };
}

// 채널별 돌연변이 영상 TOP3
async function getTopMutantVideos(playlistId, subscriberCount) {
    let videoIds = [];
    let nextPageToken = null;
    let fetched = 0;

    // 최대 150개만 (페이지당 50개 x 3)
    while (fetched < 3) {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const data = await fetchYoutubeApi(url);
        videoIds = videoIds.concat(data.items.map(item => item.contentDetails.videoId));
        if (data.nextPageToken) {
            nextPageToken = data.nextPageToken;
            fetched++;
        } else {
            break;
        }
    }

    if (videoIds.length === 0) return [];

    // 상세정보
    const videoChunks = chunkArray(videoIds, 50);
    let videoDetails = [];
    for (const chunk of videoChunks) {
        const ids = chunk.join(',');
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids}`;
        const data = await fetchYoutubeApi(url);
        videoDetails = videoDetails.concat(data.items.map(item => {
            // 썸네일 URL
            let thumbnailUrl = item.snippet.thumbnails.medium?.url ||
                item.snippet.thumbnails.high?.url ||
                item.snippet.thumbnails.default?.url ||
                `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`;
            return {
                id: item.id,
                title: item.snippet.title,
                thumbnail: thumbnailUrl,
                viewCount: item.statistics.viewCount,
                publishedAt: item.snippet.publishedAt,
                duration: item.contentDetails.duration,
                mutantIndex: calculateMutantIndex(item.statistics.viewCount, subscriberCount)
            };
        }));
    }

    // mutantIndex 높은 순 정렬
    return videoDetails
        .filter(v => parseFloat(v.mutantIndex) >= 2.0 && isLongform(v.duration))
        .sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex))
        .slice(0, 3);
}

// 배열을 일정 크기로 쪼개기
function chunkArray(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
}

// 추적 시작 버튼 이벤트
function startTracking() {
    myIsTracking = true;
    renderMyChannelList();
}

