// js/my-channel-manager.js

import { isLongform, calculateMutantIndex } from './utils.js';
import { loadApiKeys, fetchYoutubeApi } from './api_keys.js';

// ---- 전역 변수 ----
let myChannels = [];
let myTrackingData = {};
let trackingStarted = false;

// DOM 요소 캐싱
const myChannelCountText = document.getElementById('my-channel-count-text');
const myChannelListContainer = document.getElementById('my-channel-list-container');
const myAddChannelBtn = document.getElementById('my-add-channel-btn');
const myTrackingDataContainer = document.getElementById('my-tracking-data-container');
const myDailyStatsList = document.getElementById('mychannel-daily-stats-list');
const myMutantTopList = document.getElementById('mychannel-mutant-top-list');
const myStartTrackingBtn = document.getElementById('start-tracking-btn');

// 검색 모달 관련
const myChannelSelectModal = document.getElementById('mychannel-select-modal');
const myChannelSearchResults = document.getElementById('mychannel-search-results');
const myChannelPagination = document.getElementById('mychannel-pagination');
const myChannelSelectCloseButton = document.querySelector('.mychannel-select-close');

let mySearchResults = [];
let mySearchPage = 1;
const RESULTS_PER_PAGE = 5;

// ---- 초기화 ----
document.addEventListener('DOMContentLoaded', () => {
    loadMyChannels();
    setupMyChannelEvents();
    updateMyChannelUI();
});

// ---- 이벤트 바인딩 ----
function setupMyChannelEvents() {
    myAddChannelBtn.addEventListener('click', handleMyAddChannel);

    myStartTrackingBtn.addEventListener('click', async () => {
        trackingStarted = true;
        myTrackingDataContainer.style.display = 'block';
        await loadMyTrackingData();
        await updateMyTrackingUI();
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

// ---- 채널 로딩/저장 ----
function loadMyChannels() {
    const stored = localStorage.getItem('myChannels');
    if (stored) {
        myChannels = JSON.parse(stored);
    }
    // 전날 데이터 불러오기(없으면 빈 객체)
    const td = localStorage.getItem('myTrackingData');
    myTrackingData = td ? JSON.parse(td) : {};
}
function saveMyChannels() {
    localStorage.setItem('myChannels', JSON.stringify(myChannels));
}

// ---- UI 업데이트 ----
function updateMyChannelUI() {
    myChannelCountText.textContent = `현재 ${myChannels.length}개의 채널이 등록되었습니다.`;
    renderMyChannelList();
    // 추적중이 아니면 데이터는 숨김
    if (!trackingStarted) {
        myTrackingDataContainer.style.display = 'none';
    }
}

// ---- 채널 리스트(카드) 3개씩 grid 배치 ----
function renderMyChannelList() {
    myChannelListContainer.innerHTML = '';
    if (myChannels.length === 0) {
        myChannelListContainer.innerHTML = '<p>채널을 추가하세요.</p>';
        return;
    }
    // 3개씩 grid
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(300px, 1fr))';
    grid.style.gap = '18px';

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

// ---- 채널 추가/검색/페이징 ----
async function handleMyAddChannel() {
    const channelName = prompt('추가할 채널명을 입력하세요:');
    if (!channelName) return;
    // YouTube API: 채널명 검색(최대 50개까지)
    let pageToken = '';
    let allResults = [];
    do {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelName)}&type=channel&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const data = await fetchYoutubeApi(url);
        allResults = allResults.concat(data.items);
        pageToken = data.nextPageToken;
    } while (pageToken && allResults.length < 200); // 200개까지만(과도한 API 사용 방지)

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
    // 페이징
    const totalPage = Math.ceil(mySearchResults.length / RESULTS_PER_PAGE);
    const startIdx = (mySearchPage - 1) * RESULTS_PER_PAGE;
    const pageResults = mySearchResults.slice(startIdx, startIdx + RESULTS_PER_PAGE);

    pageResults.forEach(item => {
        const channelId = item.id.channelId;
        const channelTitle = item.snippet.title;
        const channelLogo = item.snippet.thumbnails.default.url;
        // 중복 체크
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

    // 페이지네이션
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

// ---- 실제 채널 추가 ----
async function addMyChannel(channelId) {
    if (myChannels.some(c => c.id === channelId)) {
        alert('이미 등록된 채널입니다.');
        return;
    }
    // 채널 상세 불러오기
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

// ---- "추적시작" 누를 때: 데이터 갱신/저장 ----
async function loadMyTrackingData() {
    for (const ch of myChannels) {
        // 채널 최신정보
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${ch.id}`;
        const data = await fetchYoutubeApi(url);
        const item = data.items[0];
        // 어제 데이터(없으면 0)
        const yesterday = myTrackingData[ch.id] || {
            date: getToday(-1),
            subscriberCount: 0,
            totalViewCount: 0,
            watchTime: 0,
        };
        // 유효시청시간(직접입력)
        let watchTime = 0;
        if (myTrackingData[ch.id]) watchTime = myTrackingData[ch.id].watchTime || 0;

        // 오늘 데이터 기록
        myTrackingData[ch.id] = {
            date: getToday(0),
            subscriberCount: item.statistics.subscriberCount,
            totalViewCount: item.statistics.viewCount,
            watchTime: watchTime,
        };
    }
    // 저장
    localStorage.setItem('myTrackingData', JSON.stringify(myTrackingData));
}

// ---- 일일변화량/입력 UI/카드 ----
async function updateMyTrackingUI() {
    // ---- 1. 일일 변화량 ----
    myDailyStatsList.innerHTML = '';
    myChannels.forEach(ch => {
        const today = myTrackingData[ch.id] || {};
        // 어제 값 찾기
        let yData = null;
        for (const cid in myTrackingData) {
            if (cid === ch.id && myTrackingData[cid].date === getToday(-1)) {
                yData = myTrackingData[cid];
                break;
            }
        }
        // 변화량 계산
        const ySubs = yData ? parseInt(yData.subscriberCount) : 0;
        const yViews = yData ? parseInt(yData.totalViewCount) : 0;
        const yWatch = yData ? parseFloat(yData.watchTime) : 0;
        const tSubs = parseInt(today.subscriberCount || ch.subscriberCount);
        const tViews = parseInt(today.totalViewCount || ch.totalViewCount);
        const tWatch = parseFloat(today.watchTime || 0);
        // 입력란
        const statEl = document.createElement('div');
        statEl.className = 'mychannel-daily-stat-card';
        statEl.innerHTML = `
            <div class="stat-header" style="font-weight:bold; font-size:1.15em; margin-bottom:5px;">
                ${ch.name}
            </div>
            <div style="display:flex; gap:20px; align-items:center; margin-bottom:8px;">
                <div>구독자: <strong>${tSubs.toLocaleString()}</strong> <span style="color:#2a9d8f;">(▲${(tSubs-ySubs).toLocaleString()})</span></div>
                <div>전체조회수: <strong>${tViews.toLocaleString()}</strong> <span style="color:#2a9d8f;">(▲${(tViews-yViews).toLocaleString()})</span></div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <div>
                    유효시청시간(어제): <span style="font-weight:bold;">${yWatch}</span>시간 &nbsp;
                    오늘: 
                    <input type="number" step="0.1" min="0" style="width:70px;" value="${tWatch}" 
                        onchange="window.saveWatchTime && window.saveWatchTime('${ch.id}', this.value)">
                    <span style="color:#e76f51; font-weight:bold;">
                        (증가: ${(tWatch-yWatch).toFixed(1)}시간)
                    </span>
                </div>
            </div>
        `;
        myDailyStatsList.appendChild(statEl);
    });
    // ---- 2. TOP3 영상 ----
    myMutantTopList.innerHTML = '';
    for (const ch of myChannels) {
        // 채널별 돌연변이 TOP3
        const videos = await getChannelVideos(ch.uploadsPlaylistId, ch.subscriberCount);
        const box = document.createElement('div');
        box.className = 'mychannel-mutant-top-channel';
        box.style.marginBottom = '24px';
        box.innerHTML = `<div class="mutant-top-channel-title" style="font-weight:bold; font-size:1.1em; margin-bottom:8px;">${ch.name} - 돌연변이 TOP3</div>`;
        // 3개씩 세로 배치
        const vids = document.createElement('div');
        vids.style.display = 'grid';
        vids.style.gridTemplateColumns = 'repeat(3, 1fr)';
        vids.style.gap = '12px';
        videos.forEach(v => {
            const vCard = document.createElement('div');
            vCard.className = 'mutant-top-video-card';
            vCard.style.background = '#fff';
            vCard.style.borderRadius = '8px';
            vCard.style.boxShadow = '0 2px 8px #0002';
            vCard.style.padding = '12px';
            vCard.style.display = 'flex';
            vCard.style.flexDirection = 'column';
            vCard.style.alignItems = 'center';
            vCard.innerHTML = `
                <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" style="width:100%;">
                    <img src="${v.thumbnail}" alt="${v.title} 썸네일" style="width:100%; border-radius:6px; margin-bottom:6px;"/>
                </a>
                <div class="video-title" style="margin-bottom:5px; font-weight:600; font-size:0.98em; text-align:center; max-height:2.8em; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${v.title}</div>
                <div style="display:flex; width:100%; justify-content:space-between; align-items:center;">
                    <div style="font-size:13px;">조회수: ${parseInt(v.viewCount).toLocaleString()}</div>
                    <div style="margin-left:8px;">
                        <span style="border:2px solid #c4302b; color:#c4302b; border-radius:6px; padding:2px 8px; font-weight:bold; font-size:14px; background:#fff;">${v.mutantIndex}</span>
                    </div>
                </div>
            `;
            vids.appendChild(vCard);
        });
        box.appendChild(vids);
        myMutantTopList.appendChild(box);
    }

    // 유효시청시간 저장 함수 전역에 등록
    window.saveWatchTime = function(cid, value) {
        if (!myTrackingData[cid]) return;
        myTrackingData[cid].watchTime = parseFloat(value);
        localStorage.setItem('myTrackingData', JSON.stringify(myTrackingData));
        updateMyTrackingUI(); // 변화량 갱신
    };
}

// ---- 유틸: 날짜 문자열 (한국시간) ----
function getToday(delta = 0) {
    return moment().tz('Asia/Seoul').add(delta, 'days').format('YYYY-MM-DD');
}

// ---- 돌연변이 TOP3 ----
async function getChannelVideos(playlistId, subscriberCount) {
    let allVideos = [];
    let nextPageToken = null;
    let tried = 0;
    while (tried < 2) { // 최대 100개까지만(과도한 할당량 방지)
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const data = await fetchYoutubeApi(url);
        allVideos = allVideos.concat(data.items);
        nextPageToken = data.nextPageToken;
        if (!nextPageToken) break;
        tried++;
    }
    const videoIds = allVideos.map(item => item.contentDetails.videoId);
    // 상세 정보 요청
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
            return {
                id: item.id,
                title: item.snippet.title,
                thumbnail: thumbnailUrl,
                viewCount: item.statistics.viewCount,
                publishedAt: item.snippet.publishedAt,
                mutantIndex: mutantIndex
            };
        });
        videoDetails = videoDetails.concat(details);
    }
    // 내림차순 TOP3 (지수 2.0 이상만)
    return videoDetails
        .filter(v => parseFloat(v.mutantIndex) >= 2.0 && isLongform(v.publishedAt))
        .sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex))
        .slice(0, 3);
}
