// js/my-channel-manager.js

import { fetchYoutubeApi, loadApiKeys } from './js/api_keys.js';
import { isLongform, calculateMutantIndex } from './js/utils.js';

let myChannels = [];
let currentSearchResults = [];
let currentSearchPage = 1;
const ITEMS_PER_PAGE = 5;

// DOM 캐시
const tabBtns = document.querySelectorAll('.tab-button');
const myAddChannelBtn = document.getElementById('my-add-channel-btn');
const myTrackBtn = document.getElementById('my-track-btn');
const myChannelList = document.getElementById('my-channel-list');
const myChannelCount = document.getElementById('my-channel-count');
const myChannelSearchModal = document.getElementById('my-channel-search-modal');
const myChannelSearchResults = document.getElementById('my-channel-search-results');
const myPagination = document.getElementById('my-pagination');
const myCloseBtn = myChannelSearchModal.querySelector('.close-button');
const apiKeyBtn = document.getElementById('open-api-key-popup');
const apiKeyModal = document.getElementById('api-key-modal');
const apiCloseBtns = document.querySelectorAll('.modal .close-button');

// **탭 이동 (다른 html 연결)**
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === 'channel-monitor') {
      window.location.href = 'index.html';
    }
    if (tab === 'my-channel-manager') {
      window.location.href = 'my-channel-manager.html';
    }
    // 기타 탭은 상황에 맞게 확장
  });
});

// **API키 입력 모달 열기**
if (apiKeyBtn) {
  apiKeyBtn.addEventListener('click', () => {
    apiKeyModal.style.display = 'block';
  });
}

// **모든 닫기 버튼**
apiCloseBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal').style.display = 'none';
  });
});
window.addEventListener('click', (event) => {
  document.querySelectorAll('.modal').forEach(modal => {
    if (event.target === modal) modal.style.display = 'none';
  });
});

// **로컬 스토리지에서 채널 목록 불러오기/저장**
function loadMyChannels() {
  const saved = localStorage.getItem('myChannels');
  myChannels = saved ? JSON.parse(saved) : [];
}
function saveMyChannels() {
  localStorage.setItem('myChannels', JSON.stringify(myChannels));
}

// **내 채널 리스트 출력**
function renderMyChannelList() {
  myChannelCount.textContent = myChannels.length;
  myChannelList.innerHTML = '';

  if (myChannels.length === 0) {
    myChannelList.innerHTML = `<div class="my-channel-empty">등록된 채널이 없습니다.</div>`;
    return;
  }
  myChannels.forEach(channel => {
    const el = document.createElement('div');
    el.className = 'my-channel-item';
    el.innerHTML = `
      <img src="${channel.logo}" alt="${channel.name}" class="my-channel-logo">
      <div class="my-channel-info">
        <div class="my-channel-title">${channel.name}</div>
        <div class="my-channel-meta">구독자: ${parseInt(channel.subscriberCount).toLocaleString()}명</div>
      </div>
      <button class="my-channel-del-btn" data-id="${channel.id}">삭제</button>
    `;
    el.querySelector('.my-channel-del-btn').addEventListener('click', () => {
      if (confirm('이 채널을 삭제하시겠습니까?')) {
        myChannels = myChannels.filter(c => c.id !== channel.id);
        saveMyChannels();
        renderMyChannelList();
      }
    });
    myChannelList.appendChild(el);
  });
}

// **채널 추가 - 검색(모달)**
myAddChannelBtn.addEventListener('click', async () => {
  const q = prompt('추가할 채널명을 입력하세요:');
  if (!q) return;
  currentSearchResults = [];
  currentSearchPage = 1;
  // 모든 검색결과 수집 (최대 100개까지, 5개씩 분할)
  let nextPageToken = '';
  let totalResults = 0;
  do {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=channel&maxResults=50${nextPageToken ? '&pageToken=' + nextPageToken : ''}`;
    const data = await fetchYoutubeApi(url);
    currentSearchResults.push(...data.items);
    totalResults += data.items.length;
    nextPageToken = data.nextPageToken;
    // 최대 100개까지만 표시
  } while (nextPageToken && currentSearchResults.length < 100);

  displaySearchResultsPaginated();
  myChannelSearchModal.style.display = 'block';
});

// **검색 모달 닫기**
myCloseBtn.addEventListener('click', () => {
  myChannelSearchModal.style.display = 'none';
});

// **검색결과 페이지네이션 및 선택**
function displaySearchResultsPaginated() {
  myChannelSearchResults.innerHTML = '';
  myPagination.innerHTML = '';
  const totalPages = Math.ceil(currentSearchResults.length / ITEMS_PER_PAGE);

  // 페이지네이션 (최대 3페이지)
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
    myPagination.appendChild(prevBtn);
  }
  // Page number (1~3)
  for (let p = 1; p <= Math.min(totalPages, 3); p++) {
    const btn = document.createElement('button');
    btn.textContent = p;
    btn.className = (p === currentSearchPage) ? 'active' : '';
    btn.addEventListener('click', () => {
      currentSearchPage = p;
      displaySearchResultsPaginated();
    });
    myPagination.appendChild(btn);
  }
  // Next
  if (totalPages > 1) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '다음';
    nextBtn.disabled = currentSearchPage === totalPages || currentSearchPage === 3;
    nextBtn.addEventListener('click', () => {
      if (currentSearchPage < totalPages && currentSearchPage < 3) {
        currentSearchPage++;
        displaySearchResultsPaginated();
      }
    });
    myPagination.appendChild(nextBtn);
  }

  // 현재 페이지에 해당하는 결과만 표시
  const start = (currentSearchPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = currentSearchResults.slice(start, end);

  if (pageItems.length === 0) {
    myChannelSearchResults.innerHTML = `<div>검색 결과가 없습니다.</div>`;
    return;
  }
  pageItems.forEach(item => {
    const ch = item.snippet;
    const el = document.createElement('div');
    el.className = 'my-channel-search-item';
    el.innerHTML = `
      <img src="${ch.thumbnails.default.url}" alt="${ch.title}" class="my-channel-search-logo">
      <span>${ch.title}</span>
    `;
    el.addEventListener('click', async () => {
      // 중복 체크 (이미 등록되어 있다면 무시)
      if (myChannels.some(c => c.id === item.id.channelId)) {
        alert('이미 등록된 채널입니다.');
        return;
      }
      // 채널 정보 추가
      const info = await fetchChannelDetails(item.id.channelId);
      myChannels.push(info);
      saveMyChannels();
      renderMyChannelList();
      myChannelSearchModal.style.display = 'none';
    });
    myChannelSearchResults.appendChild(el);
  });
}

// **유튜브 채널 상세정보**
async function fetchChannelDetails(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}`;
  const data = await fetchYoutubeApi(url);
  const item = data.items[0];
  return {
    id: channelId,
    name: item.snippet.title,
    logo: item.snippet.thumbnails.default.url,
    subscriberCount: item.statistics.subscriberCount
  };
}

// **추적 시작 버튼 (예시)**
myTrackBtn.addEventListener('click', () => {
  alert('추적을 시작합니다.\n(이벤트에 맞게 원하는 기능 구현)');
});

// **초기 실행**
loadMyChannels();
renderMyChannelList();

