// js/main.js (불필요 코드 제거, 썸네일 무조건 출력, 한글 주석 포함)

import * as myChannelManager from './my_channel_manager.js';
import { isLongform, calculateMutantIndex } from './utils.js';
import { loadApiKeys, saveApiKeys, fetchYoutubeApi, downloadApiKeys } from './api_keys.js';

// DOM 요소 캐싱
const channelCountSpan = document.getElementById('channel-count');
const channelListContainer = document.getElementById('channel-list-container');
const addChannelButton = document.getElementById('add-channel-button');
const mutantVideoList = document.getElementById('mutant-video-list');
const latestVideoList = document.getElementById('latest-video-list');

// API 키 모달 관련 DOM 요소
const apiKeyModal = document.getElementById('api-key-modal');
const openApiKeyPopupButton = document.getElementById('open-api-key-popup');
const closeButton = document.querySelector('#api-key-modal .close-button');
const saveApiKeysButton = document.getElementById('save-api-keys');
const apiKeyInputs = document.querySelectorAll('.api-key-input');
const apiKeyFileUpload = document.getElementById('api-key-file-upload');
const downloadApiKeysButton = document.getElementById('download-api-keys');

// 채널 선택 모달 관련 DOM 요소
const channelSelectModal = document.getElementById('channel-select-modal');
const channelSearchResults = document.getElementById('channel-search-results');
const channelSelectCloseButton = document.querySelector('#channel-select-modal .close-button');

// 로컬 스토리지에 저장된 채널 목록 관리
let channels = [];
let currentMutantPeriod = '6m';

// API 데이터 캐싱 임시 저장소
const playlistCache = {};
const videoDetailCache = {};

document.addEventListener('DOMContentLoaded', () => {
    moment.locale('ko');
    loadChannels();
    setupEventListeners();
    updateUI();

    // ▼ 섹션 토글 (접기/펼치기)
    const toggleBtn = document.getElementById('toggle-section1-btn');
    const section1Content = document.getElementById('section1-content');
    let originalDisplay = getComputedStyle(section1Content).display; // 기본값 저장

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

    // 이벤트 리스너 설정
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
            if (event.target === apiKeyModal) {
                apiKeyModal.style.display = 'none';
            }
        });
        saveApiKeysButton.addEventListener('click', handleSaveApiKeys);
        apiKeyFileUpload.addEventListener('change', handleApiKeyFileUpload);
        downloadApiKeysButton.addEventListener('click', downloadApiKeys);

        channelSelectCloseButton.addEventListener('click', () => channelSelectModal.style.display = 'none');
        window.addEventListener('click', (event) => {
            if (event.target === channelSelectModal) {
                channelSelectModal.style.display = 'none';
            }
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
        
        // 탭 버튼 이벤트 리스너 추가 (새로 추가/수정된 부분)
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                // 모든 탭 버튼과 콘텐츠 비활성화
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
                // 클릭된 탭 버튼 활성화
                button.classList.add('active');
    
                // 해당 탭 콘텐츠 활성화
                const tabId = button.dataset.tab;
                const tabContent = document.getElementById(tabId);
                if (tabContent) {
                    tabContent.classList.add('active');
                }
    
                // '내 채널 관리' 탭일 경우 초기화 함수 호출
                if (tabId === 'my-channel-manager') {
                    myChannelManager.initializeMyChannelManager();
                }
            });
        });
    }

    // 채널 목록 로드
    function loadChannels() {
        const storedChannels = localStorage.getItem('registeredChannels');
        if (storedChannels) {
            channels = JSON.parse(storedChannels);
        }
    }

    // 채널 목록 저장
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

    // 채널 검색 결과 표시 (모달)
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

                const channelEl = document.createElement('div');
                channelEl.classList.add('channel-item');
                channelEl.innerHTML = `
                    <div class="channel-info-wrapper">
                        <img src="${channelLogo}" alt="${channelTitle} 로고" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;">
                        <span>${channelTitle}</span>
                    </div>
                `;
                channelEl.addEventListener('click', () => {
                    addChannel(channelId);
                    channelSelectModal.style.display = 'none';
                });
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

    // 채널 목록 UI 표시
    function displayChannelList() {
        channelListContainer.innerHTML = '';
        channelCountSpan.textContent = channels.length;

        channels.forEach(channel => {
            const channelEl = document.createElement('div');
            channelEl.classList.add('channel-item');
            channelEl.innerHTML = `
                <div class="channel-info-wrapper">
                    <a href="https://www.youtube.com/channel/${channel.id}" target="_blank">
                        <img src="${channel.logo}" alt="${channel.name} 로고" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;">
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

    // 돌연변이 영상 목록 업데이트 (섹션2)
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

    // 최신 영상 목록 업데이트 (섹션3)
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

    // 동영상 상세 정보 가져오기 (썸네일 직접 생성! 반드시 뜸)
    async function getVideoDetails(videoIds) {
        if (videoIds.length === 0) return [];
        const uncached = videoIds.filter(id => !videoDetailCache[id]);
        let newDetails = [];
        if (uncached.length > 0) {
            const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${uncached.join(',')}`;
            const data = await fetchYoutubeApi(url);
            newDetails = data.items.map(item => {
                // 썸네일이 없을 때도 영상ID로 반드시 생성!
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

    // 영상 목록을 화면에 표시 (섹션2/3)
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

            videoItem.innerHTML = `
                <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">
                    <div class="thumbnail-container">
                        <img src="${video.thumbnail}" alt="${video.title} 썸네일" style="width:100%; border-radius:4px; max-height:160px; object-fit:cover;"/>
                    </div>
                </a>
                <div class="video-info">
                    <h3><a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">${video.title}</a></h3>
                    <div class="meta-data">
                        <p>조회수: ${parseInt(video.viewCount).toLocaleString()}회</p>
                        <p>업로드 날짜: ${moment(video.publishedAt).fromNow()}</p>
                    </div>
                    <div class="mutant-index" style="color:#c4302b; font-weight:bold;">
                        돌연변이 지수: <strong>${video.mutantIndex}</strong>
                    </div>
                </div>
            `;
            videoListContainer.appendChild(videoItem);
        });

        container.appendChild(videoListContainer);
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
});

// 대본 읽기 버튼 이벤트 리스너
const ttsTabButton = document.getElementById('tts-tab-button');
if (ttsTabButton) {
    ttsTabButton.addEventListener('click', () => {
        // 여기에 원하는 웹사이트 주소를 입력하세요
        const ttsUrl = 'https://getwater-maker.github.io/google-tts-converter/';
        window.open(ttsUrl, '_self');
    });
}

