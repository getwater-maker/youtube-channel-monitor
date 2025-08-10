// js/main.js (IndexedDB 통일 + '내 채널 추가' UX 이식 + 카드 UI 통일)
// 그대로 덮어써 주세요.

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
    req.onupgradeneeded = function (e) {
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
    const tx = db.transaction(storeName, 'readonly'); const store = tx.objectStore(storeName);
    const req = store.getAll(); req.onsuccess = () => resolve(req.result); req.onerror = e => reject(e);
  }));
}
function idbPut(storeName, data) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite'); const store = tx.objectStore(storeName);
    const req = store.put(data); req.onsuccess = () => resolve(req.result); req.onerror = e => reject(e);
  }));
}
function idbDelete(storeName, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite'); const store = tx.objectStore(storeName);
    const req = store.delete(key); req.onsuccess = () => resolve(); req.onerror = e => reject(e);
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

// API 키 모달 관련
const apiKeyModal = document.getElementById('api-key-modal');
const openApiKeyPopupButton = document.getElementById('open-api-key-popup');
const closeButton = document.querySelector('#api-key-modal .close-button');
const saveApiKeysButton = document.getElementById('save-api-keys');
const apiKeyInputs = document.querySelectorAll('.api-key-input');
const apiKeyFileUpload = document.getElementById('api-key-file-upload');
const downloadApiKeysButton = document.getElementById('download-api-keys');

// 기간 선택
let currentMutantPeriod = '6m';

// 채널 모니터용 새 모달
const cmModal = document.getElementById('add-channel-cm-modal');
const cmModalClose = document.getElementById('close-add-channel-cm-modal');
const cmSearchInput = document.getElementById('cm-channel-search-input');
const cmSearchBtn = document.getElementById('cm-search-channel-btn');
const cmResults = document.getElementById('cm-channel-search-results');
const cmDirectInput = document.getElementById('cm-channel-id-input');
const cmSaveBtn = document.getElementById('cm-save-channel-btn');

/* ===============================
   캐시
   =============================== */
const playlistCache = {};
const videoDetailCache = {};

/* ===============================
   유틸
   =============================== */
function extractChannelId(input) {
  // /channel/UCxxxx, /@handle, 그냥 UCxxxx 모두 지원
  input = input.trim();
  const ucMatch = input.match(/(UC[0-9A-Za-z_-]{22})/);
  if (ucMatch) return ucMatch[1];
  const url = input.toLowerCase();
  if (url.includes('youtube.com') && url.includes('/channel/')) {
    const m = input.match(/channel\/(UC[0-9A-Za-z_-]{22})/);
    if (m) return m[1];
  }
  // @handle 지원 → search API로 처리하므로 여기서는 null 반환
  return null;
}
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ===============================
   초기화
   =============================== */
document.addEventListener('DOMContentLoaded', () => {
  moment.locale('ko');
  setupEventListeners();
  updateUI();

  // 섹션 토글(접기/펼치기)
  const toggleBtn = document.getElementById('toggle-section1-btn');
  const section1Content = document.getElementById('section1-content');
  let originalDisplay = getComputedStyle(section1Content).display;
  section1Content.style.display = 'none';
  toggleBtn.textContent = '▶';
  toggleBtn.addEventListener('click', () => {
    if (section1Content.style.display === 'none') {
      section1Content.style.display = originalDisplay === 'none' ? 'block' : originalDisplay;
      toggleBtn.textContent = '▼';
    } else {
      section1Content.style.display = 'none';
      toggleBtn.textContent = '▶';
    }
  });
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
  saveApiKeysButton.addEventListener('click', handleSaveApiKeys);
  apiKeyFileUpload.addEventListener('change', handleApiKeyFileUpload);
  downloadApiKeysButton.addEventListener('click', downloadApiKeys);

  // 탭 전환 (내 채널 관리 탭 초기화는 기존 파일이 처리)
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      button.classList.add('active');
      const tabId = button.dataset.tab;
      const tabContent = document.getElementById(tabId);
      if (tabContent) tabContent.classList.add('active');
    });
  });

  // 기간 버튼
  document.querySelector('.date-range-controls').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
      document.querySelectorAll('.date-range-controls button').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentMutantPeriod = e.target.dataset.period;
      updateMutantVideosSection();
    }
  });

  // 채널 모니터: "채널 추가" → 내 채널 추가 UX 이식 모달 열기
  addChannelButton.addEventListener('click', () => {
    cmSearchInput.value = '';
    cmResults.innerHTML = '';
    cmDirectInput.value = '';
    cmModal.style.display = 'block';
  });
  cmModalClose.addEventListener('click', () => cmModal.style.display = 'none');

  // 검색
  cmSearchBtn.addEventListener('click', handleCmSearch);
  // 직접 입력 등록
  cmSaveBtn.addEventListener('click', async () => {
    let input = cmDirectInput.value.trim();
    if (!input) { alert('채널 ID 또는 URL을 입력하세요.'); return; }
    let channelId = extractChannelId(input);
    if (!channelId) {
      // 핸들이나 일반 검색어면 search API로 탐색
      await registerBySearchKeyword(input);
    } else {
      await registerChannelById(channelId);
    }
    cmModal.style.display = 'none';
    updateUI();
  });
}

/* ===============================
   API 키 핸들러
   =============================== */
function handleSaveApiKeys() {
  const keys = Array.from(apiKeyInputs).map(i => i.value.trim());
  const ok = saveApiKeys(keys);
  if (ok) {
    alert('API 키가 저장되었습니다.');
    apiKeyModal.style.display = 'none';
  }
}
function handleApiKeyFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const keys = reader.result.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 5);
    apiKeyInputs.forEach((input, idx) => input.value = keys[idx] || '');
  };
  reader.readAsText(file);
}

/* ===============================
   채널 모니터: 채널 목록/삭제(IndexedDB)
   =============================== */
async function updateUI() {
  await displayChannelList();
  const channels = await idbGetAll('my_channels');
  if (channels.length > 0) {
    await updateMutantVideosSection();
    await updateLatestVideosSection();
  } else {
    mutantVideoList.innerHTML = '<p>채널을 추가하여 영상을 분석해주세요.</p>';
    latestVideoList.innerHTML = '<p>채널을 추가하여 영상을 분석해주세요.</p>';
  }
}

async function displayChannelList() {
  const channels = await idbGetAll('my_channels');
  channelListContainer.innerHTML = '';
  channelCountSpan.textContent = channels.length;

  channels.forEach(channel => {
    const el = document.createElement('div');
    el.className = 'channel-item';
    el.innerHTML = `
      <div class="channel-info-wrapper">
        <a href="https://www.youtube.com/channel/${channel.id}" target="_blank">
          <img src="${channel.thumbnail || ''}" alt="${channel.title || channel.name} 로고" style="width:50px;height:50px;border-radius:50%;margin-right:10px;">
        </a>
        <div>
          <h3><a href="https://www.youtube.com/channel/${channel.id}" target="_blank">${channel.title || channel.name}</a></h3>
          <p>구독자: ${parseInt(channel.subscriberCount || '0').toLocaleString()}명</p>
          <p>돌연변이 영상: <span id="mutant-count-${channel.id}">...</span>개</p>
        </div>
      </div>
      <button class="delete-channel-button" data-channel-id="${channel.id}">삭제</button>
    `;
    channelListContainer.appendChild(el);
  });

  channelListContainer.querySelectorAll('.delete-channel-button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.channelId;
      if (confirm('이 채널을 삭제하시겠습니까?')) {
        await idbDelete('my_channels', id);
        updateUI();
      }
    });
  });
}

/* ===============================
   채널 등록 (검색/페이지네이션/직접 입력) - 내 채널 관리 UX 이식
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
      updateUI();
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

// 키워드/핸들로 들어온 경우: 첫 결과 등록 시도
async function registerBySearchKeyword(keyword) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(keyword)}`;
  const data = await fetchYoutubeApi(url);
  if (!data.items?.length) { alert('채널을 찾을 수 없습니다.'); return; }
  await registerChannelById(data.items[0].id.channelId);
}

// 실제 등록
async function registerChannelById(channelId) {
  let list = await idbGetAll('my_channels');
  if (list.find(c => c.id === channelId)) {
    alert('이미 등록된 채널입니다.');
    return;
  }
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
    thumbnail: item.snippet.thumbnails?.default?.url || '',
    subscriberCount: item.statistics.subscriberCount
  };
  await idbPut('my_channels', newChannel);
  alert(`${newChannel.title} 채널이 추가되었습니다.`);
}

/* ===============================
   유튜브 API 보조
   =============================== */
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
        // 스타일에서 썸네일이 항상 보이도록 직접 생성 fallback
        thumbnail: item.snippet.thumbnails?.medium?.url
          || item.snippet.thumbnails?.default?.url
          || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`
      };
    });
  }
  return videoIds.map(id => videoDetailCache[id]).filter(Boolean);
}

/* ===============================
   섹션 2: 돌연변이 영상 (카드 UI 적용)
   =============================== */
async function updateMutantVideosSection() {
  mutantVideoList.innerHTML = '<p>로딩 중...</p>';
  let allMutant = [];
  let minDate = null;
  if (currentMutantPeriod !== 'all') {
    minDate = moment().subtract(parseInt(currentMutantPeriod), 'months');
  }
  const channels = await idbGetAll('my_channels');

  for (const ch of channels) {
    // uploads playlist id 가져오기
    const infoUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${ch.id}`;
    const info = await fetchYoutubeApi(infoUrl);
    const uploadPid = info.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadPid) continue;

    // 기간 필터
    let nextPageToken = '', hasMore = true;
    let videoIds = [];
    while (hasMore) {
      const p = await getPlaylistItems(uploadPid, 50, nextPageToken);
      const items = p.items || [];
      const filtered = minDate
        ? items.filter(i => moment(i.snippet.publishedAt).isAfter(minDate))
        : items;
      videoIds.push(...filtered.map(i => i.contentDetails.videoId));
      nextPageToken = p.nextPageToken;
      if (!nextPageToken || (minDate && filtered.length < items.length)) hasMore = false;
    }
    if (!videoIds.length) {
      const countSpan = document.getElementById(`mutant-count-${ch.id}`);
      if (countSpan) countSpan.textContent = '0';
      continue;
    }

    // 상세/통계
    let details = [];
    for (const chunk of chunkArray(videoIds, 50)) {
      const part = await getVideoDetails(chunk);
      details = details.concat(part);
    }

    // 롱폼 + (조회수 ≥ 2 * 구독자)
    const subs = parseInt(ch.subscriberCount || '1');
    const mutantForCh = details
      .filter(v => isLongform(v.duration) && v.viewCount >= (subs * 2))
      .map(v => ({
        ...v,
        mutantIndex: calculateMutantIndex(v.viewCount, subs)
      }));

    allMutant = allMutant.concat(mutantForCh);

    const countSpan = document.getElementById(`mutant-count-${ch.id}`);
    if (countSpan) countSpan.textContent = mutantForCh.length;
  }

  allMutant.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
  renderVideoCards(allMutant, mutantVideoList);
}

/* ===============================
   섹션 3: 최신 롱폼 1개/채널 (카드 UI 적용)
   =============================== */
async function updateLatestVideosSection() {
  latestVideoList.innerHTML = '<p>로딩 중...</p>';
  const channels = await idbGetAll('my_channels');
  const allLatest = [];

  for (const ch of channels) {
    const infoUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${ch.id}`;
    const info = await fetchYoutubeApi(infoUrl);
    const uploadPid = info.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadPid) continue;

    let nextPageToken = null;
    let found = null;
    while (!found) {
      const data = await getPlaylistItems(uploadPid, 10, nextPageToken);
      const ids = (data.items || []).map(i => i.contentDetails.videoId);
      if (!ids.length) break;
      const details = await getVideoDetails(ids);
      for (const v of details) {
        if (isLongform(v.duration)) {
          found = {
            ...v,
            mutantIndex: calculateMutantIndex(v.viewCount, parseInt(ch.subscriberCount || '1'))
          };
          break;
        }
      }
      nextPageToken = data.nextPageToken;
      if (!nextPageToken) break;
    }
    if (found) allLatest.push(found);
  }

  if (!allLatest.length) {
    latestVideoList.innerHTML = '<p>등록된 채널에 영상이 없습니다.</p>';
    return;
  }
  allLatest.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
  renderVideoCards(allLatest, latestVideoList);
}

/* ===============================
   카드 UI 렌더 (내 채널 관리 탭과 동일 스타일 활용)
   =============================== */
function renderVideoCards(videos, container) {
  if (!videos.length) {
    container.innerHTML = '<p style="color:#888;">표시할 영상이 없습니다.</p>';
    return;
  }
  // 그리드 래퍼
  const wrap = document.createElement('div');
  wrap.className = 'my-channel-mutant-list';

  videos.forEach(v => {
    const card = document.createElement('div');
    card.className = 'my-channel-mutant-item';
    card.innerHTML = `
      <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" style="text-decoration:none;color:inherit;width:100%;">
        <img src="${v.thumbnail}" class="my-channel-mutant-thumb" alt="thumbnail">
        <div class="my-channel-mutant-title2">${v.title}</div>
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
