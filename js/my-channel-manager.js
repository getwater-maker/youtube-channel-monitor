// js/my-channel-manager.js (복붙용)

// 반드시 아래 두 파일이 export 형태로 되어있어야 함!
import { fetchYoutubeApi, loadApiKeys } from './api_keys.js';
import { isLongform, calculateMutantIndex } from './utils.js';

// DOM 캐싱
const myChannelCountSpan = document.getElementById('my-channel-count');
const myChannelList = document.getElementById('my-channel-list');
const myAddChannelBtn = document.getElementById('my-add-channel-btn');
const myTrackBtn = document.getElementById('my-track-btn');

// 모달
const myChannelSearchModal = document.getElementById('my-channel-search-modal');
const myChannelSearchResults = document.getElementById('my-channel-search-results');
const myPagination = document.getElementById('my-pagination');

// 채널 데이터
let myChannels = [];
let searchResults = [];
let currentSearchPage = 1;
const RESULTS_PER_PAGE = 5;
let trackingActive = false;

// 저장/로드
function loadMyChannels() {
    const stored = localStorage.getItem('myChannels');
    if (stored) myChannels = JSON.parse(stored);
}
function saveMyChannels() {
    localStorage.setItem('myChannels', JSON.stringify(myChannels));
}

// 하루치 데이터 로드/저장
function loadMyStats() {
    const stats = localStorage.getItem('myChannelStats');
    return stats ? JSON.parse(stats) : {};
}
function saveMyStats(stats) {
    localStorage.setItem('myChannelStats', JSON.stringify(stats));
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadMyChannels();
    renderMyChannelList();
    setupEventListeners();
});

function setupEventListeners() {
    // 채널 추가
    myAddChannelBtn.addEventListener('click', openChannelSearchModal);

    // 추적시작
    myTrackBtn.addEventListener('click', () => {
        trackingActive = !trackingActive;
        myTrackBtn.textContent = trackingActive ? '추적중...' : '추적시작';
        if (trackingActive) {
            trackAllChannels();
        } else {
            // 추적 중지(필요시)
        }
    });

    // 모달 닫기
    myChannelSearchModal.querySelector('.close-button').addEventListener('click', () => {
        myChannelSearchModal.style.display = 'none';
    });

    // 바깥 클릭시 모달 닫기
    window.addEventListener('click', e => {
        if (e.target === myChannelSearchModal) myChannelSearchModal.style.display = 'none';
    });

    // 유효시청시간 입력 반영(엔터시 저장 & 자동 새로고침 없음)
    myChannelList.addEventListener('input', e => {
        if (e.target.classList.contains('watchtime-input')) {
            const channelId = e.target.dataset.channelId;
            const value = e.target.value.replace(/\D/g, ''); // 숫자만
            e.target.value = value;
            updateUserWatchTime(channelId, value);
        }
    });
}

// 채널 추가 모달 열기 & 검색
function openChannelSearchModal() {
    // 검색창 띄우고 초기화
    searchResults = [];
    currentSearchPage = 1;
    myChannelSearchResults.innerHTML = `<div style="text-align:center;margin:24px 0;">채널명을 입력하세요<br><input id="my-channel-search-input" style="margin-top:12px;width:80%;" placeholder="채널명 입력"></div>`;
    myPagination.innerHTML = '';
    myChannelSearchModal.style.display = 'block';

    setTimeout(() => {
        const searchInput = document.getElementById('my-channel-search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.addEventListener('keydown', async e => {
                if (e.key === 'Enter') {
                    await searchChannels(searchInput.value);
                }
            });
        }
    }, 100);
}

// 유튜브에서 채널 검색 (모든 결과 수집, 최대 50페이지)
async function searchChannels(query) {
    if (!query.trim()) return;
    let nextPageToken = '';
    let allItems = [];
    let pageCount = 0;
    const MAX_TOTAL_RESULTS = 100; // 유튜브API 실 사용시 너무 많으면 할당량 문제 주의

    do {
        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=5${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const data = await fetchYoutubeApi(url);
        allItems = allItems.concat(data.items);
        nextPageToken = data.nextPageToken || '';
        pageCount++;
    } while (nextPageToken && allItems.length < MAX_TOTAL_RESULTS && pageCount < 50);

    searchResults = allItems;
    displaySearchResultsPaginated();
}

// 검색결과 + 페이지네이션
function displaySearchResultsPaginated() {
    myChannelSearchResults.innerHTML = '';
    myPagination.innerHTML = '';

    if (searchResults.length === 0) {
        myChannelSearchResults.innerHTML = '<p style="padding:16px;">검색 결과가 없습니다.</p>';
        return;
    }
    // 현재 페이지 결과만 보여주기
    const start = (currentSearchPage - 1) * RESULTS_PER_PAGE;
    const end = start + RESULTS_PER_PAGE;
    const pageResults = searchResults.slice(start, end);

    pageResults.forEach(item => {
        const channelId = item.id.channelId;
        const title = item.snippet.title;
        const logo = item.snippet.thumbnails?.default?.url || '';
        const el = document.createElement('div');
        el.className = 'channel-item';
        el.innerHTML = `
            <img src="${logo}" alt="${title}" style="width:44px; height:44px; border-radius:50%; margin-right:10px;">
            <span>${title}</span>
        `;
        el.style.cursor = 'pointer';
        el.onclick = () => {
            // 이미 등록된 경우 추가 불가
            if (myChannels.some(ch => ch.id === channelId)) {
                alert('이미 등록된 채널입니다.');
                return;
            }
            addChannel(channelId, title, logo);
            myChannelSearchModal.style.display = 'none';
        };
        myChannelSearchResults.appendChild(el);
    });

    // 페이지네이션 (Prev, 1, 2, 3, Next) 최대 3페이지
    const totalPages = Math.ceil(searchResults.length / RESULTS_PER_PAGE);
    if (totalPages > 1) {
        const pagDiv = document.createElement('div');
        pagDiv.className = 'pagination';
        // Prev
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '이전';
        prevBtn.disabled = currentSearchPage === 1;
        prevBtn.onclick = () => {
            if (currentSearchPage > 1) {
                currentSearchPage--;
                displaySearchResultsPaginated();
            }
        };
        pagDiv.appendChild(prevBtn);
        // Page numbers(1~3)
        for (let i = 1; i <= Math.min(3, totalPages); i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = (i === currentSearchPage) ? 'active' : '';
            btn.onclick = () => {
                currentSearchPage = i;
                displaySearchResultsPaginated();
            };
            pagDiv.appendChild(btn);
        }
        // Next
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '다음';
        nextBtn.disabled = currentSearchPage === totalPages;
        nextBtn.onclick = () => {
            if (currentSearchPage < totalPages) {
                currentSearchPage++;
                displaySearchResultsPaginated();
            }
        };
        pagDiv.appendChild(nextBtn);
        myPagination.appendChild(pagDiv);
    }
}

// 채널 추가(간략)
async function addChannel(channelId, name, logo) {
    // 상세정보 가져오기
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const item = data.items[0];
    myChannels.push({
        id: channelId,
        name: item.snippet.title,
        logo: item.snippet.thumbnails?.default?.url || logo,
        subscriberCount: item.statistics.subscriberCount,
        viewCount: item.statistics.viewCount,
        uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
        watchTimeHistory: [] // 유효시청시간 변화 저장용
    });
    saveMyChannels();
    renderMyChannelList();
}

// 채널 목록 렌더링
function renderMyChannelList() {
    myChannelList.innerHTML = '';
    myChannelCountSpan.textContent = myChannels.length;

    // 한줄에 3개씩 가로배치
    const rowDiv = document.createElement('div');
    rowDiv.className = 'my-channel-row';
    myChannels.forEach((channel, idx) => {
        const col = document.createElement('div');
        col.className = 'my-channel-col';

        col.innerHTML = `
            <div class="my-channel-card">
                <div class="my-channel-header">
                    <img src="${channel.logo}" alt="${channel.name}" class="my-channel-logo">
                    <div>
                        <div class="my-channel-name">${channel.name}</div>
                        <div class="my-channel-subs">구독자: <span id="subs-${channel.id}">${parseInt(channel.subscriberCount).toLocaleString()}</span></div>
                        <div class="my-channel-views">조회수: <span id="views-${channel.id}">${parseInt(channel.viewCount).toLocaleString()}</span></div>
                    </div>
                </div>
                <div class="my-channel-watchtime">
                    <div>유효시청시간(어제): <span id="watchtime-prev-${channel.id}">${getWatchTime(channel, 'yesterday')}</span> 시간</div>
                    <div>
                        유효시청시간(오늘): 
                        <input type="number" class="watchtime-input" data-channel-id="${channel.id}" value="${getWatchTime(channel, 'today')}" min="0" step="1" style="width:80px;">
                        시간
                    </div>
                    <div class="my-channel-growth">
                        <span class="growth-label">구독자 증가: <span id="growth-subs-${channel.id}">0</span></span>
                        <span class="growth-label">조회수 증가: <span id="growth-views-${channel.id}">0</span></span>
                        <span class="growth-label">시청시간 증가: <span id="growth-watchtime-${channel.id}">0</span></span>
                    </div>
                </div>
                <div class="my-channel-top3">
                    <div class="top3-title">돌연변이 TOP3 영상</div>
                    <div class="top3-list" id="top3-${channel.id}">로딩중...</div>
                </div>
            </div>
        `;
        rowDiv.appendChild(col);

        // 한줄 3개씩 줄바꿈
        if ((idx + 1) % 3 === 0) {
            myChannelList.appendChild(rowDiv.cloneNode(true));
            rowDiv.innerHTML = '';
        }
    });
    if (rowDiv.childNodes.length) {
        myChannelList.appendChild(rowDiv);
    }

    // 변화량 및 top3영상 비동기 반영
    myChannels.forEach(channel => {
        updateChannelGrowth(channel);
        if (trackingActive) fetchAndDisplayTop3(channel);
    });
}

// 유효시청시간(오늘/어제) getter (로컬스토리지 기반)
function getWatchTime(channel, when = 'today') {
    const stats = loadMyStats();
    const todayKey = moment().tz("Asia/Seoul").format('YYYY-MM-DD');
    const yesterKey = moment().tz("Asia/Seoul").subtract(1, 'day').format('YYYY-MM-DD');
    const cstats = stats[channel.id] || {};
    if (when === 'today') return cstats[todayKey] || '';
    if (when === 'yesterday') return cstats[yesterKey] || '';
    return '';
}

// 유효시청시간 입력 저장
function updateUserWatchTime(channelId, value) {
    const stats = loadMyStats();
    const todayKey = moment().tz("Asia/Seoul").format('YYYY-MM-DD');
    if (!stats[channelId]) stats[channelId] = {};
    stats[channelId][todayKey] = value;
    saveMyStats(stats);
    renderMyChannelList(); // 변화량 즉시 반영
}

// 변화량 반영(구독자/조회수/시청시간)
function updateChannelGrowth(channel) {
    // 예시: 어제 정보는 단순히 현재값-100, 현재값-200 등(실제는 API/DB에서 가져와야)
    const prevSubs = parseInt(channel.subscriberCount) - 20;
    const prevViews = parseInt(channel.viewCount) - 300;
    const todayWatch = parseInt(getWatchTime(channel, 'today') || 0);
    const yesterWatch = parseInt(getWatchTime(channel, 'yesterday') || 0);

    document.getElementById(`growth-subs-${channel.id}`).textContent = (parseInt(channel.subscriberCount) - prevSubs).toLocaleString();
    document.getElementById(`growth-views-${channel.id}`).textContent = (parseInt(channel.viewCount) - prevViews).toLocaleString();
    document.getElementById(`growth-watchtime-${channel.id}`).textContent = (todayWatch - yesterWatch).toLocaleString();
}

// 채널별 돌연변이 Top3 영상 가져오기
async function fetchAndDisplayTop3(channel) {
    // 업로드 영상 50개까지만
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${channel.uploadsPlaylistId}&maxResults=50`;
    const playlist = await fetchYoutubeApi(url);
    const videoIds = playlist.items.map(it => it.contentDetails.videoId);
    if (!videoIds.length) {
        document.getElementById(`top3-${channel.id}`).innerHTML = '<div>영상 없음</div>';
        return;
    }
    // 상세 정보
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}`;
    const detailData = await fetchYoutubeApi(detailsUrl);

    // 돌연변이 지수 기준 정렬
    const sorted = detailData.items.map(item => {
        const index = calculateMutantIndex(item.statistics.viewCount, channel.subscriberCount);
        return {
            id: item.id,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
            viewCount: item.statistics.viewCount,
            mutantIndex: index
        }
    }).sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex)).slice(0, 3);

    // 출력
    const top3Div = document.getElementById(`top3-${channel.id}`);
    top3Div.innerHTML = '';
    sorted.forEach(video => {
        const videoDiv = document.createElement('div');
        videoDiv.className = 'top3-video';
        videoDiv.innerHTML = `
            <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">
                <img src="${video.thumbnail}" alt="썸네일">
                <div class="top3-video-title">${video.title}</div>
            </a>
            <div class="top3-meta">
                <span>조회수: ${parseInt(video.viewCount).toLocaleString()}</span>
                <span class="mutant-index-badge">${video.mutantIndex}</span>
            </div>
        `;
        top3Div.appendChild(videoDiv);
    });
}
