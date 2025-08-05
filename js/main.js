// js/main.js

// 유틸(시간 등) 라이브러리 moment.js, 그리고 API 함수들은 이미 import 되어 있다고 가정합니다.

// 주요 DOM요소
const addChannelButton = document.getElementById('add-channel-button');
const channelListContainer = document.getElementById('channel-list-container');
const channelCountSpan = document.getElementById('channel-count');
const mutantVideoList = document.getElementById('mutant-video-list');
const latestVideoList = document.getElementById('latest-video-list');
const openApiKeyPopupButton = document.getElementById('open-api-key-popup');

// API 키 모달 관련
const apiKeyModal = document.getElementById('api-key-modal');
const saveApiKeysButton = document.getElementById('save-api-keys');
const apiKeyInputs = document.querySelectorAll('.api-key-input');
const apiKeyFileUpload = document.getElementById('api-key-file-upload');
const downloadApiKeysButton = document.getElementById('download-api-keys');

// 채널 검색 모달 관련
const channelSelectModal = document.getElementById('channel-select-modal');
const channelSearchResults = document.getElementById('channel-search-results');
const channelSelectCloseButton = document.querySelector('.channel-select-close');

let channels = [];
let currentMutantPeriod = '6m'; // 기본 6개월

// ========== DOMContentLoaded(=html 다 로드된 후)에서 실행 ==========
document.addEventListener('DOMContentLoaded', () => {
    loadChannels();
    updateUI();
    setupEventListeners();
});

// ========== 이벤트 바인딩 ==========
function setupEventListeners() {
    // 채널 추가 버튼
    addChannelButton.addEventListener('click', handleAddChannel);

    // API 키 팝업 열기
    openApiKeyPopupButton.addEventListener('click', () => {
        apiKeyModal.style.display = 'block';
    });
    // API 키 팝업 닫기
    apiKeyModal.querySelector('.close-button').addEventListener('click', () => {
        apiKeyModal.style.display = 'none';
    });
    // API 키 저장
    saveApiKeysButton.addEventListener('click', handleSaveApiKeys);
    // API 키 파일 업로드
    apiKeyFileUpload.addEventListener('change', handleApiKeyFileUpload);
    // API 키 다운로드
    downloadApiKeysButton.addEventListener('click', downloadApiKeys);

    // 채널 검색 모달 닫기
    channelSelectCloseButton.addEventListener('click', () => {
        channelSelectModal.style.display = 'none';
    });

    // 돌연변이 영상 기간 선택
    document.querySelector('.date-range-controls').addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON') {
            document.querySelectorAll('.date-range-controls button').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            currentMutantPeriod = event.target.dataset.period;
            updateMutantVideosSection();
        }
    });

    // 채널 삭제 버튼 (동적 리스트: 위임)
    channelListContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-channel-button')) {
            const channelIdToDelete = event.target.dataset.channelId;
            deleteChannel(channelIdToDelete);
        }
    });
}

// ========== 채널 목록 로드/저장 ==========
function loadChannels() {
    const storedChannels = localStorage.getItem('registeredChannels');
    if (storedChannels) {
        channels = JSON.parse(storedChannels);
    }
}
function saveChannels() {
    localStorage.setItem('registeredChannels', JSON.stringify(channels));
}

// ========== UI 업데이트 ==========
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

// ========== 채널 추가(검색 → 등록) ==========
async function handleAddChannel() {
    const channelName = prompt('추가할 채널명을 입력하세요:');
    if (!channelName) return;

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelName)}&type=channel&maxResults=10`;
        const data = await fetchYoutubeApi(url);

        if (!data.items || data.items.length === 0) {
            alert('채널을 찾을 수 없습니다.');
            return;
        }
        if (data.items.length > 1) {
            displaySearchResults(data.items);
        } else {
            addChannel(data.items[0].id.channelId);
        }
    } catch (error) {
        alert('채널 추가 오류(API 키 확인)');
    }
}

// ========== 채널 검색결과(모달) ==========
function displaySearchResults(results) {
    channelSearchResults.innerHTML = '';
    results.forEach(item => {
        const channelId = item.id.channelId;
        const channelTitle = item.snippet.title;
        const channelLogo = item.snippet.thumbnails.default.url;
        // 공통 카드 디자인!
        const channelEl = document.createElement('div');
        channelEl.className = 'channel-item';
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
    channelSelectModal.style.display = 'block';
}

// ========== 채널 실제 등록 ==========
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
    } catch (e) {
        alert('채널 정보를 가져오는 중 오류 발생');
    }
}

// ========== 채널 삭제 ==========
function deleteChannel(channelId) {
    if (confirm('정말로 삭제할까요?')) {
        channels = channels.filter(c => c.id !== channelId);
        saveChannels();
        updateUI();
    }
}

// ========== 채널 상세정보 받아오기 ==========
async function getChannelDetails(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}`;
    const data = await fetchYoutubeApi(url);
    const item = data.items[0];
    return {
        id: channelId,
        name: item.snippet.title,
        logo: item.snippet.thumbnails.default.url,
        subscriberCount: item.statistics.subscriberCount,
        latestUploadDate: item.snippet.publishedAt,
        uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads
    };
}

// ========== 채널 목록 표시(카드형) ==========
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
                </div>
            </div>
            <button class="delete-channel-button my-button--danger" data-channel-id="${channel.id}">삭제</button>
        `;
        channelListContainer.appendChild(channelEl);
    });
}

// ========== API 호출 캐시 ==========
const playlistCache = {};
const videoDetailCache = {};

// ========== playlistItems ==========
async function getPlaylistItems(playlistId, maxResults = 50, pageToken = null) {
    const cacheKey = `${playlistId}_${maxResults}_${pageToken || ''}`;
    if (playlistCache[cacheKey]) {
        return playlistCache[cacheKey];
    }
    let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${maxResults}`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const data = await fetchYoutubeApi(url);
    playlistCache[cacheKey] = data;
    return data;
}

// ========== 돌연변이 영상 목록 ==========
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
    }
    allMutantVideos.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
    displayVideos(allMutantVideos, mutantVideoList);
}

// ========== 배열을 일정 크기로 ==========
function chunkArray(arr, chunkSize) {
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }
    return result;
}

// ========== 최신 롱폼 영상 목록 ==========
async function updateLatestVideosSection() {
    latestVideoList.innerHTML = '<p>로딩 중...</p>';
    const allLatestVideos = [];
    for (const channel of channels) {
        const latestVideo = await getLatestLongformVideo(channel.uploadsPlaylistId, channel.subscriberCount);
        if (latestVideo) {
            allLatestVideos.push(latestVideo);
        }
    }
    allLatestVideos.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
    displayVideos(allLatestVideos, latestVideoList);
}

// ========== 채널의 가장 최근 롱폼 영상 1개 ==========
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

// ========== 동영상 상세 정보 ==========
async function getVideoDetails(videoIds) {
    if (videoIds.length === 0) return [];
    const uncached = videoIds.filter(id => !videoDetailCache[id]);
    let newDetails = [];
    if (uncached.length > 0) {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${uncached.join(',')}`;
        const data = await fetchYoutubeApi(url);
        newDetails = data.items.map(item => {
            const fallbackThumbnail = `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`;
            return {
                id: item.id,
                title: item.snippet.title,
                thumbnail: (item.snippet.thumbnails && item.snippet.thumbnails.medium?.url) || fallbackThumbnail,
                publishedAt: item.snippet.publishedAt,
                duration: item.contentDetails.duration,
                viewCount: item.statistics.viewCount || 0,
                mutantIndex: '0.00'
            };
        });
        uncached.forEach((id, idx) => { videoDetailCache[id] = newDetails[idx]; });
    }
    return videoIds.map(id => videoDetailCache[id]).filter(Boolean);
}

// ========== 공통 영상 카드 UI 출력 ==========
function displayVideos(videoList, container) {
    container.innerHTML = '';
    if (!videoList || videoList.length === 0) {
        container.innerHTML = '<p style="color:#888;text-align:center;">영상이 없습니다.</p>';
        return;
    }
    videoList.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
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

// ========== API 키 기능(간단화) ==========
function handleSaveApiKeys() {
    const keys = Array.from(apiKeyInputs).map(input => input.value.trim()).filter(Boolean);
    localStorage.setItem('apiKeys', JSON.stringify(keys));
    alert('API 키가 저장되었습니다.');
    apiKeyModal.style.display = 'none';
}

function handleApiKeyFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const keys = content.split('\n').map(line => line.trim()).filter(Boolean);
        localStorage.setItem('apiKeys', JSON.stringify(keys));
        alert('API 키가 파일에서 저장되었습니다.');
        apiKeyModal.style.display = 'none';
    };
    reader.readAsText(file);
}

function downloadApiKeys() {
    const keys = JSON.parse(localStorage.getItem('apiKeys') || '[]');
    if (keys.length === 0) {
        alert('저장된 API 키가 없습니다.');
        return;
    }
    const blob = new Blob([keys.join('\n')], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'api_keys.txt';
    a.click();
    URL.revokeObjectURL(url);
}

// ========== 유틸 ==========
function isLongform(durationString) {
    if (!durationString) return false;
    return moment.duration(durationString).asSeconds() > 180;
}
function calculateMutantIndex(viewCount, subscriberCount) {
    if (!subscriberCount || subscriberCount === '0') return (viewCount > 0) ? 'Infinity' : '0.00';
    const index = (parseInt(viewCount) / parseInt(subscriberCount));
    return index.toFixed(2);
}
