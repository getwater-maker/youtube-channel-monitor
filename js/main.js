// js/main.js
// 단일 탭 채널 모니터 + 3열 세로 정렬 + 정렬 옵션 + 썸네일 잘림 방지
import { isLongform, calculateMutantIndex } from './utils.js';
import { loadApiKeys, saveApiKeys, fetchYoutubeApi, downloadApiKeys } from './api_keys.js';

/* ===============================
   IndexedDB (my_channels / watchtimes)
   =============================== */
const DB_NAME = 'myChannelDB';
const DB_VERSION = 1;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains('my_channels')) {
        db.createObjectStore('my_channels', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('watchtimes')) {
        db.createObjectStore('watchtimes', { keyPath: ['channelId', 'date'] });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e);
  });
}
function idbGetAll(storeName) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  }));
}
function idbPut(storeName, data) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e);
  }));
}
function idbDelete(storeName, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e);
  }));
}

/* ===============================
   DOM 캐싱
   =============================== */
const channelCountSpan = document.getElementById('channel-count');
const channelListContainer = document.getElementById('channel-list-container');
const addChannelButton = document.getElementById('add-channel-button');

const mutantVideoList = document.getElementById('mutant-video-list');
const latestVideoList = document.getElementById('latest-video-list');

// 정렬 셀렉터
const channelSortSelect = document.getElementById('channel-sort-select');
const mutantSortSelect  = document.getElementById('mutant-sort-select');
const latestSortSelect  = document.getElementById('latest-sort-select');

// API 키 모달
const apiKeyModal = document.getElementById('api-key-modal');
const openApiKeyPopupButton = document.getElementById('open-api-key-popup');
const closeButton = document.querySelector('#api-key-modal .close-button');
const saveApiKeysButton = document.getElementById('save-api-keys');
const apiKeyInputs = document.querySelectorAll('.api-key-input');
const apiKeyFileUpload = document.getElementById('api-key-file-upload');
const downloadApiKeysButton = document.getElementById('download-api-keys');

// 채널 추가 모달
const cmModal = document.getElementById('add-channel-cm-modal');
const cmModalClose = document.getElementById('close-add-channel-cm-modal');
const cmSearchInput = document.getElementById('cm-channel-search-input');
const cmSearchBtn = document.getElementById('cm-search-channel-btn');
const cmResults = document.getElementById('cm-channel-search-results');
const cmDirectInput = document.getElementById('cm-channel-id-input');
const cmSaveBtn = document.getElementById('cm-save-channel-btn');

// 기간
let currentMutantPeriod = '6m';

// 캐시
const playlistCache = {};
const videoDetailCache = {};

document.addEventListener('DOMContentLoaded', () => {
  moment.locale('ko');
  setupEventListeners();
  updateAll();
});

function setupEventListeners() {
  // API 키 모달
  openApiKeyPopupButton.addEventListener('click', () => {
    const storedKeys = loadApiKeys();
    apiKeyInputs.forEach((input, idx) => input.value = storedKeys[idx] || '');
    apiKeyModal.style.display = 'block';
  });
  closeButton.addEventListener('click', () => apiKeyModal.style.display = 'none');
  window.addEventListener('click', (e) => {
    if (e.target === apiKeyModal) apiKeyModal.style.display = 'none';
    if (e.target === cmModal) cmModal.style.display = 'none';
  });
  saveApiKeysButton.addEventListener('click', () => {
    const keys = Array.from(apiKeyInputs).map(i => i.value.trim());
    if (saveApiKeys(keys)) {
      alert('API 키가 저장되었습니다.');
      apiKeyModal.style.display = 'none';
    }
  });
  apiKeyFileUpload.addEventListener('change', (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const keys = reader.result.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 5);
      apiKeyInputs.forEach((input, idx) => input.value = keys[idx] || '');
    };
    reader.readAsText(file);
  });
  downloadApiKeysButton.addEventListener('click', downloadApiKeys);

  // 채널 추가 모달
  addChannelButton.addEventListener('click', () => {
    cmSearchInput.value = ''; cmResults.innerHTML = ''; cmDirectInput.value = '';
    cmModal.style.display = 'block';
  });
  cmModalClose.addEventListener('click', () => cmModal.style.display = 'none');
  cmSearchBtn.addEventListener('click', handleCmSearch);
  cmSaveBtn.addEventListener('click', async () => {
    let input = cmDirectInput.value.trim();
    if (!input) { alert('채널 ID 또는 URL을 입력하세요.'); return; }
    let channelId = extractChannelId(input);
    if (!channelId) {
      await registerBySearchKeyword(input);
    } else {
      await registerChannelById(channelId);
    }
    cmModal.style.display = 'none';
    updateAll();
  });

  // 기간 버튼
  document.querySelector('.date-range-controls').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      document.querySelectorAll('.date-range-controls button').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentMutantPeriod = e.target.dataset.period;
      updateMutantVideos();
    }
  });

  // 정렬 변경
  channelSortSelect.addEventListener('change', updateChannels);
  mutantSortSelect.addEventListener('change', updateMutantVideos);
  latestSortSelect.addEventListener('change', updateLatestVideos);
}

/* ===============================
   채널 등록(검색/직접입력)
   =============================== */
let searchResultsData = [];
let currentPage = 1;
const PAGE_SIZE = 5;

async function handleCmSearch() {
  const q = cmSearchInput.value.trim();
  if (!q) { alert('검색어를 입력하세요!'); return; }
  cmResults.innerHTML = '검색중...';
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=30&q=${encodeURIComponent(q)}`;
    const data = await fetchYoutubeApi(url);
    if (!data.items?.length) { cmResults.innerHTML = '검색 결과 없음'; return; }
    searchResultsData = data.items;
    currentPage = 1;
    renderCmSearchPage();
  } catch (e) {
    cmResults.innerHTML = 'API 오류';
  }
}
function renderCmSearchPage() {
  cmResults.innerHTML = '';
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageItems = searchResultsData.slice(startIdx, startIdx + PAGE_SIZE);

  pageItems.forEach(item => {
    const channelId = item.id.channelId;
    const channelTitle = item.snippet.title;
    const channelLogo = item.snippet.thumbnails.default.url;
    const row = document.createElement('div');
    row.className = 'channel-item-search-row';
    row.innerHTML = `
      <img src="${channelLogo}" class="channel-search-thumb">
      <span class="channel-search-title">${channelTitle}</span>
      <button class="channel-register-btn" data-id="${channelId}">등록</button>
    `;
    row.querySelector('.channel-register-btn').onclick = async () => {
      await registerChannelById(channelId);
      cmModal.style.display = 'none';
      updateAll();
    };
    cmResults.appendChild(row);
  });

  const totalPages = Math.ceil(searchResultsData.length / PAGE_SIZE);
  if (totalPages > 1) {
    const pagDiv = document.createElement('div');
    pagDiv.className = 'channel-pagination';
    for (let i = 1; i <= totalPages; i++) {
      const p = document.createElement('span');
      p.className = 'pagination-num' + (i === currentPage ? ' active' : '');
      p.textContent = i;
      p.onclick = () => { currentPage = i; renderCmSearchPage(); };
      pagDiv.appendChild(p);
    }
    if (currentPage < totalPages) {
      const nextBtn = document.createElement('span');
      nextBtn.className = 'pagination-next';
      nextBtn.textContent = 'Next';
      nextBtn.onclick = () => { currentPage++; renderCmSearchPage(); };
      pagDiv.appendChild(nextBtn);
    }
    cmResults.appendChild(pagDiv);
  }
}
async function registerBySearchKeyword(keyword) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(keyword)}`;
  const data = await fetchYoutubeApi(url);
  if (!data.items?.length) { alert('채널을 찾을 수 없습니다.'); return; }
  await registerChannelById(data.items[0].id.channelId);
}
function extractChannelId(input) {
  input = input.trim();
  const ucMatch = input.match(/(UC[0-9A-Za-z_-]{22})/);
  if (ucMatch) return ucMatch[1];
  if (input.includes('youtube.com') && input.includes('/channel/')) {
    const m = input.match(/channel\/(UC[0-9A-Za-z_-]{22})/);
    if (m) return m[1];
  }
  return null;
}

// 실제 등록: 구독자수/영상수/업로드플레이리스트/최신 업로드 날짜까지 저장
async function registerChannelById(channelId) {
  const list = await idbGetAll('my_channels');
  if (list.find(c => c.id === channelId)) {
    alert('이미 등록된 채널입니다.');
    return;
  }
  // 기본 정보
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
  const data = await fetchYoutubeApi(url);
  if (!data.items || !data.items[0]) {
    alert('채널 정보를 찾을 수 없습니다.');
    return;
  }
  const item = data.items[0];
  const uploadsPlaylistId = item.contentDetails?.relatedPlaylists?.uploads || '';
  let latestUploadDate = item.snippet.publishedAt;

  // 최신 업로드 1건의 날짜(가능하면)
  if (uploadsPlaylistId) {
    const purl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=1&playlistId=${uploadsPlaylistId}`;
    const pdata = await fetchYoutubeApi(purl);
    if (pdata.items && pdata.items[0]) {
      latestUploadDate = pdata.items[0].snippet.publishedAt || latestUploadDate;
    }
  }

  const newChannel = {
    id: channelId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.default?.url || '',
    subscriberCount: item.statistics.subscriberCount || '0',
    videoCount: item.statistics.videoCount || '0',
    uploadsPlaylistId,
    latestUploadDate
  };
  await idbPut('my_channels', newChannel);
  alert(`${newChannel.title} 채널이 추가되었습니다.`);
}

/* ===============================
   렌더/정렬
   =============================== */
async function updateAll() {
  await updateChannels();
  await updateMutantVideos();
  await updateLatestVideos();
}

// 채널 컬럼
async function updateChannels() {
  const channels = await idbGetAll('my_channels');
  channelCountSpan.textContent = channels.length;

  // 정렬
  sortChannels(channels, channelSortSelect.value);

  // 렌더
  channelListContainer.innerHTML = '';
  if (!channels.length) {
    channelListContainer.innerHTML = '<p class="muted">채널을 추가하세요.</p>';
    return;
  }
  channels.forEach(ch => {
    const card = document.createElement('div');
    card.className = 'channel-card';
    card.innerHTML = `
      <img src="${ch.thumbnail || ''}" class="thumb" alt="thumb">
      <div class="meta">
        <h3 title="${ch.title}">${ch.title}</h3>
        <div class="sub">구독자: ${parseInt(ch.subscriberCount||'0').toLocaleString()}명</div>
        <div class="counts">영상: ${parseInt(ch.videoCount||'0').toLocaleString()}개</div>
        <div class="latest">최신 업로드: ${ch.latestUploadDate ? moment(ch.latestUploadDate).format('YYYY-MM-DD') : '-'}</div>
      </div>
      <div class="actions">
        <button data-act="del" data-id="${ch.id}">삭제</button>
      </div>
    `;
    card.querySelector('[data-act="del"]').onclick = async () => {
      if (confirm('이 채널을 삭제하시겠습니까?')) {
        await idbDelete('my_channels', ch.id);
        updateAll();
      }
    };
    channelListContainer.appendChild(card);
  });
}
function sortChannels(list, mode) {
  if (mode === 'videos') {
    list.sort((a,b) => parseInt(b.videoCount||'0') - parseInt(a.videoCount||'0'));
  } else if (mode === 'latest') {
    list.sort((a,b) => new Date(b.latestUploadDate||0) - new Date(a.latestUploadDate||0));
  } else {
    // subscribers (default)
    list.sort((a,b) => parseInt(b.subscriberCount||'0') - parseInt(a.subscriberCount||'0'));
  }
}

// 공통 유틸
function chunkArray(arr, size) {
  const out = [];
  for (let i=0; i<arr.length; i+=size) out.push(arr.slice(i, i+size));
  return out;
}
async function getPlaylistItems(playlistId, maxResults = 50, pageToken = null) {
  const cacheKey = `${playlistId}_${maxResults}_${pageToken || ''}`;
  if (playlistCache[cacheKey]) return playlistCache[cacheKey];
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const data = await fetchYoutubeApi(url);
  playlistCache[cacheKey] = data;
  return data;
}
async function getVideoDetails(videoIds) {
  const uncached = videoIds.filter(id => !videoDetailCache[id]);
  if (uncached.length) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${uncached.join(',')}`;
    const data = await fetchYoutubeApi(url);
    data.items.forEach(item => {
      videoDetailCache[item.id] = {
        id: item.id,
        title: item.snippet.title,
        duration: item.contentDetails.duration,
        viewCount: parseInt(item.statistics.viewCount || '0'),
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.medium?.url
          || item.snippet.thumbnails?.default?.url
          || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`
      };
    });
  }
  return videoIds.map(id => videoDetailCache[id]).filter(Boolean);
}

/* ===============================
   (2) 돌연변이 영상
   =============================== */
async function updateMutantVideos() {
  mutantVideoList.innerHTML = '<p class="muted">로딩 중...</p>';
  let allMutant = [];
  let minDate = null;
  if (currentMutantPeriod !== 'all') {
    minDate = moment().subtract(parseInt(currentMutantPeriod), 'months');
  }
  const channels = await idbGetAll('my_channels');

  for (const ch of channels) {
    if (!ch.uploadsPlaylistId) {
      // 없으면 보강
      const infoUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${ch.id}`;
      const info = await fetchYoutubeApi(infoUrl);
      ch.uploadsPlaylistId = info.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || '';
      await idbPut('my_channels', ch);
    }
    if (!ch.uploadsPlaylistId) continue;

    // 기간 필터링하며 영상 수집
    let nextPageToken = '', hasMore = true, videoIds = [];
    while (hasMore) {
      const p = await getPlaylistItems(ch.uploadsPlaylistId, 50, nextPageToken);
      const items = p.items || [];
      const filtered = minDate
        ? items.filter(i => moment(i.snippet.publishedAt).isAfter(minDate))
        : items;
      videoIds.push(...filtered.map(i => i.contentDetails.videoId));
      nextPageToken = p.nextPageToken;
      if (!nextPageToken || (minDate && filtered.length < items.length)) hasMore = false;
    }
    if (!videoIds.length) continue;

    // 상세
    let details = [];
    for (const chunk of chunkArray(videoIds, 50)) {
      const part = await getVideoDetails(chunk);
      details = details.concat(part);
    }

    const subs = parseInt(ch.subscriberCount || '1');
    const mutantForCh = details
      .filter(v => isLongform(v.duration) && v.viewCount >= (subs * 2))
      .map(v => ({
        ...v,
        mutantIndex: calculateMutantIndex(v.viewCount, subs),
        __channel: {
          id: ch.id,
          title: ch.title,
          subscriberCount: parseInt(ch.subscriberCount||'0'),
          videoCount: parseInt(ch.videoCount||'0'),
          latestUploadDate: ch.latestUploadDate ? new Date(ch.latestUploadDate) : new Date(0)
        }
      }));
    allMutant = allMutant.concat(mutantForCh);
  }

  // 정렬(채널 기준 + 옵션)
  sortVideoCards(allMutant, mutantSortSelect.value);

  renderVideoCards(allMutant, mutantVideoList);
}

/* ===============================
   (3) 최신 영상
   =============================== */
async function updateLatestVideos() {
  latestVideoList.innerHTML = '<p class="muted">로딩 중...</p>';
  const channels = await idbGetAll('my_channels');
  const allLatest = [];

  for (const ch of channels) {
    if (!ch.uploadsPlaylistId) {
      const infoUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${ch.id}`;
      const info = await fetchYoutubeApi(infoUrl);
      ch.uploadsPlaylistId = info.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || '';
      await idbPut('my_channels', ch);
    }
    if (!ch.uploadsPlaylistId) continue;

    let nextPageToken = null, found = null;
    while (!found) {
      const data = await getPlaylistItems(ch.uploadsPlaylistId, 10, nextPageToken);
      const ids = (data.items || []).map(i => i.contentDetails.videoId);
      if (!ids.length) break;
      const details = await getVideoDetails(ids);
      for (const v of details) {
        if (isLongform(v.duration)) {
          found = {
            ...v,
            mutantIndex: calculateMutantIndex(v.viewCount, parseInt(ch.subscriberCount || '1')),
            __channel: {
              id: ch.id,
              title: ch.title,
              subscriberCount: parseInt(ch.subscriberCount||'0'),
              videoCount: parseInt(ch.videoCount||'0'),
              latestUploadDate: ch.latestUploadDate ? new Date(ch.latestUploadDate) : new Date(0)
            }
          };
          break;
        }
      }
      nextPageToken = data.nextPageToken;
      if (!nextPageToken) break;
    }
    if (found) allLatest.push(found);
  }

  // 정렬(채널 기준 + 옵션)
  sortVideoCards(allLatest, latestSortSelect.value);

  if (!allLatest.length) {
    latestVideoList.innerHTML = '<p class="muted">등록된 채널에 영상이 없습니다.</p>';
    return;
  }
  renderVideoCards(allLatest, latestVideoList);
}

/* ===============================
   공통: 영상 카드 렌더 + 정렬
   =============================== */
function sortVideoCards(list, mode) {
  if (mode === 'videos') {
    list.sort((a,b) => (b.__channel.videoCount) - (a.__channel.videoCount));
  } else if (mode === 'latest') {
    list.sort((a,b) => (b.__channel.latestUploadDate) - (a.__channel.latestUploadDate));
  } else if (mode === 'mutantIndex') {
    list.sort((a,b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
  } else {
    // subscribers (default)
    list.sort((a,b) => (b.__channel.subscriberCount) - (a.__channel.subscriberCount));
  }
}

function renderVideoCards(videos, container) {
  if (!videos.length) {
    container.innerHTML = '<p class="muted">표시할 영상이 없습니다.</p>';
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'video-vertical-list';

  videos.forEach(v => {
    const card = document.createElement('div');
    card.className = 'my-channel-mutant-item';
    card.innerHTML = `
      <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" style="text-decoration:none;color:inherit;width:100%;">
        <img src="${v.thumbnail}" class="my-channel-mutant-thumb" alt="thumbnail">
        <div class="my-channel-mutant-title2" title="${v.title}">${v.title}</div>
        <div class="my-channel-mutant-extra">
          <span class="my-channel-mutant-views">조회수: ${v.viewCount.toLocaleString()}</span>
          <span class="my-channel-mutant-date">${moment(v.publishedAt).format('YYYY-MM-DD')}</span>
        </div>
        <div class="mutant-index-badge">${v.mutantIndex}</div>
      </a>
    `;
    wrap.appendChild(card);
  });
  container.innerHTML = '';
  container.appendChild(wrap);
}
