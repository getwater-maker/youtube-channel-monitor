// js/my-channel-manager.js

import { isLongform, calculateMutantIndex } from './utils.js';
import { loadApiKeys, fetchYoutubeApi } from './api_keys.js';

let myChannels = [];
let myTrackingData = {};
let trackingStarted = false;

const myChannelCountText = document.getElementById('my-channel-count-text');
const myChannelListContainer = document.getElementById('my-channel-list-container');
const myAddChannelBtn = document.getElementById('my-add-channel-btn');
const myTrackingDataContainer = document.getElementById('my-tracking-data-container');
const myStartTrackingBtn = document.getElementById('start-tracking-btn');
const myChannelSelectModal = document.getElementById('mychannel-select-modal');
const myChannelSearchResults = document.getElementById('mychannel-search-results');
const myChannelPagination = document.getElementById('mychannel-pagination');
const myChannelSelectCloseButton = document.querySelector('.mychannel-select-close');

let mySearchResults = [];
let mySearchPage = 1;
const RESULTS_PER_PAGE = 5;

document.addEventListener('DOMContentLoaded', () => {
    loadMyChannels();
    setupMyChannelEvents();
    updateMyChannelUI();
});

function setupMyChannelEvents() {
    myAddChannelBtn.addEventListener('click', handleMyAddChannel);

    myStartTrackingBtn.addEventListener('click', async () => {
        trackingStarted = true;
        myTrackingDataContainer.style.display = 'block';
        await loadMyTrackingData();
        await updateMyChannelUI(); // <-- 바로 카드 UI
    });

    myChannelSelectCloseButton.addEventListener('click', () => {
        myChannelSelectModal.style.display = 'none';
    });
    window.addEventListener('click', (event) => {
        if (event.target === myChannelSelectModal) {
            myChannelSelectModal.style.display = 'none';
        }
    });
}

function loadMyChannels() {
    const stored = localStorage.getItem('myChannels');
    if (stored) {
        myChannels = JSON.parse(stored);
    }
    const td = localStorage.getItem('myTrackingData');
    myTrackingData = td ? JSON.parse(td) : {};
}
function saveMyChannels() {
    localStorage.setItem('myChannels', JSON.stringify(myChannels));
}

async function updateMyChannelUI() {
    myChannelCountText.textContent = `현재 ${myChannels.length}개의 채널이 등록되었습니다.`;
    renderMyChannelList();
    // "추적시작" 후에는 카드+통계+top3를 모두 같은 카드에 출력
    if (trackingStarted) {
        myTrackingDataContainer.style.display = 'block';
        await renderMyTrackingCards();
    } else {
        myTrackingDataContainer.style.display = 'none';
    }
}

// 채널 목록만 출력 (추적시작 전)
function renderMyChannelList() {
    myChannelListContainer.innerHTML = '';
    if (myChannels.length === 0) {
        myChannelListContainer.innerHTML = '<p>채널을 추가하세요.</p>';
        return;
    }
    // 3개씩 grid
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
    grid.style.gap = '20px';

    myChannels.forEach((ch, i) => {
        const card = document.createElement('div');
        card.classList.add('channel-item');
        card.style.minHeight = '110px';
        card.innerHTML = `
            <div class="channel-info-wrapper">
                <a href="https://www.youtube.com/channel/${ch.id}" target="_blank">
                    <img src="${ch.logo}" alt="${ch.name} 로고" style="width:50px; height:50px; border-radius:50%; margin-right:10px;">
                </a>
                <div>
                    <div style="font-weight:bold; font-size:1.1em;">${ch.name}</div>
                    <div>구독자: ${parseInt(ch.subscriberCount).toLocaleString()}명</div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
    myChannelListContainer.appendChild(grid);
}

// 채널 추가/검색/페이징
async function handleMyAddChannel() {
    const channelName = prompt('추가할 채널명을 입력하세요:');
    if (!channelName) return;
    let pageToken = '';
    let allResults = [];
    do {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelName)}&type=channel&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const data = await fetchYoutubeApi(url);
        allResults = allResults.concat(data.items);
        pageToken = data.nextPageToken;
    } while (pageToken && allResults.length < 200);
    mySearchResults = allResults;
    mySearchPage = 1;
    renderMyChannelSearchResults();
    myChannelSelectModal.style.display = 'block';
}
function renderMyChannelSearchResults() {
    myChannelSearchResults.innerHTML = '';
    if (mySearchResults.length === 0) {
        myChannelSearchResults.innerHTML = '<p>채널을 찾을 수 없습니다.</p>';
        myChannelPagination.innerHTML = '';
        return;
    }
    const totalPage = Math.ceil(mySearchResults.length / RESULTS_PER_PAGE);
    const startIdx = (mySearchPage - 1) * RESULTS_PER_PAGE;
    const pageResults = mySearchResults.slice(startIdx, startIdx + RESULTS_PER_PAGE);
    pageResults.forEach(item => {
        const channelId = item.id.channelId;
        const channelTitle = item.snippet.title;
        const channelLogo = item.snippet.thumbnails.default.url;
        const already = myChannels.some(c => c.id === channelId);

        const channelEl = document.createElement('div');
        channelEl.classList.add('channel-item');
        channelEl.style.cursor = already ? 'not-allowed' : 'pointer';
        channelEl.style.opacity = already ? '0.5' : '1';
        channelEl.innerHTML = `
            <div class="channel-info-wrapper">
                <img src="${channelLogo}" alt="${channelTitle} 로고" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;">
                <span>${channelTitle} ${already ? '(이미 등록됨)' : ''}</span>
            </div>
        `;
        if (!already) {
            channelEl.addEventListener('click', async () => {
                await addMyChannel(channelId);
                myChannelSelectModal.style.display = 'none';
            });
        }
        myChannelSearchResults.appendChild(channelEl);
    });
    myChannelPagination.innerHTML = '';
    for (let i = 1; i <= totalPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        if (i === mySearchPage) pageBtn.classList.add('active');
        pageBtn.addEventListener('click', () => {
            mySearchPage = i;
            renderMyChannelSearchResults();
        });
        myChannelPagination.appendChild(pageBtn);
    }
}
async function addMyChannel(channelId) {
    if (myChannels.some(c => c.id === channelId)) {
        alert('이미 등록된 채널입니다.');
        return;
    }
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const item = data.items[0];
    const uploadsPlaylistId = item.contentDetails.relatedPlaylists.uploads;
    myChannels.push({
        id: channelId,
        name: item.snippet.title,
        logo: item.snippet.thumbnails.default.url,
        subscriberCount: item.statistics.subscriberCount,
        totalViewCount: item.statistics.viewCount,
        uploadsPlaylistId: uploadsPlaylistId,
    });
    saveMyChannels();
    updateMyChannelUI();
}

// ---- "추적시작" 시 오늘자 데이터 최신화
async function loadMyTrackingData() {
    for (const ch of myChannels) {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${ch.id}`;
        const data = await fetchYoutubeApi(url);
        const item = data.items[0];
        const yesterday = myTrackingData[ch.id] || {
            date: getToday(-1),
            subscriberCount: 0,
            totalViewCount: 0,
            watchTime: 0,
        };
        let watchTime = 0;
        if (myTrackingData[ch.id]) watchTime = myTrackingData[ch.id].watchTime || 0;
        myTrackingData[ch.id] = {
            date: getToday(0),
            subscriberCount: item.statistics.subscriberCount,
            totalViewCount: item.statistics.viewCount,
            watchTime: watchTime,
        };
    }
    localStorage.setItem('myTrackingData', JSON.stringify(myTrackingData));
}

// ---- 모든 정보 한 카드로, 3개씩 가로 grid ----
async function renderMyTrackingCards() {
    const container = myTrackingDataContainer;
    container.innerHTML = '';
    // 3개씩 그리드
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(350px, 1fr))';
    grid.style.gap = '20px';

    for (const ch of myChannels) {
        const today = myTrackingData[ch.id] || {};
        let yData = null;
        for (const cid in myTrackingData) {
            if (cid === ch.id && myTrackingData[cid].date === getToday(-1)) {
                yData = myTrackingData[cid];
                break;
            }
        }
        const ySubs = yData ? parseInt(yData.subscriberCount) : 0;
        const yViews = yData ? parseInt(yData.totalViewCount) : 0;
        const yWatch = yData ? parseInt(yData.watchTime) : 0;
        const tSubs = parseInt(today.subscriberCount || ch.subscriberCount);
        const tViews = parseInt(today.totalViewCount || ch.totalViewCount);
        const tWatch = parseInt(today.watchTime || 0);

        // 돌연변이 top3
        const videos = await getChannelVideos(ch.uploadsPlaylistId, ch.subscriberCount);

        const card = document.createElement('div');
        card.className = 'mychannel-tracking-card';
        card.style.background = '#fff';
        card.style.borderRadius = '12px';
        card.style.boxShadow = '0 2px 10px #0001';
        card.style.padding = '20px 18px 18px 18px';

        card.innerHTML = `
            <div style="display:flex; align-items:center; margin-bottom:12px;">
                <a href="https://www.youtube.com/channel/${ch.id}" target="_blank">
                    <img src="${ch.logo}" alt="${ch.name} 로고" style="width:48px; height:48px; border-radius:50%; margin-right:12px;">
                </a>
                <div>
                    <div style="font-weight:bold; font-size:1.15em;">${ch.name}</div>
                    <div style="font-size:13px; color:#666;">구독자: <strong>${tSubs.toLocaleString()}</strong> <span style="color:#2a9d8f;">(▲${(tSubs-ySubs).toLocaleString()})</span></div>
                    <div style="font-size:13px; color:#666;">전체조회수: <strong>${tViews.toLocaleString()}</strong> <span style="color:#2a9d8f;">(▲${(tViews-yViews).toLocaleString()})</span></div>
                </div>
            </div>
            <div style="margin-bottom:8px;">
                유효시청시간(어제): <span style="font-weight:bold;">${yWatch}</span>시간
                &nbsp;&nbsp;오늘: 
                <input type="number" step="1" min="0" style="width:70px;" value="${tWatch}" 
                    onchange="window.saveWatchTime && window.saveWatchTime('${ch.id}', this.value)">
                <span style="color:#e76f51; font-weight:bold;">
                    (증가: ${(tWatch-yWatch)}시간)
                </span>
            </div>
            <div style="font-weight:600; margin:16px 0 4px 0;">돌연변이 TOP3 영상</div>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
                ${videos.map(v => `
                    <div style="background:#f9f9f9; border-radius:8px; box-shadow:0 1px 5px #0001; padding:6px; display:flex; flex-direction:column; align-items:center;">
                        <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" style="width:100%;">
                            <img src="${v.thumbnail}" alt="${v.title} 썸네일" style="width:100%; border-radius:6px; margin-bottom:6px;"/>
                        </a>
                        <div style="font-weight:500; font-size:0.98em; text-align:center; margin-bottom:4px; max-height:2.6em; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                            ${v.title}
                        </div>
                        <div style="display:flex; width:100%; justify-content:space-between; align-items:center;">
                            <div style="font-size:12px;">조회수: ${parseInt(v.viewCount).toLocaleString()}</div>
                            <div>
                                <span style="border:2px solid #c4302b; color:#c4302b; border-radius:6px; padding:2px 8px; font-weight:bold; font-size:13px; background:#fff;">${v.mutantIndex}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        grid.appendChild(card);
    }
    container.appendChild(grid);

    // 유효시청시간 저장 함수 전역 등록
    window.saveWatchTime = function(cid, value) {
        if (!myTrackingData[cid]) return;
        myTrackingData[cid].watchTime = parseInt(value);
        localStorage.setItem('myTrackingData', JSON.stringify(myTrackingData));
        renderMyTrackingCards();
    };
}

// 날짜: 한국시간
function getToday(delta = 0) {
    return moment().tz('Asia/Seoul').add(delta, 'days').format('YYYY-MM-DD');
}

// 돌연변이 TOP3 영상 (재생시간 기준!)
async function getChannelVideos(playlistId, subscriberCount) {
    let allVideos = [];
    let nextPageToken = null;
    let tried = 0;
    while (tried < 2) { // 100개까지만
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const data = await fetchYoutubeApi(url);
        allVideos = allVideos.concat(data.items);
        nextPageToken = data.nextPageToken;
        if (!nextPageToken) break;
        tried++;
    }
    const videoIds = allVideos.map(item => item.contentDetails.videoId);
    let videoDetails = [];
    for (let i = 0; i < videoIds.length; i += 50) {
        const ids = videoIds.slice(i, i + 50);
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}`;
        const data = await fetchYoutubeApi(url);
        const details = data.items.map(item => {
            // 썸네일 fallback
            const fallbackThumbnail = `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`;
            let thumbnailUrl = fallbackThumbnail;
            if (item.snippet.thumbnails) {
                thumbnailUrl =
                    item.snippet.thumbnails.medium?.url ||
                    item.snippet.thumbnails.high?.url ||
                    item.snippet.thumbnails.default?.url ||
                    fallbackThumbnail;
            }
            const mutantIndex = calculateMutantIndex(item.statistics.viewCount, subscriberCount);
            // ★★★ 재생시간 기준 롱폼
            return {
                id: item.id,
                title: item.snippet.title,
                thumbnail: thumbnailUrl,
                viewCount: item.statistics.viewCount,
                publishedAt: item.snippet.publishedAt,
                duration: item.contentDetails.duration,
                mutantIndex: mutantIndex
            };
        });
        videoDetails = videoDetails.concat(details);
    }
    // 내림차순 TOP3 (지수 2.0 이상, 롱폼만)
    return videoDetails
        .filter(v => parseFloat(v.mutantIndex) >= 2.0 && isLongform(v.duration))
        .sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex))
        .slice(0, 3);
}
