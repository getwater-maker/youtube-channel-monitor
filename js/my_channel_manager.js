// js/my_channel_manager.js
import { fetchYoutubeApi } from './api_keys.js';

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
    const req = store.put(data); req.onsuccess = () => resolve(req.result); req.onerror = e => reject(e);
})); }
function idbDelete(storeName, key) { return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite'); const store = tx.objectStore(storeName);
    const req = store.delete(key); req.onsuccess = () => resolve(); req.onerror = e => reject(e);
})); }

// DOM
const myChannelListDiv = document.getElementById('my-channel-list');
const addMyChannelBtn = document.getElementById('add-my-channel-btn');
const analyzeAllBtn = document.getElementById('analyze-all-channels-btn');
const mutantPeriodSelect = document.getElementById('mutant-period-select');
const addMyChannelModal = document.getElementById('add-my-channel-modal');
const closeAddMyChannelModalBtn = document.getElementById('close-add-my-channel-modal');
const myChannelIdInput = document.getElementById('my-channel-id-input');
const saveMyChannelBtn = document.getElementById('save-my-channel-btn');
const myChannelSearchInput = document.getElementById('my-channel-search-input');
const myChannelSearchBtn = document.getElementById('search-my-channel-btn');
const myChannelSearchResults = document.getElementById('my-channel-search-results');

// 시청시간 입력 모달
const watchtimeModal = document.getElementById('watchtime-modal');
const closeWatchtimeModalBtn = document.getElementById('close-watchtime-modal');
const watchtimeDateInput = document.getElementById('watchtime-date-input');
const watchtimeHoursInput = document.getElementById('watchtime-hours-input');
const saveWatchtimeBtn = document.getElementById('save-watchtime-btn');
const deleteWatchtimeBtn = document.getElementById('delete-watchtime-btn');
let editingWatchtime = null;

// 탭 이동시 렌더링
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'my-channel-manager') renderMyChannels();
    });
});
mutantPeriodSelect.onchange = () => renderMyChannels();

// 채널 추가 모달
addMyChannelBtn.onclick = () => {
    myChannelIdInput.value = '';
    myChannelSearchInput.value = '';
    myChannelSearchResults.innerHTML = '';
    addMyChannelModal.style.display = 'block';
};
closeAddMyChannelModalBtn.onclick = () => addMyChannelModal.style.display = 'none';

// 채널명 검색 → 유튜브 API v3 search
myChannelSearchBtn.onclick = async () => {
    const q = myChannelSearchInput.value.trim();
    if (!q) { alert('검색어를 입력하세요!'); return; }
    myChannelSearchResults.innerHTML = '검색중...';
    try {
        const apiKey = await window.getCurrentApiKey?.();
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=8&q=${encodeURIComponent(q)}&key=${apiKey}`;
        const res = await fetch(url); const data = await res.json();
        if (!data.items?.length) { myChannelSearchResults.innerHTML = '검색 결과 없음'; return; }
        myChannelSearchResults.innerHTML = '';
        data.items.forEach(item => {
            const channelId = item.id.channelId;
            const channelTitle = item.snippet.title;
            const channelLogo = item.snippet.thumbnails.default.url;
            const channelEl = document.createElement('div');
            channelEl.classList.add('channel-item');
            channelEl.innerHTML = `
                <img src="${channelLogo}" style="width:36px; border-radius:50%; vertical-align:middle;">
                <span style="margin-left:8px; font-weight:500;">${channelTitle}</span>
                <button style="float:right; margin-left:16px;" data-id="${channelId}">등록</button>
            `;
            channelEl.querySelector('button').onclick = async (e) => {
                await registerChannelById(channelId);
                addMyChannelModal.style.display = 'none';
            };
            myChannelSearchResults.appendChild(channelEl);
        });
    } catch (e) { myChannelSearchResults.innerHTML = 'API 오류'; }
};

// 직접 입력으로 등록
saveMyChannelBtn.onclick = async () => {
    let input = myChannelIdInput.value.trim();
    if (!input) { alert('채널 ID 또는 URL을 입력하세요.'); return; }
    let channelId = extractChannelId(input);
    if (!channelId) { alert('올바른 채널 ID 또는 URL이 아닙니다.'); return; }
    await registerChannelById(channelId);
    addMyChannelModal.style.display = 'none';
};

// 채널ID로 등록(중복 체크, fetch)
async function registerChannelById(channelId) {
    let list = await idbGetAll('my_channels');
    if (list.find(c=>c.id===channelId)) {
        alert('이미 등록된 채널입니다.');
        return;
    }
    try {
        const apiKey = await window.getCurrentApiKey?.();
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;
        const data = await fetch(url).then(r=>r.json());
        if (!data.items || !data.items[0]) {
            alert('채널 정보를 찾을 수 없습니다.');
            return;
        }
        const item = data.items[0];
        const newChannel = {
            id: channelId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.default?.url,
            subscriberCount: item.statistics.subscriberCount,
        };
        await idbPut('my_channels', newChannel);
        renderMyChannels();
    } catch (e) {
        alert('채널 정보 조회 실패(API 키 확인)');
    }
}

window.onclick = (event) => {
    if (event.target === addMyChannelModal) addMyChannelModal.style.display = 'none';
    if (event.target === watchtimeModal) watchtimeModal.style.display = 'none';
};

// 채널 일괄 분석
analyzeAllBtn.onclick = async () => {
    analyzeAllBtn.textContent = '분석 중...';
    analyzeAllBtn.disabled = true;
    const list = await idbGetAll('my_channels');
    for (const channel of list) {
        try {
            const apiKey = await window.getCurrentApiKey?.();
            const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channel.id}&key=${apiKey}`;
            const data = await fetch(url).then(r=>r.json());
            if (data.items && data.items[0]) {
                channel.subscriberCount = data.items[0].statistics.subscriberCount;
                await idbPut('my_channels', channel);
            }
        } catch {}
    }
    analyzeAllBtn.textContent = '채널분석';
    analyzeAllBtn.disabled = false;
    renderMyChannels();
};

// 메인 렌더링
async function renderMyChannels() {
    myChannelListDiv.innerHTML = '로딩 중...';
    const channels = await idbGetAll('my_channels');
    const watchtimes = await idbGetAll('watchtimes');
    myChannelListDiv.innerHTML = '';
    if (channels.length === 0) {
        myChannelListDiv.innerHTML = '<p style="text-align:center; color:#888;">등록된 내 채널이 없습니다.</p>';
        return;
    }
    for (const ch of channels) {
        await renderChannelCard(ch, watchtimes);
    }
}

// 채널 카드 렌더
async function renderChannelCard(channel, allWatchtimes) {
    const today = moment().format('YYYY-MM-DD');
    const yest = moment().subtract(1,'days').format('YYYY-MM-DD');
    const wt_today = allWatchtimes.find(wt=>wt.channelId===channel.id&&wt.date===today);
    const wt_yest = allWatchtimes.find(wt=>wt.channelId===channel.id&&wt.date===yest);
    const watchtimeDiff = wt_today && wt_yest ? wt_today.hours - wt_yest.hours : 0;
    const watchtimeDiffStr = !wt_today ? `<span class="diff-zero">(입력 없음)</span>`
        : watchtimeDiff > 0 ? `<span class="diff-up">▲ +${watchtimeDiff}시간</span>`
        : watchtimeDiff < 0 ? `<span class="diff-down">▼ ${watchtimeDiff}시간</span>`
        : `<span class="diff-zero">변화 없음</span>`;
    const sub_today = parseInt(channel.subscriberCount||'0');
    const sub_yest = channel.lastSubCount ? parseInt(channel.lastSubCount) : null;
    const subDiff = (sub_yest!==null) ? (sub_today - sub_yest) : 0;
    const subDiffStr = (sub_yest===null) ? `<span class="diff-zero">(어제 정보 없음)</span>`
        : subDiff > 0 ? `<span class="diff-up">▲ +${subDiff.toLocaleString()}명</span>`
        : subDiff < 0 ? `<span class="diff-down">▼ ${subDiff.toLocaleString()}명</span>`
        : `<span class="diff-zero">변화 없음</span>`;

    const card = document.createElement('div');
    card.className = 'my-channel-card';
    card.innerHTML = `
        <div class="my-channel-info-row">
            <img src="${channel.thumbnail||''}" class="my-channel-thumb" alt="채널 썸네일">
            <div>
                <div class="my-channel-title">${channel.title}</div>
                <div class="my-channel-meta">
                    구독자수: ${parseInt(channel.subscriberCount||'0').toLocaleString()}명
                    ${subDiffStr}
                </div>
                <div class="my-channel-meta">
                    시청시간(오늘): ${wt_today ? wt_today.hours+'시간' : '-'}
                    ${watchtimeDiffStr}
                </div>
                <div class="my-channel-actions">
                    <button data-act="input-wt" data-id="${channel.id}">시청시간 입력/수정</button>
                    <button data-act="del" data-id="${channel.id}">삭제</button>
                </div>
            </div>
        </div>
        <div class="my-channel-mutant-section">
            <div class="my-channel-mutant-title">돌연변이 영상 TOP3</div>
            <div class="my-channel-mutant-list" id="mutant-list-${channel.id}">
                <div style="color:#aaa;">분석 중...</div>
            </div>
        </div>
    `;
    myChannelListDiv.appendChild(card);
    card.querySelectorAll('button').forEach(btn => {
        btn.onclick = async (e) => {
            const act = btn.dataset.act;
            if (act === 'del') {
                if (confirm('채널을 삭제할까요?')) {
                    await idbDelete('my_channels', channel.id);
                    renderMyChannels();
                }
            } else if (act === 'input-wt') {
                editingWatchtime = {channelId: channel.id};
                watchtimeDateInput.value = moment().format('YYYY-MM-DD');
                watchtimeHoursInput.value = wt_today ? wt_today.hours : '';
                deleteWatchtimeBtn.style.display = wt_today ? '' : 'none';
                watchtimeModal.style.display = 'block';
            }
        };
    });
    // 시청시간 모달
    deleteWatchtimeBtn.onclick = async () => {
        const channelId = editingWatchtime.channelId;
        const date = watchtimeDateInput.value;
        if (channelId && date) {
            await idbDelete('watchtimes', [channelId, date]);
            watchtimeModal.style.display = 'none';
            renderMyChannels();
        }
    };
    saveWatchtimeBtn.onclick = async () => {
        const channelId = editingWatchtime.channelId;
        const date = watchtimeDateInput.value;
        const hours = parseInt(watchtimeHoursInput.value||'0');
        if (!channelId || !date || isNaN(hours)) {
            alert('날짜와 시청시간을 입력하세요.');
            return;
        }
        await idbPut('watchtimes', {channelId, date, hours});
        watchtimeModal.style.display = 'none';
        renderMyChannels();
    };
    closeWatchtimeModalBtn.onclick = () => watchtimeModal.style.display = 'none';

    // 돌연변이 영상 TOP3
    renderMutantVideos(channel, document.getElementById(`mutant-list-${channel.id}`));
}

// 돌연변이 영상 TOP3 (롱폼만, 구독자수2배이상 조회)
async function renderMutantVideos(channel, container) {
    container.innerHTML = '<div style="color:#aaa;">영상 분석 중...</div>';
    try {
        const apiKey = await window.getCurrentApiKey?.();
        // 업로드리스트ID
        const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channel.id}&key=${apiKey}`;
        const data = await fetch(url).then(r=>r.json());
        const uploadPid = data.items[0].contentDetails.relatedPlaylists.uploads;
        let videos = [];
        let nextPageToken = '', cnt = 0;
        let minDate = null;
        let period = mutantPeriodSelect.value;
        if (period !== 'all') minDate = moment().subtract(parseInt(period), 'months');
        do {
            const vurl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadPid}&maxResults=50${nextPageToken ? '&pageToken='+nextPageToken : ''}&key=${apiKey}`;
            const vdata = await fetch(vurl).then(r=>r.json());
            let items = vdata.items;
            if (minDate) items = items.filter(i=>moment(i.snippet.publishedAt).isAfter(minDate));
            videos.push(...items);
            nextPageToken = vdata.nextPageToken;
            cnt += items.length;
        } while (nextPageToken && cnt<100);

        // 통계 fetch (롱폼만, 구독자수2배이상 조회만)
        const videoIds = videos.map(v=>v.contentDetails.videoId).slice(0, 100);
        let detailList = [];
        for (let i=0; i<videoIds.length; i+=50) {
            const ids = videoIds.slice(i, i+50);
            const durl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}&key=${apiKey}`;
            const ddata = await fetch(durl).then(r=>r.json());
            if (ddata.items) detailList.push(...ddata.items);
        }
        // 1. 롱폼만 2. 구독자수2배 이상만
        let list = detailList
            .filter(item=>{
                // 롱폼(3분 초과)
                const dur = parseISO8601(item.contentDetails.duration);
                if (dur < 180) return false;
                const view = parseInt(item.statistics.viewCount||'0');
                if (view < (parseInt(channel.subscriberCount||'1') * 2)) return false;
                return true;
            })
            .map(item => {
                let view = parseInt(item.statistics.viewCount||'0');
                let idx = (parseInt(channel.subscriberCount||'1') > 0)
                    ? (view / parseInt(channel.subscriberCount||'1'))
                    : 0;
                return {
                    id: item.id,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
                    mutantIndex: idx,
                    publishedAt: item.snippet.publishedAt,
                    viewCount: view
                };
            });
        list = list.sort((a, b) => b.mutantIndex - a.mutantIndex).slice(0, 3);

        if (!list.length) {
            container.innerHTML = '<div style="color:#aaa;">돌연변이 영상이 없습니다.</div>';
            return;
        }
        // 카드 렌더링
        container.innerHTML = '';
        list.forEach(video => {
            const div = document.createElement('div');
            div.className = 'my-channel-mutant-item';
            div.innerHTML = `
                <img src="${video.thumbnail}" class="my-channel-mutant-thumb" alt="썸네일">
                <div class="my-channel-mutant-title2">${video.title}</div>
                <div class="my-channel-mutant-extra">
                    <span class="my-channel-mutant-views">조회수: ${video.viewCount.toLocaleString()}회</span>
                    <span class="my-channel-mutant-date">${moment(video.publishedAt).format('YYYY-MM-DD')}</span>
                </div>
                <div class="mutant-index-badge">${video.mutantIndex.toFixed(2)}</div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        container.innerHTML = '<div style="color:#c4302b;">영상 정보 불러오기 실패(API키, quota 확인)</div>';
    }
}

// ISO8601 → 초
function parseISO8601(duration) {
    const m = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const h = parseInt(m[1]||0), min = parseInt(m[2]||0), s = parseInt(m[3]||0);
    return h*3600+min*60+s;
}

// 채널 ID 추출
function extractChannelId(input) {
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
