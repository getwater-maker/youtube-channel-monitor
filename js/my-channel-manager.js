// js/my-channel-manager.js

import { fetchYoutubeApi, loadApiKeys } from './api_keys.js';
import { isLongform, calculateMutantIndex } from './utils.js';

// --------- tz 지원 체크 (moment-timezone이 없으면 fallback) ----------
function getTodayKey() {
    if (window.moment && typeof moment.tz === 'function') {
        return moment().tz("Asia/Seoul").format('YYYY-MM-DD');
    }
    return moment().format('YYYY-MM-DD');
}

// --- DOM 캐싱 ---
const myChannelCountSpan = document.getElementById('my-channel-count');
const myChannelList = document.getElementById('my-channel-list');
const myAddChannelBtn = document.getElementById('my-add-channel-btn');
const myTrackBtn = document.getElementById('my-track-btn');
const myChannelSearchModal = document.getElementById('my-channel-search-modal');
const myChannelSearchResults = document.getElementById('my-channel-search-results');
const myPagination = document.getElementById('my-pagination');
const myApiKeyPopupBtn = document.getElementById('open-api-key-popup');

// ---- 상태 ----
let myChannels = [];
let mySearchResults = [];
let currentSearchPage = 1;
const SEARCH_PER_PAGE = 5;
let myTrackingStarted = false;

// ---- 초기화 ----
document.addEventListener('DOMContentLoaded', () => {
    loadMyChannels();
    setupMyEventListeners();
    renderMyChannelList();
});

// ---- 이벤트 리스너 ----
function setupMyEventListeners() {
    myAddChannelBtn.addEventListener('click', handleMyAddChannel);

    // "추적시작" 버튼
    myTrackBtn.addEventListener('click', async () => {
        myTrackingStarted = true;
        await trackMyChannels();
        renderMyChannelList();
    });

    // 모달 닫기
    myChannelSearchModal.querySelector('.close-button').onclick = () => {
        myChannelSearchModal.style.display = 'none';
        mySearchResults = [];
        myPagination.innerHTML = '';
    };

    // API키 팝업(공통)
    if (myApiKeyPopupBtn) {
        myApiKeyPopupBtn.onclick = function() {
            const modal = document.getElementById('api-key-modal');
            if (modal) modal.style.display = 'block';
        };
    }

    // 모달 외부 클릭시 닫기
    window.onclick = function(event) {
        if (event.target === myChannelSearchModal) {
            myChannelSearchModal.style.display = 'none';
        }
        if (event.target.classList && event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
}

// ---- 채널 저장/불러오기 ----
function loadMyChannels() {
    const stored = localStorage.getItem('myChannels');
    myChannels = stored ? JSON.parse(stored) : [];
    myChannelCountSpan.textContent = myChannels.length;
}

function saveMyChannels() {
    localStorage.setItem('myChannels', JSON.stringify(myChannels));
    myChannelCountSpan.textContent = myChannels.length;
}

// ---- 채널 추가 ----
async function handleMyAddChannel() {
    const channelName = prompt('추가할 채널명을 입력하세요:');
    if (!channelName) return;

    try {
        // 최대 50개까지 한 번에 조회 (페이징 지원)
        let allResults = [];
        let nextPageToken = '';
        do {
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelName)}&type=channel&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
            const data = await fetchYoutubeApi(url);
            allResults = allResults.concat(data.items);
            nextPageToken = data.nextPageToken || '';
        } while (nextPageToken);

        if (allResults.length === 0) {
            alert('채널을 찾을 수 없습니다.');
            return;
        }

        mySearchResults = allResults;
        currentSearchPage = 1;
        displaySearchResultsPaginated();
        myChannelSearchModal.style.display = 'block';

    } catch (e) {
        alert('채널 검색 중 오류가 발생했습니다.');
    }
}

function displaySearchResultsPaginated() {
    const start = (currentSearchPage - 1) * SEARCH_PER_PAGE;
    const end = start + SEARCH_PER_PAGE;
    const results = mySearchResults.slice(start, end);

    myChannelSearchResults.innerHTML = '';
    results.forEach(item => {
        const channelId = item.id.channelId;
        const channelTitle = item.snippet.title;
        const channelLogo = item.snippet.thumbnails.default.url;

        const el = document.createElement('div');
        el.className = 'channel-item';
        el.innerHTML = `
            <div class="channel-info-wrapper">
                <img src="${channelLogo}" style="width:48px; height:48px; border-radius:50%; margin-right:10px;">
                <span>${channelTitle}</span>
            </div>
        `;
        el.onclick = async () => {
            // 중복 체크
            if (myChannels.some(c => c.id === channelId)) {
                alert('이미 등록된 채널입니다.');
                return;
            }
            const detail = await getChannelDetails(channelId);
            myChannels.push(detail);
            saveMyChannels();
            renderMyChannelList();
            myChannelSearchModal.style.display = 'none';
        };
        myChannelSearchResults.appendChild(el);
    });

    // 페이지네이션 (1 2 3 ... Prev/Next)
    myPagination.innerHTML = '';
    const totalPages = Math.ceil(mySearchResults.length / SEARCH_PER_PAGE);

    if (totalPages > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '이전';
        prevBtn.disabled = currentSearchPage === 1;
        prevBtn.onclick = () => {
            if (currentSearchPage > 1) {
                currentSearchPage--;
                displaySearchResultsPaginated();
            }
        };
        myPagination.appendChild(prevBtn);

        // 1~3페이지만
        for (let p = 1; p <= Math.min(totalPages, 3); p++) {
            const btn = document.createElement('button');
            btn.textContent = p;
            if (p === currentSearchPage) btn.classList.add('active');
            btn.onclick = () => {
                currentSearchPage = p;
                displaySearchResultsPaginated();
            };
            myPagination.appendChild(btn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '다음';
        nextBtn.disabled = currentSearchPage === totalPages;
        nextBtn.onclick = () => {
            if (currentSearchPage < totalPages) {
                currentSearchPage++;
                displaySearchResultsPaginated();
            }
        };
        myPagination.appendChild(nextBtn);
    }
}

// ---- 채널 상세 정보 불러오기 ----
async function getChannelDetails(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const item = data.items[0];
    const uploadsPlaylistId = item.contentDetails.relatedPlaylists.uploads;

    return {
        id: channelId,
        name: item.snippet.title,
        logo: item.snippet.thumbnails.default.url,
        subscriberCount: Number(item.statistics.subscriberCount || 0),
        viewCount: Number(item.statistics.viewCount || 0),
        latestUploadDate: item.snippet.publishedAt,
        uploadsPlaylistId,
        mutantVideos: [],
        watchTimes: {} // 날짜별 유효시청시간
    };
}

// ---- 채널 추적(조회/저장) ----
async function trackMyChannels() {
    // 오늘 날짜(Asia/Seoul 기준)
    const todayKey = getTodayKey();

    for (const ch of myChannels) {
        // 채널 정보 갱신
        const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${ch.id}`;
        const data = await fetchYoutubeApi(url);
        if (data.items.length > 0) {
            const stats = data.items[0].statistics;
            ch.subscriberCount = Number(stats.subscriberCount || 0);
            ch.viewCount = Number(stats.viewCount || 0);
        }

        // 돌연변이 영상 Top3
        const vids = await getMutantTop3(ch.uploadsPlaylistId, ch.subscriberCount);
        ch.mutantVideos = vids;

        // 유효시청시간 오늘값이 없으면 이전값 복사
        if (!ch.watchTimes) ch.watchTimes = {};
        if (!(todayKey in ch.watchTimes)) {
            const prevKey = Object.keys(ch.watchTimes).sort().pop();
            ch.watchTimes[todayKey] = prevKey ? ch.watchTimes[prevKey] : '';
        }
    }
    saveMyChannels();
}

// ---- 돌연변이 Top3 ----
async function getMutantTop3(playlistId, subscriberCount) {
    // 최근 100개까지만 조회 (성능/할당량 고려)
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`;
    const data = await fetchYoutubeApi(url);
    const ids = data.items.map(item => item.contentDetails.videoId);

    const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}`;
    const details = await fetchYoutubeApi(detailUrl);

    const videos = details.items.map(item => {
        const fallbackThumb = `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`;
        const thumbs = item.snippet.thumbnails || {};
        const thumbnail =
            thumbs.medium?.url ||
            thumbs.high?.url ||
            thumbs.default?.url ||
            fallbackThumb;
        const viewCount = Number(item.statistics.viewCount || 0);
        const mutantIndex = calculateMutantIndex(viewCount, subscriberCount);

        return {
            id: item.id,
            title: item.snippet.title,
            thumbnail,
            viewCount,
            publishedAt: item.snippet.publishedAt,
            mutantIndex
        };
    });
    videos.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
    return videos.slice(0, 3);
}

// ---- 렌더링 ----
function renderMyChannelList() {
    myChannelList.innerHTML = '';
    if (myChannels.length === 0) {
        myChannelList.innerHTML = `<div style="text-align:center; margin:40px;">채널을 추가해 주세요.</div>`;
        return;
    }

    // 3개씩 가로배열
    const group = [];
    for (let i = 0; i < myChannels.length; i += 3) {
        group.push(myChannels.slice(i, i + 3));
    }

    group.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'my-channel-row';
        row.forEach(ch => {
            const todayKey = getTodayKey();
            const yesterdayKey = moment(todayKey).subtract(1, 'days').format('YYYY-MM-DD');

            // 변화량 계산
            const subDiff = ch.subscriberCount - (ch.prevSubscriberCount || ch.subscriberCount);
            const viewDiff = ch.viewCount - (ch.prevViewCount || ch.viewCount);

            // 유효시청시간
            const watchYesterday = ch.watchTimes?.[yesterdayKey] || '';
            const watchToday = ch.watchTimes?.[todayKey] || '';
            const watchDiff = (watchToday && watchYesterday) ? (parseInt(watchToday) - parseInt(watchYesterday)) : '';

            rowDiv.innerHTML += `
                <div class="my-channel-card">
                    <div class="channel-info">
                        <img src="${ch.logo}" class="my-channel-logo">
                        <div class="my-channel-title">${ch.name}</div>
                    </div>
                    <div class="my-channel-stats">
                        <div>구독자수: ${ch.subscriberCount.toLocaleString()}<span class="stats-diff">${subDiff ? ` (+${subDiff.toLocaleString()})` : ''}</span></div>
                        <div>총조회수: ${ch.viewCount.toLocaleString()}<span class="stats-diff">${viewDiff ? ` (+${viewDiff.toLocaleString()})` : ''}</span></div>
                    </div>
                    <div class="my-watchtime-block">
                        <div>유효시청시간(어제): <span>${watchYesterday}</span></div>
                        <div>
                            유효시청시간(오늘): 
                            <input type="number" min="0" step="1" value="${watchToday}" data-channel-id="${ch.id}" class="my-watchtime-input" style="width: 90px; margin-left:4px;">
                            <span class="stats-diff">${watchDiff ? ` (+${watchDiff})` : ''}</span>
                        </div>
                    </div>
                    <div class="mutant-top3">
                        <div class="mutant-top3-title">돌연변이 TOP3 영상</div>
                        <div class="mutant-videos-row">
                            ${ch.mutantVideos && ch.mutantVideos.length > 0 ? ch.mutantVideos.map(v => `
                                <div class="mutant-video-card">
                                    <img src="${v.thumbnail}" class="mutant-thumb">
                                    <div class="mutant-title">${v.title}</div>
                                    <div class="mutant-meta">
                                        <span class="mutant-views">${v.viewCount.toLocaleString()}회</span>
                                        <span class="mutant-index"><b>${v.mutantIndex}</b></span>
                                    </div>
                                </div>
                            `).join('') : `<div>없음</div>`}
                        </div>
                    </div>
                </div>
            `;
        });
        myChannelList.appendChild(rowDiv);
    });

    // 유효시청시간 입력 핸들링
    setTimeout(() => {
        document.querySelectorAll('.my-watchtime-input').forEach(inp => {
            inp.onchange = function() {
                const chId = this.getAttribute('data-channel-id');
                const value = this.value;
                const ch = myChannels.find(c => c.id === chId);
                const todayKey = getTodayKey();
                if (ch) {
                    if (!ch.watchTimes) ch.watchTimes = {};
                    ch.watchTimes[todayKey] = value;
                    saveMyChannels();
                    renderMyChannelList();
                }
            };
            // 입력시 폼 submit 막기
            inp.form && inp.form.addEventListener('submit', e => e.preventDefault());
        });
    }, 100);
}
