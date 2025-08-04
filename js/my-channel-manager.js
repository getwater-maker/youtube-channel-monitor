// js/my-channel-manager.js

import { fetchYoutubeApi } from './api_keys.js';

let myChannels = [];
let searchResults = [];
let currentPage = 1;
let totalPages = 1;
let currentKeyword = '';
let pageTokens = {}; // {page: pageToken}

const addChannelBtn = document.getElementById('my-add-channel-btn');
const myChannelListDiv = document.getElementById('my-channel-list');
const searchModal = document.getElementById('my-channel-search-modal');
const searchResultsDiv = document.getElementById('my-channel-search-results');
const paginationDiv = document.getElementById('my-pagination');
const closeModalBtn = searchModal.querySelector('.close-button');

// ---- 초기 로딩 ----
document.addEventListener('DOMContentLoaded', () => {
    loadMyChannels();
    addChannelBtn.addEventListener('click', openChannelSearch);
    closeModalBtn.addEventListener('click', () => { searchModal.style.display = 'none'; });
    window.addEventListener('click', (e) => {
        if (e.target === searchModal) searchModal.style.display = 'none';
    });
});

// ---- 채널 리스트 관리 ----
function loadMyChannels() {
    const saved = localStorage.getItem('myChannels');
    myChannels = saved ? JSON.parse(saved) : [];
    renderMyChannels();
}

function renderMyChannels() {
    myChannelListDiv.innerHTML = '';
    myChannels.forEach(c => {
        const div = document.createElement('div');
        div.className = 'my-channel-card';
        div.innerHTML = `
            <img src="${c.logo}" alt="${c.name}" class="my-channel-logo">
            <div>
                <b>${c.name}</b><br>
                구독자: ${parseInt(c.subscriberCount).toLocaleString()}명
            </div>
            <button class="my-remove-btn" data-id="${c.id}">삭제</button>
        `;
        div.querySelector('.my-remove-btn').onclick = () => {
            myChannels = myChannels.filter(ch => ch.id !== c.id);
            localStorage.setItem('myChannels', JSON.stringify(myChannels));
            renderMyChannels();
        };
        myChannelListDiv.appendChild(div);
    });
}

// ---- 채널 추가 모달 ----
async function openChannelSearch() {
    const name = prompt('추가할 채널명을 입력하세요:');
    if (!name) return;
    currentKeyword = name;
    pageTokens = {1: ''}; // 1페이지는 빈 토큰
    await searchChannels(name, 1);
    searchModal.style.display = 'block';
}

async function searchChannels(keyword, page) {
    const maxResults = 5;
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(keyword)}&maxResults=${maxResults}`;
    const token = pageTokens[page] || '';
    if (token) url += `&pageToken=${token}`;

    const data = await fetchYoutubeApi(url);
    searchResults = data.items || [];

    // 페이지 토큰 저장
    if (data.nextPageToken) pageTokens[page + 1] = data.nextPageToken;
    if (page > 1 && data.prevPageToken) pageTokens[page - 1] = data.prevPageToken;
    totalPages = 100; // 임의의 큰 수(실제 page 개수 알기 어렵지만, nextPageToken 없으면 마지막임)
    currentPage = page;

    renderSearchResults();
    renderPagination();
}

function renderSearchResults() {
    searchResultsDiv.innerHTML = '';
    searchResults.forEach(item => {
        const channelId = item.id.channelId;
        const title = item.snippet.title;
        const logo = item.snippet.thumbnails.default.url;
        const div = document.createElement('div');
        div.className = 'my-channel-search-result';
        div.innerHTML = `
            <img src="${logo}" alt="${title}" class="my-channel-search-logo">
            <span>${title}</span>
        `;
        div.onclick = async () => {
            // 중복 체크
            if (myChannels.find(c => c.id === channelId)) {
                alert('이미 등록된 채널입니다.');
                return;
            }
            // 채널 상세정보 가져오기
            const info = await getChannelDetails(channelId);
            myChannels.push(info);
            localStorage.setItem('myChannels', JSON.stringify(myChannels));
            renderMyChannels();
            searchModal.style.display = 'none';
        };
        searchResultsDiv.appendChild(div);
    });
}

// ---- 페이지네이션 ----
function renderPagination() {
    paginationDiv.innerHTML = '';
    let pages = [];
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(start + 4, totalPages);
    if (end - start < 4) start = Math.max(1, end - 4);

    // Prev
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '이전';
        prevBtn.onclick = () => searchChannels(currentKeyword, currentPage - 1);
        paginationDiv.appendChild(prevBtn);
    }

    // 1 ... pages ... n
    if (start > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.onclick = () => searchChannels(currentKeyword, 1);
        paginationDiv.appendChild(firstBtn);
        if (start > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            paginationDiv.appendChild(dots);
        }
    }

    for (let i = start; i <= end; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.className = 'active';
        btn.onclick = () => searchChannels(currentKeyword, i);
        paginationDiv.appendChild(btn);
    }

    // ... n
    if (end < totalPages) {
        if (end < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            paginationDiv.appendChild(dots);
        }
        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.onclick = () => searchChannels(currentKeyword, totalPages);
        paginationDiv.appendChild(lastBtn);
    }

    // Next
    if (pageTokens[currentPage + 1]) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '다음';
        nextBtn.onclick = () => searchChannels(currentKeyword, currentPage + 1);
        paginationDiv.appendChild(nextBtn);
    }
}

// ---- 채널상세 ----
async function getChannelDetails(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const item = data.items[0];
    return {
        id: channelId,
        name: item.snippet.title,
        logo: item.snippet.thumbnails.default.url,
        subscriberCount: item.statistics.subscriberCount,
    };
}
