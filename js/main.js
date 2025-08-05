// main.js - 영상 정보, UI 일관성 통일 버전

import { isLongform, calculateMutantIndex } from './utils.js';
import { loadApiKeys, saveApiKeys, fetchYoutubeApi, downloadApiKeys } from './api_keys.js';

// DOM 요소 캐싱
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

// 채널 선택 모달
const channelSelectModal = document.getElementById('channel-select-modal');
const channelSearchResults = document.getElementById('channel-search-results');
const channelSelectCloseButton = document.querySelector('#channel-select-modal .close-button');

// 채널 목록
let channels = [];
let currentMutantPeriod = '6m';

// API 데이터 임시 저장소
const playlistCache = {};
const videoDetailCache = {};

// 초기 로딩
document.addEventListener('DOMContentLoaded', () => {
    moment.locale('ko');
    loadChannels();
    setupEventListeners();
    updateUI();

    // 채널 추가 토글 섹션
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
    addChannelButton.addEventListener('click', handleAddChannel);

    openApiKeyPopupButton.addEventListener('click', () => {
        const storedKeys = loadApiKeys();
        apiKeyInputs.forEach((input, index) => {
            input.value = storedKeys[index] || '';
        });
        apiKeyModal.style.display = 'block';
    });
    closeButton.addEventListener('click', () => apiKeyModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === apiKeyModal) apiKeyModal.style.display = 'none';
    });
    saveApiKeysButton.addEventListener('click', handleSaveApiKeys);
    apiKeyFileUpload.addEventListener('change', handleApiKeyFileUpload);
    downloadApiKeysButton.addEventListener('click', downloadApiKeys);

    channelSelectCloseButton.addEventListener('click', () => channelSelectModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === channelSelectModal) channelSelectModal.style.display = 'none';
    });

    document.querySelector('.date-range-controls').addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            document.querySelectorAll('.date-range-controls button').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            currentMutantPeriod = event.target.dataset.period;
            updateMutantVideosSection();
        }
    });

    channelListContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-channel-button')) {
            const channelIdToDelete = event.target.dataset.channelId;
            deleteChannel(channelIdToDelete);
        }
    });
}

// 채널 목록 로드/저장
function loadChannels() {
    const storedChannels = localStorage.getItem('registeredChannels');
    if (storedChannels) {
        channels = JSON.parse(storedChannels);
    }
}
function saveChannels() {
    localStorage.setItem('registeredChannels', JSON.stringify(channels));
}

// UI 업데이트
async function updateUI() {
    displayChannelList();
    if (channels.length > 0) {
        await updateMutantVideosSection();
        await updateLatestVideosSection();
    } else {
        mutantVideoList.innerHTML = '<p>채널을 추가하여 영상을 분석해주세요.</p>';
        latestVideoList.innerHTML = '<p>채널을 추가하여 영상을 분석해주세요.</p>';
    }
}

// 채널 추가 및 검색
async function handleAddChannel() {
    const channelName = prompt('추가할 채널명을 입력하세요:');
    if (!channelName) return;

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelName)}&type=channel`;
        const data = await fetchYoutubeApi(url);

        if (data.items.length === 0) {
            alert('채널을 찾을 수 없습니다.');
            return;
        }

        if (data.items.length > 1) {
            displaySearchResults(data.items);
        } else {
            addChannel(data.items[0].id.channelId);
        }

    } catch (error) {
        alert('채널을 추가하는 중 오류가 발생했습니다. API 키를 확인해주세요.');
    }
}

// 채널 검색 결과 모달 표시 (UI 일관화)
function displaySearchResults(results) {
    const ITEMS_PER_PAGE = 5;
    let currentPage = 1;
    let totalPage = Math.ceil(results.length / ITEMS_PER_PAGE);

    function renderPage(page) {
        channelSearchResults.innerHTML = '';
        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageItems = results.slice(start, end);

        pageItems.forEach(item => {
            const channelId = item.id.channelId;
            const channelTitle = item.snippet.title;
            const channelLogo = item.snippet.thumbnails.default.url;

            // 채널 카드 디자인 공통화
            const channelEl = document.createElement('div');
            channelEl.className = 'channel-item';
            channelEl.style.cursor = 'pointer';
            channelEl.style.display = 'flex';
            channelEl.style.alignItems = 'center';
            channelEl.innerHTML = `
                <img src="${channelLogo}" alt="${channelTitle} 로고" style="width:56px;height:56px;border-radius:50%;margin-right:14px;">
                <span style="font-size:1rem;font-weight:600;flex:1;">${channelTitle}</span>
                <button class="my-button" style="margin-left:auto;">등록</button>
            `;
            channelEl.querySelector('button').onclick = () => {
                addChannel(channelId);
                channelSelectModal.style.display = 'none';
            };
            channelSearchResults.appendChild(channelEl);
        });

        // 페이지네이션
        if (totalPage > 1) {
            const paginationDiv = document.createElement('div');
            paginationDiv.style.display = "flex";
            paginationDiv.style.justifyContent = "center";
            paginationDiv.style.gap = "8px";
            paginationDiv.style.marginTop = "15px";

            // prev
            const prevBtn = document.createElement('button');
            prevBtn.textContent = "Prev";
            prevBtn.disabled = page === 1;
            prevBtn.style.opacity = page === 1 ? "0.5" : "1";
            prevBtn.onclick = () => {
                if (currentPage > 1) {
                    currentPage -= 1;
                    renderPage(currentPage);
                }
            };
            paginationDiv.appendChild(prevBtn);

            // page numbers
            for (let i = 1; i <= totalPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.textContent = i;
                if (i === page) pageBtn.style.background = "#c4302b", pageBtn.style.color="white";
                pageBtn.onclick = () => {
                    currentPage = i;
                    renderPage(currentPage);
                };
                paginationDiv.appendChild(pageBtn);
            }

            // next
            const nextBtn = document.createElement('button');
            nextBtn.textContent = "Next";
            nextBtn.disabled = page === totalPage;
            nextBtn.style.opacity = page === totalPage ? "0.5" : "1";
            nextBtn.onclick = () => {
                if (currentPage < totalPage) {
                    currentPage += 1;
                    renderPage(currentPage);
                }
            };
            paginationDiv.appendChild(nextBtn);

            channelSearchResults.appendChild(paginationDiv);
        }
    }

    renderPage(1);
    channelSelectModal.style.display = 'block';
}

// 채널 실제 추가
async function addChannel(channelId) {
    if (channels.some(c => c.id === channelId)) {
        alert('이미 등록된 채널입니다.');
        return;
    }

    try {
        const channelDetails = await getChannelDetails(channelId);
        channels.push(channelDetails);
        saveChannels();
        updateUI();
    } catch (error) {
        alert('채널 정보를 가져오는 중 오류가 발생했습니다.');
    }
}

// 채널 삭제
function deleteChannel(channelId) {
    if (confirm('이 채널을 삭제하시겠습니까?')) {
        channels = channels.filter(channel => channel.id !== channelId);
        saveChannels();
        updateUI();
    }
}

// 채널 상세 정보 불러오기
async function getChannelDetails(channelId) {
    const exist = channels.find(c => c.id === channelId);
    if (exist) return exist;

    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const item = data.items[0];
    const uploadsPlaylistId = item.contentDetails.relatedPlaylists.uploads;

    return {
        id: channelId,
        name: item.snippet.title,
        logo: item.snippet.thumbnails.default.url,
        subscriberCount: item.statistics.subscriberCount,
        latestUploadDate: item.snippet.publishedAt,
        uploadsPlaylistId: uploadsPlaylistId,
        mutantVideosCount: 0
    };
}

// 채널 목록 UI 표시 (카드형 공통화)
function displayChannelList() {
    channelListContainer.innerHTML = '';
    channelCountSpan.textContent = channels.length;

    channels.forEach(channel => {
        const channelEl = document.createElement('div');
        channelEl.classList.add('channel-item');
        channelEl.innerHTML = `
            <div class="channel-info-wrapper">
                <a href="https://www.youtube.com/channel/${channel.id}" target="_blank">
                    <img src="${channel.logo}" alt="${channel.name} 로고">
                </a>
                <div>
                    <h3 style="margin:0;">
                        <a href="https://www.youtube.com/channel/${channel.id}" target="_blank" style="color:var(--main-color);text-decoration:none;">
                            ${channel.name}
                        </a>
                    </h3>
                    <p>구독자: ${parseInt(channel.subscriberCount).toLocaleString()}명</p>
                    <p>최근 업로드: ${moment(channel.latestUploadDate).format('YYYY-MM-DD')}</p>
                    <p>돌연변이 영상: <span id="mutant-count-${channel.id}">...</span>개</p>
                </div>
            </div>
            <button class="delete-channel-button my-button--danger" data-channel-id="${channel.id}">삭제</button>
        `;
        channelListContainer.appendChild(channelEl);
    });
}

// playlistItems 요청 (중복 방지)
async function getPlaylistItems(playlistId, maxResults = 50, pageToken = null) {
    const cacheKey = `${playlistId}_${maxResults}_${pageToken || ''}`;
    if (playlistCache[cacheKey]) {
        return playlistCache[cacheKey];
    }
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&pageToken=${pageToken || ''}`;
    const data = await fetchYoutubeApi(url);
    playlistCache[cacheKey] = data;
    return data;
}

// 돌연변이 영상 목록 (공통 영상카드 구조로)
async function updateMutantVideosSection() {
    mutantVideoList.innerHTML = '<p>로딩 중...</p>';
    let allMutantVideos = [];
    let minDate = null;
    if (currentMutantPeriod !== 'all') {
        minDate = moment().subtract(parseInt(currentMutantPeriod), 'months');
    }

    for (const channel of channels) {
        let nextPageToken = null;
        let videoIds = [];
        let hasMoreVideos = true;

        while (hasMoreVideos) {
            const playlistData = await getPlaylistItems(channel.uploadsPlaylistId, 50, nextPageToken);
            const recentItems = playlistData.items.filter(item => {
                if (minDate) {
                    return moment(item.snippet.publishedAt).isAfter(minDate);
                }
                return true;
            });

            videoIds = videoIds.concat(recentItems.map(item => item.contentDetails.videoId));

            if (minDate && recentItems.length < playlistData.items.length) {
                hasMoreVideos = false;
            } else {
                nextPageToken = playlistData.nextPageToken;
                if (!nextPageToken) hasMoreVideos = false;
            }
        }

        if (videoIds.length === 0) {
            const countSpan = document.getElementById(`mutant-count-${channel.id}`);
            if (countSpan) countSpan.textContent = '0';
            continue;
        }

        const chunkedVideoIds = chunkArray(videoIds, 50);
        let videoDetails = [];
        for (const chunk of chunkedVideoIds) {
            const details = await getVideoDetails(chunk);
            videoDetails = videoDetails.concat(details);
        }

        const mutantVideosForChannel = [];

        for (const video of videoDetails) {
            const mutantIndex = calculateMutantIndex(video.viewCount, channel.subscriberCount);
            if (parseFloat(mutantIndex) >= 2.0 && isLongform(video.duration)) {
                mutantVideosForChannel.push({ ...video, mutantIndex });
            }
        }

        allMutantVideos = allMutantVideos.concat(mutantVideosForChannel);

        const countSpan = document.getElementById(`mutant-count-${channel.id}`);
        if (countSpan) countSpan.textContent = mutantVideosForChannel.length;
    }

    allMutantVideos.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
    displayVideos(allMutantVideos, mutantVideoList);
}

// 배열을 지정된 크기로 묶는 함수
function chunkArray(arr, chunkSize) {
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }
    return result;
}

// 최신 영상 목록 (공통 영상카드 구조로)
async function updateLatestVideosSection() {
    latestVideoList.innerHTML = '<p>로딩 중...</p>';
    const allLatestVideos = [];

    for (const channel of channels) {
        const latestVideo = await getLatestLongformVideo(channel.uploadsPlaylistId, channel.subscriberCount);
        if (latestVideo) {
            allLatestVideos.push(latestVideo);
        }
    }

    if (allLatestVideos.length === 0) {
        latestVideoList.innerHTML = '<p>등록된 채널에 영상이 없습니다.</p>';
        return;
    }

    allLatestVideos.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
    displayVideos(allLatestVideos, latestVideoList);
}

// 채널의 가장 최근 롱폼 영상 1개 가져오기
async function getLatestLongformVideo(playlistId, subscriberCount) {
    let nextPageToken = null;
    let foundVideo = null;

    while (!foundVideo) {
        const data = await getPlaylistItems(playlistId, 10, nextPageToken);

        const videoIds = data.items.map(item => item.contentDetails.videoId);
        if (videoIds.length === 0) break;

        const videoDetails = await getVideoDetails(videoIds);

        for (const video of videoDetails) {
            if (isLongform(video.duration)) {
                const mutantIndex = calculateMutantIndex(video.viewCount, subscriberCount);
                foundVideo = { ...video, mutantIndex };
                break;
            }
        }

        nextPageToken = data.nextPageToken;
        if (!nextPageToken) break;
    }

    return foundVideo;
}

// 동영상 상세 정보 (썸네일, 제목 등 공통 카드화)
async function getVideoDetails(videoIds) {
    if (videoIds.length === 0) return [];
    const uncached = videoIds.filter(id => !videoDetailCache[id]);
    let newDetails = [];
    if (uncached.length > 0) {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${uncached.join(',')}`;
        const data = await fetchYoutubeApi(url);
        newDetails = data.items.map(item => {
            // 썸네일이 없을 때도 영상ID로 생성
            const fallbackThumbnail = `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`;
            return {
                id: item.id,
                title: item.snippet.title,
                thumbnail: (item.snippet.thumbnails && item.snippet.thumbnails.medium?.url) || fallbackThumbnail,
                publishedAt: item.snippet.publishedAt,
                duration: item.contentDetails.duration,
                viewCount: item.statistics.viewCount || 0,
                mutantIndex: '0.00',
            };
        });
        uncached.forEach((id, idx) => { videoDetailCache[id] = newDetails[idx]; });
    }
    return videoIds.map(id => videoDetailCache[id]).filter(Boolean);
}

// ---------- 공통 영상 카드 UI 렌더 함수 ----------
function displayVideos(videoList, container) {
    container.innerHTML = '';
    if (!videoList || videoList.length === 0) {
        container.innerHTML = '<p style="color:#888;text-align:center;">영상이 없습니다.</p>';
        return;
    }
    videoList.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';

        // 썸네일 위,좌우 동일 여백 & 한줄 제목 & 지수 뱃지
        card.innerHTML = `
            <img class="video-card__thumbnail" src="${video.thumbnail}" alt="썸네일">
            <div class="video-card__title" title="${video.title}">${video.title}</div>
            <div class="video-card__info">
                <span class="video-card__views">조회수: ${parseInt(video.viewCount).toLocaleString()}회</span>
                <span>${video.publishedAt ? moment(video.publishedAt).format('YYYY-MM-DD') : ''}</span>
            </div>
            <span class="video-card__mutant-index">${video.mutantIndex}</span>
        `;
        container.appendChild(card);
    });
}

// ------------- API키 저장/업로드 -------------

function handleSaveApiKeys() {
    const keys = Array.from(apiKeyInputs).map(input => input.value.trim()).filter(Boolean);
    if (saveApiKeys(keys)) {
        alert('API 키가 저장되었습니다.');
        apiKeyModal.style.display = 'none';
    }
}

function handleApiKeyFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        // 여러개 지원
        const keys = content.split('\n').map(line => line.trim()).filter(Boolean);
        if (saveApiKeys(keys)) {
            alert('API 키가 파일에서 저장되었습니다.');
            apiKeyModal.style.display = 'none';
        }
    };
    reader.readAsText(file);
}

