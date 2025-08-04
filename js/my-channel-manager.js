// js/my-channel-manager.js

import { fetchYoutubeApi, loadApiKeys, saveApiKeys, downloadApiKeys } from './js/api_keys.js';
import { isLongform, calculateMutantIndex } from './js/utils.js';

// DOM 요소 캐싱
const myChannelList = document.getElementById('my-channel-list');
const myChannelCount = document.getElementById('my-channel-count');
const myAddChannelBtn = document.getElementById('my-add-channel-btn');
const myTrackBtn = document.getElementById('my-track-btn');

// 검색 모달 관련
const searchModal = document.getElementById('my-channel-search-modal');
const searchResults = document.getElementById('my-channel-search-results');
const searchPagination = document.getElementById('my-pagination');
const closeButton = searchModal.querySelector('.close-button');

// 공통 데이터
let myChannels = [];
let mySearchResults = [];
let currentSearchPage = 1;
const SEARCH_PER_PAGE = 5;

// 채널 정보 변화량 기록
let myChannelSnapshots = {}; // {channelId: [{date, subscriber, view, watchTime}]}

document.addEventListener('DOMContentLoaded', () => {
    loadMyChannels();
    renderMyChannelList();
    setupEventListeners();
});

// 이벤트 리스너
function setupEventListeners() {
    myAddChannelBtn.addEventListener('click', handleAddChannel);
    myTrackBtn.addEventListener('click', handleTracking);

    closeButton.addEventListener('click', () => {
        searchModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === searchModal) searchModal.style.display = 'none';
    });

    // 탭 이동 (공통탭)
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.dataset.tab === 'my-channel-manager') return;
            // 페이지 이동
            if (btn.dataset.tab === 'channel-monitor') {
                window.location.href = 'index.html';
            }
            // 다른 기능은 추후 확장
        });
    });

    // API키 모달 열기 (공통)
    document.getElementById('open-api-key-popup').addEventListener('click', openApiKeyModal);
}

// 채널 목록 로드
function loadMyChannels() {
    try {
        const raw = localStorage.getItem('myChannels');
        myChannels = raw ? JSON.parse(raw) : [];
        const snapRaw = localStorage.getItem('myChannelSnapshots');
        myChannelSnapshots = snapRaw ? JSON.parse(snapRaw) : {};
    } catch {
        myChannels = [];
        myChannelSnapshots = {};
    }
}

// 채널 목록 저장
function saveMyChannels() {
    localStorage.setItem('myChannels', JSON.stringify(myChannels));
}
function saveMySnapshots() {
    localStorage.setItem('myChannelSnapshots', JSON.stringify(myChannelSnapshots));
}

// 채널 추가 핸들러
async function handleAddChannel() {
    const keyword = prompt('추가할 채널명을 입력하세요:');
    if (!keyword) return;

    // 페이징 지원 검색
    await searchChannelPaginated(keyword, 1);
}

// 채널 검색 + 페이지네이션
async function searchChannelPaginated(keyword, page) {
    let apiKeyArr = loadApiKeys().filter(Boolean);
    let pageToken = '';
    let allResults = [];
    let totalFetched = 0;
    let reachedEnd = false;

    // 최대 50개까지 한 번에!
    while (!reachedEnd && allResults.length < 50) {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(keyword)}&maxResults=50${pageToken ? '&pageToken=' + pageToken : ''}`;
        const data = await fetchYoutubeApi(url);
        allResults = allResults.concat(data.items);
        totalFetched += data.items.length;
        if (data.nextPageToken) {
            pageToken = data.nextPageToken;
        } else {
            reachedEnd = true;
        }
    }
    mySearchResults = allResults;
    currentSearchPage = page;
    displaySearchResultsPaginated();
    searchModal.style.display = 'block';
}

// 검색 결과 표시 + 페이징
function displaySearchResultsPaginated() {
    searchResults.innerHTML = '';
    searchPagination.innerHTML = '';

    const startIdx = (currentSearchPage - 1) * SEARCH_PER_PAGE;
    const pageResults = mySearchResults.slice(startIdx, startIdx + SEARCH_PER_PAGE);

    pageResults.forEach(item => {
        const channelId = item.id.channelId;
        const channelTitle = item.snippet.title;
        const channelLogo = item.snippet.thumbnails.default.url;
        const alreadyAdded = myChannels.some(ch => ch.id === channelId);

        const el = document.createElement('div');
        el.className = 'channel-item';
        el.innerHTML = `
            <div class="channel-info-wrapper">
                <img src="${channelLogo}" alt="${channelTitle} 로고" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;">
                <span>${channelTitle}</span>
                ${alreadyAdded ? '<span style="margin-left:10px;color:#c4302b;font-weight:bold;">(이미 등록됨)</span>' : ''}
            </div>
        `;
        if (!alreadyAdded) {
            el.addEventListener('click', async () => {
                await addMyChannel(channelId);
                searchModal.style.display = 'none';
            });
            el.style.cursor = 'pointer';
        }
        searchResults.appendChild(el);
    });

    // 페이지네이션 버튼
    const totalPages = Math.ceil(mySearchResults.length / SEARCH_PER_PAGE);
    if (totalPages > 1) {
        // Prev
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '이전';
        prevBtn.disabled = currentSearchPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentSearchPage > 1) {
                currentSearchPage--;
                displaySearchResultsPaginated();
            }
        });
        searchPagination.appendChild(prevBtn);

        // 숫자버튼 (최대 3개만)
        let start = Math.max(1, currentSearchPage - 1);
        let end = Math.min(totalPages, start + 2);
        if (end - start < 2) start = Math.max(1, end - 2);
        for (let p = start; p <= end; p++) {
            const btn = document.createElement('button');
            btn.textContent = p;
            btn.className = (p === currentSearchPage) ? 'active' : '';
            btn.addEventListener('click', () => {
                currentSearchPage = p;
                displaySearchResultsPaginated();
            });
            searchPagination.appendChild(btn);
        }

        // Next
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '다음';
        nextBtn.disabled = currentSearchPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentSearchPage < totalPages) {
                currentSearchPage++;
                displaySearchResultsPaginated();
            }
        });
        searchPagination.appendChild(nextBtn);
    }
}

// 실제 채널 추가
async function addMyChannel(channelId) {
    // 중복 방지
    if (myChannels.some(ch => ch.id === channelId)) {
        alert('이미 등록된 채널입니다.');
        return;
    }
    try {
        const channelDetails = await getMyChannelDetails(channelId);
        myChannels.push(channelDetails);
        saveMyChannels();
        renderMyChannelList();
    } catch {
        alert('채널 정보를 가져오는데 실패했습니다.');
    }
}

// 채널 상세정보
async function getMyChannelDetails(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const item = data.items[0];
    return {
        id: channelId,
        name: item.snippet.title,
        logo: item.snippet.thumbnails.default.url,
        subscriberCount: Number(item.statistics.subscriberCount),
        viewCount: Number(item.statistics.viewCount),
        uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
        watchTime: 0 // 유효시청시간은 직접 입력!
    };
}

// 추적시작 버튼 클릭
function handleTracking() {
    // 오늘 날짜
    const today = moment().tz('Asia/Seoul').format('YYYY-MM-DD');
    myChannels.forEach(async (channel, i) => {
        // fetch 최신 데이터
        try {
            const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channel.id}`;
            const data = await fetchYoutubeApi(url);
            const stats = data.items[0].statistics;

            // 변화량 기록
            if (!myChannelSnapshots[channel.id]) myChannelSnapshots[channel.id] = [];
            myChannelSnapshots[channel.id].push({
                date: today,
                subscriber: Number(stats.subscriberCount),
                view: Number(stats.viewCount),
                watchTime: channel.watchTime // 현재 입력값
            });
            saveMySnapshots();

            // 최신값 적용
            channel.subscriberCount = Number(stats.subscriberCount);
            channel.viewCount = Number(stats.viewCount);

            // UI 갱신
            renderMyChannelList();
        } catch (e) {
            console.error('채널 정보 fetch 오류', e);
        }
    });
}

// 채널 리스트 렌더링
function renderMyChannelList() {
    myChannelList.innerHTML = '';
    myChannelCount.textContent = myChannels.length;
    if (myChannels.length === 0) {
        myChannelList.innerHTML = '<div class="empty">채널을 추가해주세요.</div>';
        return;
    }

    // 3개씩 가로 배치
    let rowDiv;
    myChannels.forEach((ch, idx) => {
        if (idx % 3 === 0) {
            rowDiv = document.createElement('div');
            rowDiv.className = 'my-channel-row';
            myChannelList.appendChild(rowDiv);
        }
        const chDiv = document.createElement('div');
        chDiv.className = 'my-channel-card';
        chDiv.innerHTML = `
            <div class="my-channel-header">
                <img src="${ch.logo}" alt="${ch.name} 로고" class="my-channel-logo">
                <span class="my-channel-name">${ch.name}</span>
                <button class="my-delete-btn" data-id="${ch.id}">삭제</button>
            </div>
            <div class="my-channel-body">
                <div class="my-channel-stats">
                    <div>구독자: <span class="my-subs">${ch.subscriberCount.toLocaleString()}</span></div>
                    <div>조회수: <span class="my-views">${ch.viewCount.toLocaleString()}</span></div>
                </div>
                <div class="my-watchtime-box">
                    <label>
                        어제 유효시청시간
                        <input type="number" class="my-watchtime-input" data-id="${ch.id}" data-when="yesterday" min="0" step="1" value="${getWatchTime(ch.id, 'yesterday') ?? ''}" />
                    </label>
                    <label>
                        오늘 유효시청시간
                        <input type="number" class="my-watchtime-input" data-id="${ch.id}" data-when="today" min="0" step="1" value="${getWatchTime(ch.id, 'today') ?? ''}" />
                    </label>
                </div>
                <div class="my-channel-delta">
                    <span>전일 대비 구독자: ${getDelta(ch.id, 'subscriber')}</span>
                    <span>전일 대비 조회수: ${getDelta(ch.id, 'view')}</span>
                    <span>전일 대비 유효시청시간: ${getDelta(ch.id, 'watchTime')}</span>
                </div>
            </div>
            <div class="my-channel-top3-title">돌연변이 TOP3</div>
            <div class="my-channel-top3-list" id="top3-${ch.id}">
                <div class="top3-loading">로딩 중...</div>
            </div>
        `;
        rowDiv.appendChild(chDiv);

        // Top3 영상
        renderMutantTop3(ch, chDiv.querySelector('.my-channel-top3-list'));
    });

    // 삭제 버튼 리스너
    myChannelList.querySelectorAll('.my-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            myChannels = myChannels.filter(ch => ch.id !== id);
            saveMyChannels();
            renderMyChannelList();
        });
    });

    // 유효시청시간 입력 리스너 (어제/오늘)
    myChannelList.querySelectorAll('.my-watchtime-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const id = input.dataset.id;
            const when = input.dataset.when;
            let snapshots = myChannelSnapshots[id] || [];
            const today = moment().tz('Asia/Seoul').format('YYYY-MM-DD');
            if (when === 'today') {
                // 오늘꺼는 snapshot에 당일 것 있으면 갱신, 없으면 추가
                let snap = snapshots.find(s => s.date === today);
                if (!snap) {
                    snap = { date: today, subscriber: 0, view: 0, watchTime: 0 };
                    snapshots.push(snap);
                }
                snap.watchTime = parseInt(input.value, 10) || 0;
            } else if (when === 'yesterday') {
                const yest = moment().tz('Asia/Seoul').subtract(1, 'day').format('YYYY-MM-DD');
                let snap = snapshots.find(s => s.date === yest);
                if (!snap) {
                    snap = { date: yest, subscriber: 0, view: 0, watchTime: 0 };
                    snapshots.push(snap);
                }
                snap.watchTime = parseInt(input.value, 10) || 0;
            }
            myChannelSnapshots[id] = snapshots;
            saveMySnapshots();
            renderMyChannelList();
        });
    });
}

// Top3 돌연변이 영상
async function renderMutantTop3(channel, container) {
    try {
        // 영상 리스트 fetch
        const ids = await getChannelVideoIds(channel.uploadsPlaylistId, 30); // 최근 30개만
        const details = await getVideoDetails(ids);
        const list = details
            .map(v => ({
                ...v,
                mutantIndex: calculateMutantIndex(v.viewCount, channel.subscriberCount)
            }))
            .filter(v => parseFloat(v.mutantIndex) >= 2.0 && isLongform(v.duration))
            .sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex))
            .slice(0, 3);

        container.innerHTML = '';
        if (!list.length) {
            container.innerHTML = '<div class="top3-empty">돌연변이 영상 없음</div>';
            return;
        }
        list.forEach(v => {
            const el = document.createElement('div');
            el.className = 'my-top3-card';
            el.innerHTML = `
                <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank">
                    <div class="my-top3-thumb"><img src="${v.thumbnail}" alt="썸네일"></div>
                </a>
                <div class="my-top3-title">${v.title}</div>
                <div class="my-top3-meta">
                    <span class="my-top3-views">조회수: ${parseInt(v.viewCount).toLocaleString()}</span>
                    <span class="my-top3-mutant"> ${v.mutantIndex} </span>
                </div>
            `;
            container.appendChild(el);
        });
    } catch {
        container.innerHTML = '<div class="top3-error">영상 불러오기 실패</div>';
    }
}

// 최근 N개 영상의 videoId 리스트 얻기
async function getChannelVideoIds(playlistId, max = 30) {
    let ids = [];
    let nextPageToken = null;
    while (ids.length < max) {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${playlistId}${nextPageToken ? '&pageToken=' + nextPageToken : ''}`;
        const data = await fetchYoutubeApi(url);
        ids = ids.concat(data.items.map(item => item.contentDetails.videoId));
        if (!data.nextPageToken || ids.length >= max) break;
        nextPageToken = data.nextPageToken;
    }
    return ids.slice(0, max);
}

// 상세 정보 + 썸네일 fallback
const videoDetailCache = {};
async function getVideoDetails(ids) {
    const uncached = ids.filter(id => !videoDetailCache[id]);
    if (uncached.length) {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${uncached.join(',')}`;
        const data = await fetchYoutubeApi(url);
        data.items.forEach(item => {
            const th = item.snippet.thumbnails || {};
            const fallback = `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`;
            videoDetailCache[item.id] = {
                id: item.id,
                title: item.snippet.title,
                thumbnail: th.medium?.url || th.high?.url || th.default?.url || fallback,
                viewCount: item.statistics.viewCount,
                publishedAt: item.snippet.publishedAt,
                duration: item.contentDetails.duration
            };
        });
    }
    return ids.map(id => videoDetailCache[id]).filter(Boolean);
}

// 어제/오늘 유효시청시간
function getWatchTime(channelId, when = 'today') {
    const arr = myChannelSnapshots[channelId] || [];
    let date;
    if (when === 'today') {
        date = moment().tz('Asia/Seoul').format('YYYY-MM-DD');
    } else {
        date = moment().tz('Asia/Seoul').subtract(1, 'day').format('YYYY-MM-DD');
    }
    const snap = arr.find(a => a.date === date);
    return snap?.watchTime ?? '';
}

// 변화량 계산
function getDelta(channelId, type) {
    const arr = myChannelSnapshots[channelId] || [];
    if (arr.length < 2) return '0';
    arr.sort((a, b) => a.date.localeCompare(b.date));
    const prev = arr[arr.length - 2];
    const curr = arr[arr.length - 1];
    if (!prev || !curr) return '0';
    if (type === 'subscriber') {
        return (curr.subscriber - prev.subscriber).toLocaleString();
    }
    if (type === 'view') {
        return (curr.view - prev.view).toLocaleString();
    }
    if (type === 'watchTime') {
        return (curr.watchTime - prev.watchTime).toLocaleString();
    }
    return '0';
}

// ---------- API KEY 모달 공통 코드 (index.html과 동일) ----------
function openApiKeyModal() {
    let modal = document.getElementById('api-key-modal');
    if (!modal) {
        // 모달이 없다면 생성 (최초 진입시)
        modal = document.createElement('div');
        modal.id = 'api-key-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <h2>API 키 입력</h2>
                <p>5개의 API 키를 입력하거나, 텍스트 파일로 업로드하세요.</p>
                <div id="api-key-inputs">
                    <input type="text" class="api-key-input" placeholder="API Key 1">
                    <input type="text" class="api-key-input" placeholder="API Key 2">
                    <input type="text" class="api-key-input" placeholder="API Key 3">
                    <input type="text" class="api-key-input" placeholder="API Key 4">
                    <input type="text" class="api-key-input" placeholder="API Key 5">
                </div>
                <label for="api-key-file-upload" class="file-upload-label">
                    텍스트 파일로 업로드
                    <input type="file" id="api-key-file-upload" accept=".txt">
                </label>
                <button id="save-api-keys">저장</button>
                <button id="download-api-keys">API 키 다운로드</button>
            </div>
        `;
        document.body.appendChild(modal);

        // 이벤트 연결 (중복 연결 방지)
        modal.querySelector('.close-button').onclick = () => { modal.style.display = 'none'; };
        modal.querySelector('#save-api-keys').onclick = () => {
            const keys = Array.from(document.querySelectorAll('.api-key-input')).map(i => i.value);
            if (saveApiKeys(keys)) {
                modal.style.display = 'none';
                alert('API 키가 저장되었습니다!');
            }
        };
        modal.querySelector('#download-api-keys').onclick = downloadApiKeys;
        modal.querySelector('#api-key-file-upload').onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    const keys = ev.target.result.split('\n').map(k => k.trim());
                    if (saveApiKeys(keys)) {
                        modal.style.display = 'none';
                        alert('API 키가 파일에서 성공적으로 로드되었습니다!');
                    }
                };
                reader.readAsText(file);
            }
        };
        window.onclick = (event) => { if (event.target === modal) modal.style.display = 'none'; };
    }
    // 기존 값 채우기
    const storedKeys = loadApiKeys();
    modal.querySelectorAll('.api-key-input').forEach((input, idx) => {
        input.value = storedKeys[idx] || '';
    });
    modal.style.display = 'block';
}
