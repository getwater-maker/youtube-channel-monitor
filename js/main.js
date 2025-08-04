// js/main.js

import { isLongform, calculateMutantIndex } from './utils.js';
import { loadApiKeys, saveApiKeys, fetchYoutubeApi, downloadApiKeys } from './api_keys.js';

// DOM 요소
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

// 채널 검색 모달 관련
const channelSelectModal = document.getElementById('channel-select-modal');
const channelSearchResults = document.getElementById('channel-search-results');
const channelSelectCloseButton = document.querySelector('#channel-select-modal .close-button');
const paginationContainer = document.createElement('div'); // 페이지네이션 컨테이너
paginationContainer.className = 'pagination';

// 채널 목록 (로컬스토리지)
let channels = [];
let currentMutantPeriod = '6m';

// 캐시
const playlistCache = {};
const videoDetailCache = {};

document.addEventListener('DOMContentLoaded', () => {
    moment.locale('ko');
    loadChannels();
    setupEventListeners();
    updateUI();
});

// 이벤트
function setupEventListeners() {
    addChannelButton.addEventListener('click', openChannelSearchModal);

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
        if (event.target === channelSelectModal) channelSelectModal.style.display = 'none';
    });
    saveApiKeysButton.addEventListener('click', handleSaveApiKeys);
    apiKeyFileUpload.addEventListener('change', handleApiKeyFileUpload);
    downloadApiKeysButton.addEventListener('click', downloadApiKeys);

    channelSelectCloseButton.addEventListener('click', () => channelSelectModal.style.display = 'none');

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

// 채널 로드/저장
function loadChannels() {
    const storedChannels = localStorage.getItem('registeredChannels');
    if (storedChannels) {
        channels = JSON.parse(storedChannels);
    }
}
function saveChannels() {
    localStorage.setItem('registeredChannels', JSON.stringify(channels));
}

// UI 전체 업데이트
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

// --- 채널 추가 모달, 검색, 페이지네이션 --- //

function openChannelSearchModal() {
    openChannelSearch(''); // 빈 문자열로 최초 검색
}

// 검색 결과 페이지네이션 (5개씩)
let searchResults = [];
let currentSearchPage = 1;
const RESULTS_PER_PAGE = 5;

// 채널 추가/검색 - 이름으로 유튜브 검색
async function openChannelSearch(keyword) {
    const channelName = keyword || prompt('추가할 채널명을 입력하세요:');
    if (!channelName) return;

    // 유튜브 API로 검색 (최대 50개)
    try {
        let allItems = [];
        let nextPageToken = undefined;
        let totalFetched = 0;
        while (totalFetched < 50) {
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelName)}&type=channel&maxResults=25${nextPageToken ? '&pageToken=' + nextPageToken : ''}`;
            const data = await fetchYoutubeApi(url);
            if (data.items && data.items.length) {
                allItems = allItems.concat(data.items);
                totalFetched += data.items.length;
            }
            if (!data.nextPageToken) break;
            nextPageToken = data.nextPageToken;
        }
        searchResults = allItems;
        currentSearchPage = 1;
        displaySearchResultsPaginated();
    } catch (error) {
        alert('채널 검색 중 오류가 발생했습니다.');
        return;
    }
}

// 검색결과+페이지네이션 표시
function displaySearchResultsPaginated() {
    channelSearchResults.innerHTML = '';
    paginationContainer.innerHTML = '';

    if (searchResults.length === 0) {
        channelSearchResults.innerHTML = '<p>채널을 찾을 수 없습니다.</p>';
    } else {
        // 현재 페이지의 결과만 표시
        const totalPages = Math.ceil(searchResults.length / RESULTS_PER_PAGE);
        const pageResults = searchResults.slice((currentSearchPage-1)*RESULTS_PER_PAGE, currentSearchPage*RESULTS_PER_PAGE);
        pageResults.forEach(item => {
            const channelId = item.id.channelId;
            const channelTitle = item.snippet.title;
            const channelLogo = item.snippet.thumbnails.default.url;
            const channelEl = document.createElement('div');
            channelEl.classList.add('channel-item');
            channelEl.innerHTML = `
                <img src="${channelLogo}" alt="${channelTitle} 로고">
                <span>${channelTitle}</span>
            `;
            channelEl.addEventListener('click', async () => {
                await addChannel(channelId);
                channelSelectModal.style.display = 'none';
            });
            channelSearchResults.appendChild(channelEl);
        });

        // 페이지네이션
        for (let p = 1; p <= totalPages; p++) {
            const btn = document.createElement('button');
            btn.textContent = p;
            btn.className = (p === currentSearchPage) ? 'active' : '';
            btn.addEventListener('click', () => {
                currentSearchPage = p;
                displaySearchResultsPaginated();
            });
            paginationContainer.appendChild(btn);
        }
        // Prev/Next
        if (totalPages > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.textContent = '이전';
            prevBtn.disabled = currentSearchPage === 1;
            prevBtn.addEventListener('click', () => {
                if (currentSearchPage > 1) {
                    currentSearchPage--;
                    displaySearchResultsPaginated();
                }
            });
            paginationContainer.insertBefore(prevBtn, paginationContainer.firstChild);

            const nextBtn = document.createElement('button');
            nextBtn.textContent = '다음';
            nextBtn.disabled = currentSearchPage === totalPages;
            nextBtn.addEventListener('click', () => {
                if (currentSearchPage < totalPages) {
                    currentSearchPage++;
                    displaySearchResultsPaginated();
                }
            });
            paginationContainer.appendChild(nextBtn);
        }

        channelSearchResults.appendChild(paginationContainer);
    }

    channelSelectModal.style.display = 'block';
}

// 실제 채널 추가
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

// 채널 목록 UI
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
                    <h3><a href="https://www.youtube.com/channel/${channel.id}" target="_blank">${channel.name}</a></h3>
                    <p>구독자: ${parseInt(channel.subscriberCount).toLocaleString()}명</p>
                    <p>최근 업로드: ${moment(channel.latestUploadDate).format('YYYY-MM-DD')}</p>
                    <p>돌연변이 영상: <span id="mutant-count-${channel.id}">...</span>개</p>
                </div>
            </div>
            <button class="delete-channel-button" data-channel-id="${channel.id}">삭제</button>
        `;
        channelListContainer.appendChild(channelEl);
    });
}

// playlistItems 요청
async function getPlaylistItems(playlistId, maxResults = 50, pageToken = null) {
    const cacheKey = `${playlistId}_${maxResults}_${pageToken || ''}`;
    if (playlistCache[cacheKey]) return playlistCache[cacheKey];
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const data = await fetchYoutubeApi(url);
    playlistCache[cacheKey] = data;
    return data;
}

// 돌연변이 영상 목록
async function updateMutantVideosSection() {
    mutantVideoList.innerHTML = '<p>로딩 중...</p>';
    let allMutantVideos = [];
    let minDate = null;
    if (currentMutantPeriod !== 'all') minDate = moment().subtract(parseInt(currentMutantPeriod), 'months');

    for (const channel of channels) {
        let nextPageToken = null;
        let videoIds = [];
        let hasMoreVideos = true;

        while (hasMoreVideos) {
            const playlistData = await getPlaylistItems(channel.uploadsPlaylistId, 50, nextPageToken);
            const recentItems = playlistData.items.filter(item => {
                if (minDate) return moment(item.snippet.publishedAt).isAfter(minDate);
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

// 배열을 chunk 단위로 묶기
function chunkArray(arr, chunkSize) {
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }
    return result;
}

// 최신 영상 섹션
async function updateLatestVideosSection() {
    latestVideoList.innerHTML = '<p>로딩 중...</p>';
    const allLatestVideos = [];
    for (const channel of channels) {
        const latestVideo = await getLatestLongformVideo(channel.uploadsPlaylistId, channel.subscriberCount);
        if (latestVideo) allLatestVideos.push(latestVideo);
    }
    allLatestVideos.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
    displayVideos(allLatestVideos, latestVideoList);
}

// 채널의 최신 롱폼 영상
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

// 동영상 상세 정보
async function getVideoDetails(videoIds) {
    if (videoIds.length === 0) return [];
    const uncached = videoIds.filter(id => !videoDetailCache[id]);
    let newDetails = [];
    if (uncached.length > 0) {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${uncached.join(',')}`;
        const data = await fetchYoutubeApi(url);
        newDetails = data.items.map(item => {
            // 반드시 썸네일 출력
            const fallbackThumbnail = `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`;
            let thumbnailUrl = fallbackThumbnail;
            if (item.snippet.thumbnails) {
                thumbnailUrl =
                    item.snippet.thumbnails.medium?.url ||
                    item.snippet.thumbnails.high?.url ||
                    item.snippet.thumbnails.default?.url ||
                    fallbackThumbnail;
            }
            return {
                id: item.id,
                title: item.snippet.title,
                thumbnail: thumbnailUrl,
                viewCount: item.statistics.viewCount,
                publishedAt: item.snippet.publishedAt,
                duration: item.contentDetails.duration
            };
        });
        for (const item of newDetails) {
            videoDetailCache[item.id] = item;
        }
    }
    return videoIds.map(id => videoDetailCache[id]).filter(Boolean);
}

// 비디오 리스트 UI
function displayVideos(videoList, container) {
    container.innerHTML = '';
    if (videoList.length === 0) {
        container.innerHTML = '<p>영상이 없습니다.</p>';
        return;
    }
    const videoListContainer = document.createElement('div');
    videoListContainer.classList.add('video-list');
    videoList.forEach(video => {
        const videoItem = document.createElement('div');
        videoItem.classList.add('video-item');
        videoItem.style.position = "relative";
        videoItem.innerHTML = `
            <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">
                <div class="thumbnail-container">
                    <img src="${video.thumbnail}" alt="${video.title} 썸네일"/>
                </div>
            </a>
            <div class="video-info">
                <h3><a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">${video.title}</a></h3>
                <div class="meta-data">
                    <p>조회수: ${parseInt(video.viewCount).toLocaleString()}회</p>
                    <p>업로드 날짜: ${moment(video.publishedAt).fromNow()}</p>
                </div>
            </div>
            <span class="mutant-index-badge">${video.mutantIndex}</span>
        `;
        videoListContainer.appendChild(videoItem);
    });
    container.appendChild(videoListContainer);
}

// API키 저장 핸들러
function handleSaveApiKeys() {
    const keys = Array.from(apiKeyInputs).map(input => input.value);
    if (saveApiKeys(keys)) {
        apiKeyModal.style.display = 'none';
        alert('API 키가 저장되었습니다!');
    }
}
function handleApiKeyFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const keys = e.target.result.split('\n').map(key => key.trim());
            if (saveApiKeys(keys)) {
                apiKeyModal.style.display = 'none';
                alert('API 키가 파일에서 성공적으로 로드되었습니다!');
            }
        };
        reader.readAsText(file);
    }
}
