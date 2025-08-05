// js/my_channel_manager.js
import { fetchYoutubeApi } from './api_keys.js';
import { renderLatestThumbnailsList } from './channel-monitor.js';

// IndexedDB 설정
const DB_NAME = 'myChannelDB';
const DB_VERSION = 1;
let db = null;
function openDB() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function(e) {
            db = e.target.result;
            if (!db.objectStoreNames.contains('my_channels')) {
                const store = db.createObjectStore('my_channels', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('watchtimes')) {
                db.createObjectStore('watchtimes', { keyPath: ['channelId', 'date'] });
            }
        };
        req.onsuccess = function(e) { db = e.target.result; resolve(db); };
        req.onerror = function(e) { alert('IndexedDB 열기 오류'); reject(e); };
    });
}
function idbGetAll(storeName) { return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly'); const store = tx.objectStore(storeName);
    const req = store.getAll(); req.onsuccess = () => resolve(req.result); req.onerror = e => reject(e);
})); }
function idbPut(storeName, data) { return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite'); const store = tx.objectStore(storeName);
    const req = store.put(data); req.onsuccess = () => resolve(); req.onerror = e => reject(e);
})); }
function idbDelete(storeName, key) { return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite'); const store = tx.objectStore(storeName);
    const req = store.delete(key); req.onsuccess = () => resolve(); req.onerror = e => reject(e);
})); }


document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('my-channel-search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('search-my-channel-btn').click();
        }
    });

    document.getElementById('search-my-channel-btn').addEventListener('click', async () => {
        const query = document.getElementById('my-channel-search-input').value.trim();
        if (query) {
            await searchAndRenderChannels(query);
        }
    });

    document.getElementById('save-my-channel-btn').addEventListener('click', async () => {
        const input = document.getElementById('my-channel-id-input').value.trim();
        if (input) {
            const channelId = getChannelIdFromInput(input);
            if (channelId) {
                await fetchAndSaveMyChannel(channelId);
            } else {
                alert('유효한 채널 ID 또는 URL을 입력해주세요.');
            }
        }
    });

    document.getElementById('mutant-period-select').addEventListener('change', (e) => {
        const period = e.target.value;
        localStorage.setItem('myChannelMutantPeriod', period);
        renderMutantVideos(period);
    });

    document.getElementById('analyze-all-channels-btn').addEventListener('click', async () => {
        const period = localStorage.getItem('myChannelMutantPeriod') || '6m';
        await analyzeAllMutantVideos(period);
    });

    // watchtime modal event listeners
    const watchtimeModal = document.getElementById('watchtime-modal');
    document.getElementById('close-watchtime-modal').addEventListener('click', () => {
        watchtimeModal.style.display = 'none';
    });
    document.getElementById('save-watchtime-btn').addEventListener('click', saveOrUpdateWatchtime);
    document.getElementById('delete-watchtime-btn').addEventListener('click', deleteWatchtime);
});

// 1. 내 채널 목록을 렌더링
export async function renderMyChannels() {
    const channels = await idbGetAll('my_channels');
    const container = document.getElementById('my-channel-list');
    container.innerHTML = '';
    const sortedChannels = sortChannelsByOrder(channels);
    if (sortedChannels.length === 0) {
        container.innerHTML = '<p style="text-align:center;">아직 등록된 채널이 없습니다.</p>';
        return;
    }

    // 채널 카드 생성
    sortedChannels.forEach(channel => {
        const card = document.createElement('div');
        card.className = 'my-channel-card';
        card.dataset.channelId = channel.id;
        card.innerHTML = `
            <button class="remove-btn" style="position: absolute; top:12px; right: 12px; z-index:1;" data-channel-id="${channel.id}">삭제</button>
            <div class="my-channel-info-row">
                <img src="${channel.thumbnail}" alt="채널 썸네일" class="my-channel-thumb">
                <div class="my-channel-info-text">
                    <div class="my-channel-title">${channel.title}</div>
                    <div class="my-channel-meta">
                        구독자수: ${parseInt(channel.subscriberCount).toLocaleString()}명
                        <span class="diff-indicator diff-up">(+${(Math.random() * 100).toFixed(0)})</span>
                    </div>
                    <div class="my-channel-meta">
                        총 영상수: ${parseInt(channel.videoCount).toLocaleString()}개
                    </div>
                    <div class="my-channel-actions">
                        <button class="edit-watchtime-btn" data-channel-id="${channel.id}">시청시간 입력/수정</button>
                        <button class="analyze-btn" data-channel-id="${channel.id}">돌연변이 영상 분석</button>
                        <button class="view-latest-btn" data-channel-id="${channel.id}">최근 썸네일 보기</button>
                    </div>
                </div>
            </div>
            <div class="my-channel-mutant-section" style="display: none;">
                <div class="my-channel-mutant-title">돌연변이 영상 TOP3</div>
                <div class="my-channel-mutant-list"></div>
            </div>
        `;
        container.appendChild(card);
    });

    // 드래그앤드랍 활성화
    enableSortable();

    // 이벤트 리스너 추가
    container.querySelectorAll('.remove-btn').forEach(btn => btn.addEventListener('click', removeMyChannel));
    container.querySelectorAll('.analyze-btn').forEach(btn => btn.addEventListener('click', analyzeMutantVideos));
    container.querySelectorAll('.edit-watchtime-btn').forEach(btn => btn.addEventListener('click', openWatchtimeModal));
    container.querySelectorAll('.view-latest-btn').forEach(btn => btn.addEventListener('click', showLatestThumbnails));
}

// 2. 검색 및 렌더링
async function searchAndRenderChannels(query) {
    const apiKey = getApiKey();
    if (!apiKey) {
        alert('API 키를 입력해주세요.');
        return;
    }
    const resultsDiv = document.getElementById('my-channel-search-results');
    resultsDiv.innerHTML = '<p>검색 중...</p>';
    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        resultsDiv.innerHTML = '';
        if (data.items && data.items.length > 0) {
            data.items.forEach(item => {
                const channelId = item.id.channelId;
                const title = item.snippet.title;
                const thumb = item.snippet.thumbnails.default.url;
                const div = document.createElement('div');
                div.className = 'channel-item-search-row';
                div.innerHTML = `
                    <img src="${thumb}" alt="${title}" class="channel-search-thumb">
                    <span class="channel-search-title">${title}</span>
                    <button class="channel-register-btn" data-channel-id="${channelId}">등록</button>
                `;
                resultsDiv.appendChild(div);
                div.querySelector('.channel-register-btn').addEventListener('click', async () => {
                    await fetchAndSaveMyChannel(channelId);
                    resultsDiv.innerHTML = ''; // 등록 후 검색 결과 초기화
                    document.getElementById('my-channel-search-input').value = '';
                });
            });
        } else {
            resultsDiv.innerHTML = '<p>검색 결과가 없습니다.</p>';
        }
    } catch (e) {
        resultsDiv.innerHTML = '<p>검색 중 오류가 발생했습니다.</p>';
        console.error(e);
    }
}

// 3. 채널 정보 불러와서 IndexedDB에 저장
async function fetchAndSaveMyChannel(channelId) {
    const apiKey = getApiKey();
    if (!apiKey) return;
    try {
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
        const data = await fetchYoutubeApi(url);
        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            const channelData = {
                id: item.id,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.medium.url,
                subscriberCount: item.statistics.subscriberCount,
                videoCount: item.statistics.videoCount,
                customName: item.snippet.title
            };
            await idbPut('my_channels', channelData);
            alert(`${channelData.title} 채널이 등록되었습니다.`);
            renderMyChannels();
        } else {
            alert('채널 정보를 찾을 수 없습니다.');
        }
    } catch (e) {
        console.error(e);
        alert('채널 정보 등록 중 오류 발생');
    }
}

// 4. 채널 삭제
async function removeMyChannel(e) {
    if (confirm('채널을 삭제하시겠습니까?')) {
        const channelId = e.target.dataset.channelId;
        await idbDelete('my_channels', channelId);
        // 관련 시청시간 데이터도 삭제
        await openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction('watchtimes', 'readwrite');
            const store = tx.objectStore('watchtimes');
            const index = store.index('channelId');
            const req = index.openCursor(IDBKeyRange.only(channelId));
            req.onsuccess = e => {
                const cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            req.onerror = e => reject(e);
        }));
        renderMyChannels();
    }
}

// 5. 돌연변이 영상 분석
async function analyzeMutantVideos(e) {
    const channelId = e.target.dataset.channelId;
    const period = localStorage.getItem('myChannelMutantPeriod') || '6m';
    await fetchMutantVideos(channelId, period, false);
}

// 6. 모든 채널 돌연변이 영상 분석
async function analyzeAllMutantVideos(period) {
    const channels = await idbGetAll('my_channels');
    for (const channel of channels) {
        await fetchMutantVideos(channel.id, period, true);
    }
}

// 7. 돌연변이 영상 데이터 가져와서 렌더링
async function fetchMutantVideos(channelId, period, isAll) {
    const apiKey = getApiKey();
    if (!apiKey) return;
    const channel = (await idbGetAll('my_channels')).find(c => c.id === channelId);
    if (!channel) return;

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=50&order=viewCount&type=video&key=${apiKey}`;
        const data = await fetchYoutubeApi(url);
        if (data.items && data.items.length > 0) {
            const videoIds = data.items.map(item => item.id.videoId).join(',');
            const videoStatsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}&key=${apiKey}`;
            const statsData = await fetchYoutubeApi(videoStatsUrl);

            const videos = statsData.items.map(item => {
                const viewCount = parseInt(item.statistics.viewCount) || 0;
                const subscriberCount = parseInt(channel.subscriberCount) || 0;
                const mutantIndex = subscriberCount > 0 ? (viewCount / subscriberCount) : 0;
                return {
                    id: item.id,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.high.url,
                    viewCount: viewCount,
                    publishedAt: item.snippet.publishedAt,
                    mutantIndex: mutantIndex
                };
            }).filter(video => video.mutantIndex > 1.5).sort((a,b) => b.mutantIndex - a.mutantIndex).slice(0, 3);
            
            renderMutantVideos(channelId, videos, isAll);
        }
    } catch (e) {
        console.error(e);
    }
}

// 8. 돌연변이 영상 목록을 렌더링
function renderMutantVideos(channelId, videos, isAll) {
    const container = document.querySelector(`.my-channel-card[data-channel-id="${channelId}"] .my-channel-mutant-list`);
    const section = document.querySelector(`.my-channel-card[data-channel-id="${channelId}"] .my-channel-mutant-section`);
    if (!container || !section) return;

    if (videos.length > 0) {
        section.style.display = 'block';
        container.innerHTML = videos.map(video => `
            <div class="thumbnail-card">
                <img src="${video.thumbnail}" style="width:100%; aspect-ratio:16/9; height:auto; object-fit:contain; background:#eee; border-radius:7px;" alt="썸네일">
                <div class="my-channel-mutant-title2">${video.title}</div>
                <div class="my-channel-mutant-extra">
                    <span class="my-channel-mutant-views">조회수: ${video.viewCount.toLocaleString()}회</span>
                    <span class="my-channel-mutant-date">${moment(video.publishedAt).format('YYYY-MM-DD')}</span>
                </div>
                <div class="mutant-index-badge">${video.mutantIndex.toFixed(2)}</div>
            </div>
        `).join('');
    } else {
        section.style.display = 'none';
    }
}

// 9. 시청시간 입력 모달 열기
async function openWatchtimeModal(e) {
    const channelId = e.target.dataset.channelId;
    document.getElementById('watchtime-modal').style.display = 'flex';
    document.getElementById('watchtime-modal').dataset.channelId = channelId;
    document.getElementById('save-watchtime-btn').dataset.channelId = channelId;

    const today = moment().format('YYYY-MM-DD');
    document.getElementById('watchtime-date-input').value = today;
    document.getElementById('watchtime-hours-input').value = '';
    document.getElementById('delete-watchtime-btn').style.display = 'none';
}

// 10. 시청시간 저장 또는 수정
async function saveOrUpdateWatchtime() {
    const channelId = document.getElementById('watchtime-modal').dataset.channelId;
    const date = document.getElementById('watchtime-date-input').value;
    const hours = document.getElementById('watchtime-hours-input').value;

    if (!date || !hours || hours < 0) {
        alert('날짜와 유효한 시청시간을 입력해주세요.');
        return;
    }

    const data = {
        channelId: channelId,
        date: date,
        hours: parseInt(hours)
    };

    await idbPut('watchtimes', data);
    alert('시청시간이 저장되었습니다.');
    document.getElementById('watchtime-modal').style.display = 'none';
}

// 11. 시청시간 삭제
async function deleteWatchtime() {
    const channelId = document.getElementById('watchtime-modal').dataset.channelId;
    const date = document.getElementById('watchtime-date-input').value;
    await idbDelete('watchtimes', [channelId, date]);
    alert('시청시간이 삭제되었습니다.');
    document.getElementById('watchtime-modal').style.display = 'none';
}

async function showLatestThumbnails(e) {
    const channelId = e.target.dataset.channelId;
    const channels = await idbGetAll('my_channels');
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;
    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=10&order=date&type=video&key=${getApiKey()}`;
        const data = await fetchYoutubeApi(url);
        if (data.items) {
            const thumbnails = data.items.map(item => ({
                id: item.id.videoId,
                src: item.snippet.thumbnails.medium.url,
                alt: item.snippet.title
            }));
            renderLatestThumbnailsList(thumbnails);
        }
    } catch(e) {
        console.error(e);
        alert('최근 썸네일 불러오기 실패');
    }
}

// 채널 ID 유효성 검사 및 추출
function getChannelIdFromInput(input) {
    if (input.startsWith('UC') && input.length === 24) return input;
    let m = input.match(/channel\/(UC[\w-]{22,})/);
    if (m) return m[1];
    return null;
}

// 탭 첫 진입시 렌더링
if (document.querySelector('.tab-button.active')?.dataset.tab === 'my-channel-manager') {
    renderMyChannels();
}

export {};

// ① 순서정보 저장: 현재 DOM순서대로 id 배열을 localStorage에 저장
function saveChannelOrder() {
    const cardDivs = document.querySelectorAll('#my-channel-list .my-channel-card');
    const order = Array.from(cardDivs).map(div => div.dataset.channelId);
    localStorage.setItem('myChannelOrder', JSON.stringify(order));
}

// ② 순서정보 읽어서, 정렬된 배열로 반환
function sortChannelsByOrder(channels) {
    const order = JSON.parse(localStorage.getItem('myChannelOrder') || '[]');
    if (!order.length) return channels;
    // order에 따라 channels를 정렬, 없는 건 뒤로
    return channels.slice().sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

// ③ 드래그앤드랍 활성화
function enableSortable() {
    const el = document.getElementById('my-channel-list');
    if (!el || el.classList.contains('sortable-enabled')) return;
    new Sortable(el, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function(evt) {
            saveChannelOrder();
        }
    });
    el.classList.add('sortable-enabled');
}
