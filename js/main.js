// js/main.js
import { isLongform, calculateMutantIndex, isWithinLastMonths } from './utils.js';
import { loadApiKeys, saveApiKeys, fetchYoutubeApi } from './api_keys.js';

// DOM 요소 캐싱
const channelCountSpan = document.getElementById('channel-count');
const channelListContainer = document.getElementById('channel-list-container');
const addChannelButton = document.getElementById('add-channel-button');
const mutantVideoList = document.getElementById('mutant-video-list');
const latestVideoList = document.getElementById('latest-video-list');

// API 키 모달 관련 DOM 요소
const apiKeyModal = document.getElementById('api-key-modal');
const openApiKeyPopupButton = document.getElementById('open-api-key-popup');
const closeButton = document.querySelector('.modal .close-button');
const saveApiKeysButton = document.getElementById('save-api-keys');
const apiKeyInputs = document.querySelectorAll('.api-key-input');
const apiKeyFileUpload = document.getElementById('api-key-file-upload');

// 로컬 스토리지에 저장된 채널 목록을 관리
let channels = [];
let currentMutantPeriod = '6m';

// 초기 로딩
document.addEventListener('DOMContentLoaded', () => {
    loadApiKeys();
    loadChannels();
    setupEventListeners();
    updateUI();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    addChannelButton.addEventListener('click', handleAddChannel);
    
    // API 키 모달 이벤트
    openApiKeyPopupButton.addEventListener('click', () => apiKeyModal.style.display = 'block');
    closeButton.addEventListener('click', () => apiKeyModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target === apiKeyModal) {
            apiKeyModal.style.display = 'none';
        }
    });
    saveApiKeysButton.addEventListener('click', handleSaveApiKeys);
    apiKeyFileUpload.addEventListener('change', handleApiKeyFileUpload);

    // 돌연변이 영상 기간 설정 버튼 이벤트
    document.querySelector('.date-range-controls').addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            document.querySelectorAll('.date-range-controls button').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            currentMutantPeriod = event.target.dataset.period;
            updateMutantVideosSection();
        }
    });
}

// 로컬 스토리지에서 채널 목록 로드
function loadChannels() {
    const storedChannels = localStorage.getItem('registeredChannels');
    if (storedChannels) {
        channels = JSON.parse(storedChannels);
    }
}

// 채널 목록을 로컬 스토리지에 저장
function saveChannels() {
    localStorage.setItem('registeredChannels', JSON.stringify(channels));
}

// UI 업데이트 함수
async function updateUI() {
    displayChannelList();
    if (channels.length > 0) {
        await updateMutantVideosSection();
        await updateLatestVideosSection();
    }
}

// 섹션 1: 채널 추가 및 목록 표시
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

        const channelData = data.items[0];
        const channelId = channelData.id.channelId;
        const channelTitle = channelData.snippet.title;

        // 이미 등록된 채널인지 확인
        if (channels.some(c => c.id === channelId)) {
            alert('이미 등록된 채널입니다.');
            return;
        }
        
        // 채널 상세 정보 가져오기
        const channelDetails = await getChannelDetails(channelId);
        
        channels.push(channelDetails);
        saveChannels();
        updateUI();
        
    } catch (error) {
        console.error('채널 추가 중 오류:', error);
        alert('채널을 추가하는 중 오류가 발생했습니다. API 키를 확인해주세요.');
    }
}

// 채널 상세 정보 가져오는 함수
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
        mutantVideosCount: 0 // 초기값
    };
}

// 채널 목록 UI에 표시
function displayChannelList() {
    channelListContainer.innerHTML = '';
    channelCountSpan.textContent = channels.length;

    channels.forEach(channel => {
        const channelEl = document.createElement('div');
        channelEl.classList.add('channel-item');
        channelEl.innerHTML = `
            <a href="https://www.youtube.com/channel/${channel.id}" target="_blank">
                <img src="${channel.logo}" alt="${channel.name} 로고">
            </a>
            <h3><a href="https://www.youtube.com/channel/${channel.id}" target="_blank">${channel.name}</a></h3>
            <p>구독자: ${parseInt(channel.subscriberCount).toLocaleString()}명</p>
            <p>최근 업로드: ${moment(channel.latestUploadDate).format('YYYY-MM-DD')}</p>
            <p>돌연변이 영상: <span id="mutant-count-${channel.id}">...</span>개</p>
        `;
        channelListContainer.appendChild(channelEl);
    });
}


// 섹션 2: 돌연변이 영상 목록 업데이트
async function updateMutantVideosSection() {
    mutantVideoList.innerHTML = '로딩 중...';
    let allMutantVideos = [];
    const minDate = currentMutantPeriod === 'all' ? null : moment().subtract(parseInt(currentMutantPeriod), 'months');

    for (const channel of channels) {
        const videos = await getChannelVideos(channel.uploadsPlaylistId);
        const mutantVideosForChannel = [];
        
        for (const video of videos) {
            // 기간 필터링
            if (minDate && moment(video.publishedAt).isBefore(minDate)) {
                continue;
            }

            // 돌연변이 지수 계산
            const mutantIndex = calculateMutantIndex(video.viewCount, channel.subscriberCount);
            if (parseFloat(mutantIndex) >= 2.0) {
                mutantVideosForChannel.push({ ...video, mutantIndex });
            }
        }
        allMutantVideos = allMutantVideos.concat(mutantVideosForChannel);
        // 채널별 돌연변이 영상 개수 업데이트
        const countSpan = document.getElementById(`mutant-count-${channel.id}`);
        if (countSpan) {
            countSpan.textContent = mutantVideosForChannel.length;
        }
    }
    
    // 돌연변이 지수 높은 순으로 정렬
    allMutantVideos.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
    displayVideos(allMutantVideos, mutantVideoList);
}

// 섹션 3: 최신 영상 목록 업데이트
async function updateLatestVideosSection() {
    latestVideoList.innerHTML = '로딩 중...';
    let allLatestVideos = [];
    
    for (const channel of channels) {
        // 최근 영상 20개 가져오기
        const videos = await getChannelVideos(channel.uploadsPlaylistId, 20);
        
        const videosWithIndex = videos.map(video => ({
            ...video,
            mutantIndex: calculateMutantIndex(video.viewCount, channel.subscriberCount)
        }));
        
        allLatestVideos = allLatestVideos.concat(videosWithIndex);
    }

    // 돌연변이 지수 높은 순으로 정렬
    allLatestVideos.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
    displayVideos(allLatestVideos, latestVideoList);
}


// 재생목록의 영상들을 가져오는 함수
async function getChannelVideos(playlistId, maxResults = 50) {
    const videos = [];
    let nextPageToken = null;

    while (true) {
        const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&pageToken=${nextPageToken || ''}`;
        const data = await fetchYoutubeApi(url);
        
        // 동영상 ID를 모아서 한번에 상세 정보 가져오기 (조회수, 재생시간 등)
        const videoIds = data.items.map(item => item.contentDetails.videoId);
        if (videoIds.length > 0) {
            const videoDetails = await getVideoDetails(videoIds);

            // 롱폼 영상만 필터링
            const longformVideos = videoDetails.filter(video => isLongform(video.duration));
            videos.push(...longformVideos);
        }

        nextPageToken = data.nextPageToken;
        if (!nextPageToken || videos.length >= maxResults) {
            break;
        }
    }

    return videos;
}


// 동영상 상세 정보 가져오는 함수
async function getVideoDetails(videoIds) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}`;
    const data = await fetchYoutubeApi(url);

    return data.items.map(item => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium.url,
        viewCount: item.statistics.viewCount,
        publishedAt: item.snippet.publishedAt,
        duration: item.contentDetails.duration // ISO 8601 형식
    }));
}


// 영상 목록을 화면에 표시하는 함수
function displayVideos(videoList, container) {
    container.innerHTML = '';
    if (videoList.length === 0) {
        container.innerHTML = '<p>영상이 없습니다.</p>';
        return;
    }

    videoList.forEach(video => {
        const videoEl = document.createElement('div');
        videoEl.classList.add('video-item');
        videoEl.innerHTML = `
            <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">
                <img src="${video.thumbnail}" alt="${video.title} 썸네일">
            </a>
            <div class="video-info">
                <h3><a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">${video.title}</a></h3>
                <p>조회수: ${parseInt(video.viewCount).toLocaleString()}회</p>
                <p>업로드 날짜: ${moment(video.publishedAt).format('YYYY-MM-DD')}</p>
                <p>돌연변이 지수: <strong>${video.mutantIndex}</strong></p>
            </div>
        `;
        container.appendChild(videoEl);
    });
}

// API 키 저장 핸들러
function handleSaveApiKeys() {
    const keys = Array.from(apiKeyInputs).map(input => input.value);
    if (saveApiKeys(keys)) {
        apiKeyModal.style.display = 'none';
        alert('API 키가 저장되었습니다!');
    }
}

// API 키 파일 업로드 핸들러
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
