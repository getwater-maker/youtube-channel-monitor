import { fetchYoutubeApi, loadApiKeys, saveApiKeys } from './api_keys.js';
import { isLongform, calculateMutantIndex } from './utils.js';

// ----------------- 데이터 ----------------------
let myChannels = [];
let myChannelsData = {}; // {채널ID: {prev, today, ...}}
let currentSearchResults = [];
let currentSearchPage = 1;
const SEARCH_PER_PAGE = 5;

// ----------------- 초기화 ----------------------
document.addEventListener('DOMContentLoaded', () => {
    loadChannels();
    setupEventListeners();
    renderMyChannelList();
});

// ----------------- 채널 불러오기 ----------------
function loadChannels() {
    myChannels = JSON.parse(localStorage.getItem('myChannels') || '[]');
    myChannelsData = JSON.parse(localStorage.getItem('myChannelsData') || '{}');
    const count = document.getElementById('my-channel-count');
    if (count) count.textContent = myChannels.length;
}

// ----------------- 채널 저장 --------------------
function saveChannels() {
    localStorage.setItem('myChannels', JSON.stringify(myChannels));
    localStorage.setItem('myChannelsData', JSON.stringify(myChannelsData));
    const count = document.getElementById('my-channel-count');
    if (count) count.textContent = myChannels.length;
}

// ----------------- 이벤트 ----------------------
function setupEventListeners() {
    // 채널추가
    const addBtn = document.getElementById('my-add-channel-btn');
    if (addBtn) addBtn.onclick = openChannelSearchModal;
    // API키 모달
    const openApiBtn = document.getElementById('open-api-key-popup');
    if (openApiBtn) openApiBtn.onclick = openApiKeyModal;
    document.querySelectorAll('#api-key-modal .close-button').forEach(btn => btn.onclick = closeApiKeyModal);
    const saveApiBtn = document.getElementById('save-api-keys');
    if (saveApiBtn) saveApiBtn.onclick = saveApiKeysHandler;
    // 추적버튼
    const trackBtn = document.getElementById('my-track-btn');
    if (trackBtn) trackBtn.onclick = startTracking;

    // 모달 닫기
    document.querySelectorAll('.modal .close-button').forEach(btn =>
        btn.addEventListener('click', e => btn.closest('.modal').style.display = 'none')
    );
}

// ----------- 채널 카드 렌더링 -----------
function renderMyChannelList() {
    const myChannelList = document.getElementById('my-channel-list');
    if (!myChannelList) return;
    myChannelList.innerHTML = '';
    if (!myChannels.length) {
        myChannelList.innerHTML = `<div style="text-align:center; color:#aaa; margin:50px 0;">채널을 추가해주세요.</div>`;
        return;
    }
    myChannels.forEach(channel => {
        // 데이터 불러오기
        const data = myChannelsData[channel.id] || {};
        // 돌연변이 top3 영상
        const top3 = (data.videos || []).slice(0, 3);

        const card = document.createElement('div');
        card.className = 'my-channel-card';
        card.innerHTML = `
            <img src="${channel.logo}" class="my-channel-logo" alt="${channel.name}">
            <div class="my-channel-name">${channel.name}
                <button class="del-btn" title="삭제" data-id="${channel.id}" style="float:right;font-size:1.1rem; color:#b22020; background:none; border:none; cursor:pointer;">×</button>
            </div>
            <div class="my-channel-info">
                구독자 <strong>${(data.todaySubscribers||0).toLocaleString()}</strong> 
                <span style="color:${deltaColor(data.subsDelta)};">+${data.subsDelta||0}</span>
                <br>
                조회수 <strong>${(data.todayViews||0).toLocaleString()}</strong> 
                <span style="color:${deltaColor(data.viewsDelta)};">+${data.viewsDelta||0}</span>
            </div>
            <div class="my-watchtime-group">
                유효시청시간 <input type="number" min="0" max="99999" step="1" value="${data.todayWatchTime||0}" data-channel-id="${channel.id}" class="watchtime-input">
                <span style="color:${deltaColor(data.watchTimeDelta)};">+${data.watchTimeDelta||0}</span>
            </div>
            <div class="my-channel-mutant-label">돌연변이 TOP3</div>
            <div class="my-channel-mutant-videos">
                ${top3.length ? top3.map(video => `
                    <div class="my-mutant-video">
                        <a href="https://youtube.com/watch?v=${video.id}" target="_blank">
                            <img class="my-mutant-thumb" src="${video.thumbnail}" alt="">
                        </a>
                        <div class="my-mutant-title">${video.title}</div>
                        <div class="my-mutant-meta">
                            <span>${Number(video.viewCount).toLocaleString()}회</span>
                            <span class="my-mutant-index-badge">${video.mutantIndex}</span>
                        </div>
                    </div>
                `).join('') : '<div class="my-no-videos">영상 정보 없음</div>'}
            </div>
        `;
        myChannelList.appendChild(card);
    });

    // 삭제버튼
    document.querySelectorAll('.del-btn').forEach(btn => {
        btn.onclick = e => {
            const id = btn.getAttribute('data-id');
            myChannels = myChannels.filter(ch => ch.id !== id);
            delete myChannelsData[id];
            saveChannels();
            renderMyChannelList();
        };
    });
    // 유효시청시간 입력
    document.querySelectorAll('.watchtime-input').forEach(input => {
        input.onchange = e => {
            const id = input.getAttribute('data-channel-id');
            const val = parseInt(input.value) || 0;
            if (!myChannelsData[id]) myChannelsData[id] = {};
            const prev = myChannelsData[id].todayWatchTime || 0;
            myChannelsData[id].watchTimeDelta = val - prev;
            myChannelsData[id].todayWatchTime = val;
            saveChannels();
            renderMyChannelList();
        };
    });
}

// ----------- 추적 시작(데이터 수집) -----------
async function startTracking() {
    for (const ch of myChannels) {
        const id = ch.id;
        // 기존 값 저장
        if (!myChannelsData[id]) myChannelsData[id] = {};
        const d = myChannelsData[id];
        d.prevSubscribers = d.todaySubscribers || 0;
        d.prevViews = d.todayViews || 0;
        d.prevWatchTime = d.todayWatchTime || 0;
        // API로 데이터 새로 수집
        const channelInfo = await fetchChannelInfo(id);
        d.todaySubscribers = channelInfo.subscriberCount || 0;
        d.todayViews = channelInfo.viewCount || 0;
        d.subsDelta = (d.todaySubscribers - (d.prevSubscribers||0));
        d.viewsDelta = (d.todayViews - (d.prevViews||0));
        // 돌연변이 top3
        d.videos = await getMutantTop3Videos(channelInfo.uploadsPlaylistId, channelInfo.subscriberCount);
        // 유효시청시간(입력) 변화는 위에서 관리
    }
    saveChannels();
    renderMyChannelList();
    alert('데이터 추적이 완료되었습니다.');
}

// ------ 유튜브 채널 정보 fetch ------
async function fetchChannelInfo(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const item = data.items[0];
    return {
        id: channelId,
        name: item.snippet.title,
        logo: item.snippet.thumbnails.default.url,
        subscriberCount: Number(item.statistics.subscriberCount) || 0,
        viewCount: Number(item.statistics.viewCount) || 0,
        uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
    };
}

// ------ 돌연변이 top3 영상 -------
async function getMutantTop3Videos(playlistId, subscriberCount) {
    let nextPageToken = null;
    let videos = [];
    // 최신 30개 영상까지
    while (videos.length < 30) {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=10${nextPageToken ? '&pageToken='+nextPageToken : ''}`;
        const data = await fetchYoutubeApi(url);
        const videoIds = data.items.map(i => i.contentDetails.videoId);
        if (videoIds.length === 0) break;
        const details = await fetchVideoDetails(videoIds);
        details.forEach(video => {
            if (isLongform(video.duration)) {
                video.mutantIndex = calculateMutantIndex(video.viewCount, subscriberCount);
                videos.push(video);
            }
        });
        nextPageToken = data.nextPageToken;
        if (!nextPageToken) break;
    }
    // 돌연변이 지수 내림차순 top3
    return videos.sort((a,b) => parseFloat(b.mutantIndex)-parseFloat(a.mutantIndex)).slice(0,3);
}

// ------ 동영상 상세 정보 -------
async function fetchVideoDetails(ids) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${ids.join(',')}`;
    const data = await fetchYoutubeApi(url);
    return data.items.map(item => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
        viewCount: Number(item.statistics.viewCount)||0,
        duration: item.contentDetails.duration,
    }));
}

// ----------- 채널 검색 모달 ---------------
function openChannelSearchModal() {
    const modal = document.getElementById('my-channel-search-modal');
    if (!modal) return;
    modal.style.display = 'block';
    document.getElementById('my-channel-search-results').innerHTML = '<div style="margin:30px;">채널명을 입력하세요.<br><input id="search-input" style="width:80%; padding:9px; margin-top:16px;"></div>';
    document.getElementById('my-pagination').innerHTML = '';
    document.getElementById('search-input').onkeydown = (e) => {
        if (e.key === 'Enter') searchChannels(e.target.value);
    };
}

// 검색
async function searchChannels(keyword) {
    currentSearchResults = [];
    currentSearchPage = 1;
    let nextPageToken = null;
    while(currentSearchResults.length < 40) { // 최대 40개까지
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=channel&maxResults=10${nextPageToken? '&pageToken='+nextPageToken : ''}`;
        const data = await fetchYoutubeApi(url);
        currentSearchResults = currentSearchResults.concat(data.items);
        nextPageToken = data.nextPageToken;
        if (!nextPageToken) break;
    }
    displaySearchResultsPaginated();
}

// 검색결과/페이지네이션
function displaySearchResultsPaginated() {
    const container = document.getElementById('my-channel-search-results');
    if (!container) return;
    container.innerHTML = '';
    const totalPages = Math.ceil(currentSearchResults.length / SEARCH_PER_PAGE);
    const startIdx = (currentSearchPage-1) * SEARCH_PER_PAGE;
    const showItems = currentSearchResults.slice(startIdx, startIdx+SEARCH_PER_PAGE);
    showItems.forEach(item => {
        const already = myChannels.some(c=>c.id === item.id.channelId);
        const div = document.createElement('div');
        div.className = 'channel-item';
        div.style = `display:flex; align-items:center; gap:18px; padding:10px 0; cursor:pointer;${already?'opacity:.6;pointer-events:none;':''}`;
        div.innerHTML = `
            <img src="${item.snippet.thumbnails.default.url}" style="width:48px; height:48px; border-radius:50%;">
            <span>${item.snippet.title}</span>
            ${already ? '<span style="color:#b22020; margin-left:auto;">(등록됨)</span>' : ''}
        `;
        if(!already) {
            div.onclick = () => {
                myChannels.push({id:item.id.channelId, name:item.snippet.title, logo:item.snippet.thumbnails.default.url});
                saveChannels();
                renderMyChannelList();
                document.getElementById('my-channel-search-modal').style.display='none';
            };
        }
        container.appendChild(div);
    });
    // 페이지네이션 (1,2,3)
    const pag = document.getElementById('my-pagination');
    if (!pag) return;
    pag.innerHTML = '';
    if (totalPages > 1) {
        if (currentSearchPage > 1) {
            const prev = document.createElement('button');
            prev.textContent = '이전';
            prev.onclick = ()=>{ currentSearchPage--; displaySearchResultsPaginated(); };
            pag.appendChild(prev);
        }
        for (let p=1; p<=Math.min(3,totalPages); p++) {
            const btn = document.createElement('button');
            btn.textContent = p;
            btn.className = (p===currentSearchPage)?'active':'';
            btn.onclick = ()=>{ currentSearchPage=p; displaySearchResultsPaginated(); };
            pag.appendChild(btn);
        }
        if (currentSearchPage < totalPages) {
            const next = document.createElement('button');
            next.textContent = '다음';
            next.onclick = ()=>{ currentSearchPage++; displaySearchResultsPaginated(); };
            pag.appendChild(next);
        }
    }
}

// ---- API키 입력(공통 모달) ----
function openApiKeyModal() {
    const modal = document.getElementById('api-key-modal');
    const storedKeys = loadApiKeys();
    document.querySelectorAll('.api-key-input').forEach((input, i) => {
        input.value = storedKeys[i] || '';
    });
    if (modal) modal.style.display = 'block';
}
function closeApiKeyModal() {
    const modal = document.getElementById('api-key-modal');
    if (modal) modal.style.display = 'none';
}
function saveApiKeysHandler() {
    const keys = Array.from(document.querySelectorAll('.api-key-input')).map(input=>input.value);
    saveApiKeys(keys);
    closeApiKeyModal();
    alert('API 키가 저장되었습니다.');
}

// ------ 색상 도우미 --------
function deltaColor(val) {
    if (val > 0) return '#27b868';
    if (val < 0) return '#b22020';
    return '#888';
}
