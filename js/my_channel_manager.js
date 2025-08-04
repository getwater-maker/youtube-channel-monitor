// js/my_channel_manager.js
// 내 채널 관리 탭 전용 JS (코드 전체)
// API 키 모듈/유틸/모멘트.js 의존, main.js와 독립적

import { fetchYoutubeApi, loadApiKeys } from './api_keys.js';

// IndexedDB 기본 래퍼
const DB_NAME = 'myChannelDB';
const DB_VERSION = 1;
let db = null;

// 탭 제어
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'my-channel-manager') {
            renderMyChannels();
        }
    });
});

// 내 채널 관리 DOM
const myChannelListDiv = document.getElementById('my-channel-list');
const addMyChannelBtn = document.getElementById('add-my-channel-btn');
const mutantPeriodSelect = document.getElementById('mutant-period-select');

// 모달들
const addMyChannelModal = document.getElementById('add-my-channel-modal');
const closeAddMyChannelModalBtn = document.getElementById('close-add-my-channel-modal');
const myChannelIdInput = document.getElementById('my-channel-id-input');
const saveMyChannelBtn = document.getElementById('save-my-channel-btn');
let editingChannelId = null;

const watchtimeModal = document.getElementById('watchtime-modal');
const closeWatchtimeModalBtn = document.getElementById('close-watchtime-modal');
const watchtimeDateInput = document.getElementById('watchtime-date-input');
const watchtimeHoursInput = document.getElementById('watchtime-hours-input');
const saveWatchtimeBtn = document.getElementById('save-watchtime-btn');
const deleteWatchtimeBtn = document.getElementById('delete-watchtime-btn');
let editingWatchtime = null;

// --------- IndexedDB 관련 ---------
function openDB() {
    return new Promise((resolve, reject) => {
        if (db) return resolve(db);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function(e) {
            db = e.target.result;
            if (!db.objectStoreNames.contains('channels')) {
                const store = db.createObjectStore('channels', { keyPath: 'id' });
                store.createIndex('id', 'id', { unique: true });
            }
            if (!db.objectStoreNames.contains('watchtimes')) {
                const store = db.createObjectStore('watchtimes', { keyPath: ['channelId', 'date'] });
            }
        };
        req.onsuccess = function(e) {
            db = e.target.result;
            resolve(db);
        };
        req.onerror = function(e) {
            alert('IndexedDB 열기 오류');
            reject(e);
        };
    });
}

function idbGetAll(storeName) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = e => reject(e);
        });
    });
}

function idbGet(storeName, key) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = e => reject(e);
        });
    });
}

function idbPut(storeName, data) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(data);
            req.onsuccess = () => resolve(req.result);
            req.onerror = e => reject(e);
        });
    });
}

function idbDelete(storeName, key) {
    return openDB().then(db => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = e => reject(e);
        });
    });
}

// --------- 이벤트 바인딩 ---------
addMyChannelBtn.onclick = () => {
    editingChannelId = null;
    myChannelIdInput.value = '';
    addMyChannelModal.style.display = 'block';
};

closeAddMyChannelModalBtn.onclick = () => {
    addMyChannelModal.style.display = 'none';
};

saveMyChannelBtn.onclick = async () => {
    let input = myChannelIdInput.value.trim();
    if (!input) { alert('채널 ID 또는 URL을 입력하세요.'); return; }
    let channelId = extractChannelId(input);
    if (!channelId) { alert('올바른 채널 ID 또는 URL이 아닙니다.'); return; }
    // 이미 등록된지 확인
    let list = await idbGetAll('channels');
    if (!editingChannelId && list.find(c=>c.id===channelId)) {
        alert('이미 등록된 채널입니다.');
        return;
    }
    try {
        // 유튜브 API에서 정보 가져오기
        const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}`;
        const data = await fetchYoutubeApi(url);
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
        await idbPut('channels', newChannel);
        addMyChannelModal.style.display = 'none';
        renderMyChannels();
    } catch (e) {
        alert('채널 정보 조회 실패(API 키 확인)');
    }
};

mutantPeriodSelect.onchange = () => renderMyChannels();

// 모달 바깥 클릭 닫기
window.onclick = (event) => {
    if (event.target === addMyChannelModal) addMyChannelModal.style.display = 'none';
    if (event.target === watchtimeModal) watchtimeModal.style.display = 'none';
};

// --------- 메인 화면 렌더링 ---------
async function renderMyChannels() {
    myChannelListDiv.innerHTML = '로딩 중...';
    const channels = await idbGetAll('channels');
    const watchtimes = await idbGetAll('watchtimes');
    myChannelListDiv.innerHTML = '';
    if (channels.length === 0) {
        myChannelListDiv.innerHTML = '<p style="text-align:center; color:#888;">등록된 내 채널이 없습니다.</p>';
        return;
    }
    // 모든 채널별로 카드 렌더링
    for (const ch of channels) {
        await renderChannelCard(ch, watchtimes);
    }
}

// 개별 채널 카드 렌더링
async function renderChannelCard(channel, allWatchtimes) {
    // 구독자수 fetch 버튼
    // 어제/오늘 기준값
    const today = moment().format('YYYY-MM-DD');
    const yest = moment().subtract(1,'days').format('YYYY-MM-DD');
    const wt_today = allWatchtimes.find(wt=>wt.channelId===channel.id&&wt.date===today);
    const wt_yest = allWatchtimes.find(wt=>wt.channelId===channel.id&&wt.date===yest);

    // 변화량 계산
    const watchtimeDiff = wt_today && wt_yest
        ? wt_today.hours - wt_yest.hours
        : 0;
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

    // 카드 HTML
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
                    <button data-act="fetch" data-id="${channel.id}">데이터 가져오기</button>
                    <button data-act="input-wt" data-id="${channel.id}">시청시간 입력/수정</button>
                    <button data-act="edit" data-id="${channel.id}">수정</button>
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

    // 이벤트
    card.querySelectorAll('button').forEach(btn => {
        btn.onclick = async (e) => {
            const act = btn.dataset.act;
            if (act === 'del') {
                if (confirm('채널을 삭제할까요?')) {
                    await idbDelete('channels', channel.id);
                    renderMyChannels();
                }
            } else if (act === 'edit') {
                editingChannelId = channel.id;
                myChannelIdInput.value = channel.id;
                addMyChannelModal.style.display = 'block';
            } else if (act === 'input-wt') {
                editingWatchtime = {channelId: channel.id};
                watchtimeDateInput.value = moment().format('YYYY-MM-DD');
                watchtimeHoursInput.value = wt_today ? wt_today.hours : '';
                deleteWatchtimeBtn.style.display = wt_today ? '' : 'none';
                watchtimeModal.style.display = 'block';
            } else if (act === 'fetch') {
                await fetchChannelSubscriber(channel);
            }
        };
    });

    // 시청시간 삭제
    deleteWatchtimeBtn.onclick = async () => {
        const channelId = editingWatchtime.channelId;
        const date = watchtimeDateInput.value;
        if (channelId && date) {
            await idbDelete('watchtimes', [channelId, date]);
            watchtimeModal.style.display = 'none';
            renderMyChannels();
        }
    };
    // 시청시간 저장
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

    // 돌연변이 영상 TOP3 렌더
    renderMutantVideos(channel, document.getElementById(`mutant-list-${channel.id}`));
}

// 구독자수 업데이트 (그리고 어제값 기록)
async function fetchChannelSubscriber(channel) {
    try {
        // 어제값 저장
        const channels = await idbGetAll('channels');
        let ch = channels.find(c=>c.id===channel.id);
        if (ch) ch.lastSubCount = ch.subscriberCount;
        // fetch
        const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channel.id}`;
        const data = await fetchYoutubeApi(url);
        const sub = data.items && data.items[0] && data.items[0].statistics.subscriberCount;
        if (sub) {
            ch.subscriberCount = sub;
            await idbPut('channels', ch);
            alert('구독자수 정보가 업데이트되었습니다!');
            renderMyChannels();
        } else {
            alert('구독자 정보를 가져올 수 없습니다.');
        }
    } catch (e) {
        alert('구독자수 갱신 실패(API 키 확인)');
    }
}

// 돌연변이 영상 TOP3 렌더링
async function renderMutantVideos(channel, container) {
    container.innerHTML = '<div style="color:#aaa;">영상 분석 중...</div>';
    // 업로드 영상목록 가져오기 (최근 100개, 기간필터 적용)
    try {
        // 채널 uploads 플레이리스트 ID 가져오기
        const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channel.id}`;
        const data = await fetchYoutubeApi(url);
        const uploadPid = data.items[0].contentDetails.relatedPlaylists.uploads;
        // 영상 리스트 가져오기
        let videos = [];
        let nextPageToken = '';
        let cnt = 0;
        let minDate = null;
        let period = mutantPeriodSelect.value;
        if (period !== 'all') {
            let n = parseInt(period);
            if (!isNaN(n)) minDate = moment().subtract(n, 'months');
            if (period.endsWith('m')) minDate = moment().subtract(parseInt(period), 'months');
        }
        // 여러 페이지 지원 (최대 100개)
        do {
            const vurl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadPid}&maxResults=50${nextPageToken ? '&pageToken='+nextPageToken : ''}`;
            const vdata = await fetchYoutubeApi(vurl);
            let items = vdata.items;
            if (minDate) items = items.filter(i=>moment(i.snippet.publishedAt).isAfter(minDate));
            videos.push(...items);
            nextPageToken = vdata.nextPageToken;
            cnt += items.length;
        } while (nextPageToken && cnt<100);

        // 영상 ID 리스트
        const videoIds = videos.map(v=>v.contentDetails.videoId).slice(0, 100);
        // 통계 정보 가져오기 (한 번에 최대 50개씩)
        let detailList = [];
        for (let i=0; i<videoIds.length; i+=50) {
            const ids = videoIds.slice(i, i+50);
            const durl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}`;
            const ddata = await fetchYoutubeApi(durl);
            if (ddata.items) detailList.push(...ddata.items);
        }
        // 돌연변이 지수 계산 (조회수/구독자수)
        let list = detailList.map(item => {
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
            };
        });
        // 내림차순 정렬, 상위 3개만
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
                <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">
                    <img src="${video.thumbnail}" class="my-channel-mutant-thumb" alt="썸네일">
                </a>
                <div class="my-channel-mutant-meta">
                    <div class="my-channel-mutant-title2">${video.title}</div>
                    <div class="my-channel-mutant-index">지수: ${video.mutantIndex.toFixed(2)}</div>
                    <div class="my-channel-mutant-date">${moment(video.publishedAt).format('YYYY-MM-DD')}</div>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        container.innerHTML = '<div style="color:#c4302b;">영상 정보 불러오기 실패(API키, quota 확인)</div>';
    }
}

// 채널 ID 추출 (ID or URL 모두 지원)
function extractChannelId(input) {
    if (input.startsWith('UC') && input.length === 24) return input;
    // URL 형태
    let m = input.match(/channel\/(UC[\w-]{22,})/);
    if (m) return m[1];
    // 커스텀URL, @명 등은 미지원 (API 제한)
    return null;
}

// 자동 첫 진입 시 렌더링
if (document.querySelector('.tab-button.active')?.dataset.tab === 'my-channel-manager') {
    renderMyChannels();
}

// 탭 이동시에도 다시 렌더링 필요
// mutantPeriodSelect는 탭 내 period select

export {};
