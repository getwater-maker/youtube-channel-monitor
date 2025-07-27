// script.js

// 1. DOM Content Loaded Listener
document.addEventListener('DOMContentLoaded', () => {
    // 2. Global Variables/Constants
    const API_KEY_STORAGE_KEY = 'youtube_api_key';
    let YOUTUBE_API_KEY = ''; // This will be loaded from localStorage or set by user

    // Get DOM elements
    const apiStatusText = document.getElementById('api-status-text');
    const apiSettingsBtn = document.getElementById('api-settings-btn');
    const apiSettingsModal = document.getElementById('api-settings-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const closeApiModalBtn = document.getElementById('close-api-modal-btn');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const addChannelModal = document.getElementById('add-channel-modal');
    const channelInput = document.getElementById('channel-input');
    const addChannelConfirmBtn = document.getElementById('add-channel-confirm-btn');
    const cancelChannelBtn = document.getElementById('cancel-channel-btn');
    const channelSelectionModal = document.getElementById('channel-selection-modal');
    const channelSelectionList = document.getElementById('channel-selection-list');
    const cancelChannelSelectionBtn = document.getElementById('cancel-channel-selection-btn');
    const loadingOverlay = document.getElementById('loading-overlay');

    // For Channel Monitoring Tab
    const addMonitoringChannelBtn = document.getElementById('add-monitoring-channel-btn');
    const monitoringChannelGrid = document.getElementById('monitoring-channel-grid');
    const monitoringChannelCount = document.getElementById('monitoring-channel-count');
    const trackingRecords = document.getElementById('tracking-records');
    const latestVideosContainer = document.getElementById('latest-videos-container');
    const hotVideoRatioSelect = document.getElementById('hot-video-ratio');
    const trackingSortOrderSelect = document.getElementById('tracking-sort-order');
    const trackChannelsBtn = document.getElementById('track-channels-btn');
    const showAllChannelsCheckbox = document.getElementById('show-all-channels');
    const monitoringCollapseBtn = document.getElementById('monitoring-collapse-btn');

    // For Video Search Tab
    const searchKeywordInput = document.getElementById('search-keyword');
    const searchBtn = document.getElementById('search-btn');
    const subFilterSelect = document.getElementById('sub-filter');
    const viewFilterSelect = document.getElementById('view-filter');
    const dateRangeTypeSelect = document.getElementById('date-range-type');
    const dateRangeSelect = document.getElementById('date-range');
    const customDateRangeDiv = document.getElementById('custom-date-range');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const sortOrderSelect = document.getElementById('sort-order');
    const searchResultsDiv = document.getElementById('search-results');

    // For Subscriber Tracking Tab
    const collectSubscriberDataBtn = document.getElementById('collect-subscriber-data-btn');
    const lastCollectionInfoSpan = document.getElementById('last-collection-info');
    const addTrackingChannelBtn = document.getElementById('add-tracking-channel-btn');
    const trackingChannelGrid = document.getElementById('tracking-channel-grid');
    const trackingChannelCount = document.getElementById('tracking-channel-count');
    const trackingCollapseBtn = document.getElementById('tracking-collapse-btn');
    const trackingChannelsSelection = document.getElementById('tracking-channels-selection');
    const subscriberChartCanvas = document.getElementById('subscriber-chart');
    const chartChannelSelect = document.getElementById('chart-channel-select');
    const dataListDiv = document.getElementById('data-list');

    // For Thumbnail Test Tab
    const testTypeRandomRadio = document.getElementById('test-type-random');
    const testTypeSearchRadio = document.getElementById('test-type-search');
    const searchTestKeywordInput = document.getElementById('search-test-keyword');
    const startTestBtn = document.getElementById('start-test-btn');
    const testCountSelect = document.getElementById('test-count-select');
    const thumbnailTestArea = document.getElementById('thumbnail-test-area');
    const testRecordList = document.getElementById('test-record-list');


    // --- Helper Functions ---

    /**
     * Shows the loading overlay.
     */
    function showLoading() {
        loadingOverlay.style.display = 'flex';
    }

    /**
     * Hides the loading overlay.
     */
    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    /**
     * Displays a toast message. (Placeholder for now)
     * @param {string} message The message to display.
     * @param {string} type The type of message (e.g., 'success', 'error', 'info').
     */
    function showToast(message, type = 'info') {
        // In a real application, you would implement a visible toast notification here.
        console.log(`Toast (${type}): ${message}`);
        // Example: You could create a div, add it to the body, and animate its appearance/disappearance
    }

    /**
     * Formats a number with commas and appropriate suffixes for large numbers.
     * @param {number} num The number to format.
     * @returns {string} The formatted number string.
     */
    function formatNumber(num) {
        if (num >= 100000000) {
            return (num / 100000000).toFixed(1) + '억';
        }
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + '만';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + '천';
        }
        return num.toLocaleString();
    }

    /**
     * Calculates the time difference in days.
     * @param {string} date1String ISO date string.
     * @param {string} date2String ISO date string.
     * @returns {number} The difference in days.
     */
    function getDaysDifference(date1String, date2String) {
        const date1 = new Date(date1String);
        const date2 = new Date(date2String);
        const diffTime = Math.abs(date2.getTime() - date1.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }


    // --- API Key Management ---

    /**
     * Loads the API key from local storage.
     */
    function loadApiKey() {
        YOUTUBE_API_KEY = localStorage.getItem(API_KEY_STORAGE_KEY);
        updateApiStatus();
    }

    /**
     * Updates the API status text based on whether a key is set.
     */
    function updateApiStatus() {
        if (YOUTUBE_API_KEY) {
            apiStatusText.textContent = 'API 키 설정됨';
            apiStatusText.style.color = '#4CAF50';
        } else {
            apiStatusText.textContent = 'API 키 설정 필요';
            apiStatusText.style.color = '#F44336';
        }
    }

    /**
     * Saves the API key to local storage.
     */
    saveApiKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem(API_KEY_STORAGE_KEY, key);
            YOUTUBE_API_KEY = key;
            updateApiStatus();
            showToast('API 키가 저장되었습니다.', 'success');
            apiSettingsModal.style.display = 'none';
        } else {
            showToast('유효한 API 키를 입력해주세요.', 'error');
        }
    });

    apiSettingsBtn.addEventListener('click', () => {
        apiKeyInput.value = YOUTUBE_API_KEY; // Populate input with current key
        apiSettingsModal.style.display = 'block';
    });

    closeApiModalBtn.addEventListener('click', () => {
        apiSettingsModal.style.display = 'none';
    });

    // Close modal if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === apiSettingsModal) {
            apiSettingsModal.style.display = 'none';
        }
        if (event.target === addChannelModal) {
            addChannelModal.style.display = 'none';
        }
        if (event.target === channelSelectionModal) {
            channelSelectionModal.style.display = 'none';
        }
    });


    // --- Tab Navigation Logic ---

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and content
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetTabId = button.dataset.tab;
            document.getElementById(targetTabId).classList.add('active');
        });
    });

    // --- Channel Management (Common functions for both monitoring and tracking) ---
    let monitoringChannels = JSON.parse(localStorage.getItem('monitoringChannels')) || [];
    let trackingChannels = JSON.parse(localStorage.getItem('trackingChannels')) || [];

    function saveChannels(type) {
        if (type === 'monitoring') {
            localStorage.setItem('monitoringChannels', JSON.stringify(monitoringChannels));
        } else if (type === 'tracking') {
            localStorage.setItem('trackingChannels', JSON.stringify(trackingChannels));
        }
    }

    async function fetchChannelDetails(channelIdentifier) {
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return null;
        }

        showLoading();
        let channelId = '';
        const isUrl = channelIdentifier.startsWith('http');
        const isId = channelIdentifier.startsWith('UC'); // YouTube Channel IDs start with UC

        if (isUrl) {
            try {
                const url = new URL(channelIdentifier);
                if (url.hostname.includes('youtube.com')) {
                    if (url.pathname.includes('/channel/')) {
                        channelId = url.pathname.split('/channel/')[1];
                    } else if (url.pathname.includes('/user/')) {
                        // For /user/ URLs, we need to search by username
                        const username = url.pathname.split('/user/')[1];
                        const searchUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forUsername=${username}&key=${YOUTUBE_API_KEY}`;
                        const response = await fetch(searchUrl);
                        const data = await response.json();
                        if (data.items && data.items.length > 0) {
                            channelId = data.items[0].id;
                        }
                    } else if (url.pathname.includes('/c/')) {
                        // For /c/ URLs (custom URLs), we need to search by channel name
                        const customUrlName = url.pathname.split('/c/')[1];
                        const searchUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${customUrlName}&key=${YOUTUBE_API_KEY}`;
                        const response = await fetch(searchUrl);
                        const data = await response.json();
                        if (data.items && data.items.length > 0) {
                            channelId = data.items[0].id;
                        }
                    }
                }
            } catch (error) {
                console.error('URL parsing error:', error);
            }
        } else if (isId) {
            channelId = channelIdentifier;
        } else {
            // Assume it's a channel name, search for it
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelIdentifier)}&type=channel&key=${YOUTUBE_API_KEY}`;
            const response = await fetch(searchUrl);
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                if (data.items.length === 1) {
                    channelId = data.items[0].id.channelId;
                } else {
                    // Show channel selection modal
                    hideLoading();
                    renderChannelSelectionModal(data.items);
                    return null; // Stop further processing here, wait for user selection
                }
            }
        }

        if (channelId) {
            try {
                const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`);
                const data = await response.json();
                hideLoading();
                if (data.items && data.items.length > 0) {
                    const channel = data.items[0];
                    return {
                        id: channel.id,
                        name: channel.snippet.title,
                        thumbnail: channel.snippet.thumbnails.default.url,
                        subscriberCount: parseInt(channel.statistics.subscriberCount),
                        videoCount: parseInt(channel.statistics.videoCount),
                        uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads
                    };
                } else {
                    showToast('채널을 찾을 수 없습니다.', 'error');
                    return null;
                }
            } catch (error) {
                hideLoading();
                console.error('Error fetching channel details:', error);
                showToast('채널 정보를 가져오는 데 실패했습니다. API 키를 확인하거나 나중에 다시 시도해주세요.', 'error');
                return null;
            }
        } else {
            hideLoading();
            if (!channelSelectionModal.style.display || channelSelectionModal.style.display === 'none') {
                showToast('유효한 채널 정보를 찾을 수 없습니다.', 'error');
            }
            return null;
        }
    }

    function renderChannelSelectionModal(channels) {
        channelSelectionList.innerHTML = '';
        channels.forEach(channel => {
            const channelItem = document.createElement('div');
            channelItem.classList.add('channel-selection-item');
            channelItem.innerHTML = `
                <img src="${channel.snippet.thumbnails.default.url}" alt="${channel.snippet.title}" class="channel-selection-logo">
                <span class="channel-selection-name">${channel.snippet.title}</span>
            `;
            channelItem.addEventListener('click', async () => {
                channelSelectionModal.style.display = 'none';
                await addSelectedChannel(channel.id.channelId, currentChannelAddType);
            });
            channelSelectionList.appendChild(channelItem);
        });
        channelSelectionModal.style.display = 'block';
    }

    cancelChannelSelectionBtn.addEventListener('click', () => {
        channelSelectionModal.style.display = 'none';
    });

    let currentChannelAddType = ''; // 'monitoring' or 'tracking'

    addMonitoringChannelBtn.addEventListener('click', () => {
        currentChannelAddType = 'monitoring';
        channelInput.value = ''; // Clear previous input
        addChannelModal.style.display = 'block';
    });

    addTrackingChannelBtn.addEventListener('click', () => {
        currentChannelAddType = 'tracking';
        channelInput.value = ''; // Clear previous input
        addChannelModal.style.display = 'block';
    });

    addChannelConfirmBtn.addEventListener('click', async () => {
        const identifier = channelInput.value.trim();
        if (identifier) {
            addChannelModal.style.display = 'none'; // Hide the input modal
            await addSelectedChannel(identifier, currentChannelAddType);
        } else {
            showToast('채널명, URL 또는 ID를 입력하세요.', 'error');
        }
    });

    cancelChannelBtn.addEventListener('click', () => {
        addChannelModal.style.display = 'none';
    });


    async function addSelectedChannel(identifier, type) {
        if (!identifier) return;

        const channelDetails = await fetchChannelDetails(identifier);
        if (channelDetails) {
            let channelsArray = type === 'monitoring' ? monitoringChannels : trackingChannels;

            const isDuplicate = channelsArray.some(c => c.id === channelDetails.id);
            if (isDuplicate) {
                showToast('이미 등록된 채널입니다.', 'info');
                return;
            }

            channelsArray.push(channelDetails);
            saveChannels(type);
            renderChannelList(type);
            showToast(`${channelDetails.name} 채널이 추가되었습니다.`, 'success');
        }
    }

    function removeChannel(channelId, type) {
        if (type === 'monitoring') {
            monitoringChannels = monitoringChannels.filter(c => c.id !== channelId);
        } else if (type === 'tracking') {
            trackingChannels = trackingChannels.filter(c => c.id !== channelId);
        }
        saveChannels(type);
        renderChannelList(type);
        showToast('채널이 삭제되었습니다.', 'success');
    }

    function renderChannelList(type) {
        const gridContainer = type === 'monitoring' ? monitoringChannelGrid : trackingChannelGrid;
        const countSpan = type === 'monitoring' ? monitoringChannelCount : trackingChannelCount;
        let channelsArray = type === 'monitoring' ? monitoringChannels : trackingChannels;

        gridContainer.innerHTML = '';
        countSpan.textContent = channelsArray.length;

        if (channelsArray.length === 0) {
            gridContainer.innerHTML = '<div class="channel-grid-empty"><p>등록된 채널이 없습니다.</p></div>';
            return;
        }

        channelsArray.forEach(channel => {
            const channelItem = document.createElement('div');
            channelItem.classList.add('channel-item');
            channelItem.innerHTML = `
                <div class="channel-item-header">
                    <div class="channel-info-with-logo">
                        <img src="${channel.thumbnail}" alt="${channel.name}" class="channel-logo">
                        <div class="channel-text-info">
                            <h4 class="channel-name" data-channel-id="${channel.id}">${channel.name}</h4>
                            <span class="channel-subscribers">구독자 ${formatNumber(channel.subscriberCount)}명</span>
                        </div>
                    </div>
                    <div class="channel-actions">
                        <button class="btn-icon delete-channel-btn" data-channel-id="${channel.id}" data-channel-type="${type}">✖️</button>
                    </div>
                </div>
                <div class="channel-info">
                    <span class="channel-id">${channel.id}</span>
                    <span class="channel-stats">총 영상: ${formatNumber(channel.videoCount)}</span>
                </div>
                <div class="channel-status">
                    <span class="status-indicator"></span>
                    <span>상태: 정상</span>
                </div>
                <div class="channel-summary">
                    </div>
            `;
            gridContainer.appendChild(channelItem);
        });

        // Add event listeners for delete buttons
        gridContainer.querySelectorAll('.delete-channel-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const channelId = event.target.dataset.channelId;
                const channelType = event.target.dataset.channelType;
                if (confirm('이 채널을 삭제하시겠습니까?')) {
                    removeChannel(channelId, channelType);
                }
            });
        });
    }

    // Toggle channel management sections
    document.querySelectorAll('.management-header').forEach(header => {
        header.addEventListener('click', (event) => {
            const type = event.currentTarget.querySelector('.collapse-btn').id.includes('monitoring') ? 'monitoring' : 'tracking';
            toggleChannelManagementSection(type);
        });
    });

    function toggleChannelManagementSection(type) {
        const grid = type === 'monitoring' ? monitoringChannelGrid : trackingChannelGrid;
        const collapseBtn = type === 'monitoring' ? monitoringCollapseBtn : trackingCollapseBtn;

        if (grid.style.display === 'none') {
            grid.style.display = 'grid';
            collapseBtn.textContent = '▼';
        } else {
            grid.style.display = 'none';
            collapseBtn.textContent = '▲';
        }
    }


    // --- YouTube Data API Integration & Mutant Logic ---

    // Define "Mutant" and "Mutant Index"
    // Mutant: Video uploaded within last 6 months, views > (subscriberCount * hotVideoRatio)
    // Mutant Index: video_views / subscriber_count

    async function getChannelUploads(channelId) {
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return null;
        }
        try {
            const channel = monitoringChannels.find(c => c.id === channelId);
            if (!channel || !channel.uploadsPlaylistId) {
                console.error('Channel or uploadsPlaylistId not found for:', channelId);
                return null;
            }

            const uploadsPlaylistId = channel.uploadsPlaylistId;
            let videos = [];
            let nextPageToken = '';
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            // Fetch videos from uploads playlist
            do {
                const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.items) {
                    for (const item of data.items) {
                        const publishedAt = new Date(item.snippet.publishedAt);
                        if (publishedAt >= sixMonthsAgo) {
                            videos.push({
                                videoId: item.contentDetails.videoId,
                                title: item.snippet.title,
                                thumbnail: item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : '',
                                publishedAt: item.snippet.publishedAt,
                                channelTitle: item.snippet.channelTitle
                            });
                        } else {
                            // Videos are usually returned in reverse chronological order, so we can stop if we hit older videos
                            nextPageToken = null;
                            break;
                        }
                    }
                }
                nextPageToken = data.nextPageToken;
            } while (nextPageToken);

            return videos;
        } catch (error) {
            console.error('Error fetching channel uploads:', error);
            showToast('채널 영상을 가져오는 데 실패했습니다.', 'error');
            return null;
        }
    }

    async function getVideoDetails(videoIds) {
        if (!videoIds || videoIds.length === 0) return [];
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return [];
        }

        try {
            const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.items) {
                return data.items.map(item => ({
                    videoId: item.id,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : '',
                    publishedAt: item.snippet.publishedAt,
                    viewCount: parseInt(item.statistics.viewCount || 0),
                    likeCount: parseInt(item.statistics.likeCount || 0),
                    commentCount: parseInt(item.statistics.commentCount || 0),
                    channelId: item.snippet.channelId,
                    channelTitle: item.snippet.channelTitle
                }));
            }
            return [];
        } catch (error) {
            console.error('Error fetching video details:', error);
            showToast('영상 정보를 가져오는 데 실패했습니다.', 'error');
            return [];
        }
    }

    function calculateMutantIndex(videoViews, subscriberCount) {
        if (subscriberCount === 0) return 0; // Avoid division by zero
        return (videoViews / subscriberCount);
    }

    // --- Channel Monitoring Tab ---

    async function trackChannels() {
        if (monitoringChannels.length === 0) {
            showToast('모니터링할 채널을 먼저 추가해주세요.', 'info');
            return;
        }
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return;
        }

        showLoading();
        trackingRecords.innerHTML = '<div class="empty-state"><p>데이터를 불러오는 중입니다...</p></div>';
        latestVideosContainer.innerHTML = '<div class="empty-state"><p>데이터를 불러오는 중입니다...</p></div>';

        const hotVideoRatio = parseInt(hotVideoRatioSelect.value);
        let allMutantVideos = [];
        let allLatestVideos = [];

        for (const channel of monitoringChannels) {
            const videos = await getChannelUploads(channel.id);
            if (videos) {
                const videoIds = videos.map(v => v.videoId);
                const videoDetails = await getVideoDetails(videoIds);

                const channelSubscriberCount = channel.subscriberCount;

                // Process videos for mutant and latest
                videoDetails.forEach(video => {
                    const mutantIndex = calculateMutantIndex(video.viewCount, channelSubscriberCount);
                    if (video.viewCount >= (channelSubscriberCount * hotVideoRatio)) {
                        allMutantVideos.push({ ...video, mutantIndex: mutantIndex, channelSubscriberCount: channelSubscriberCount });
                    }
                    allLatestVideos.push({ ...video, channelSubscriberCount: channelSubscriberCount });
                });
            }
            // Update channel management section with mutant/uploaded count
            updateChannelSummary(channel.id, videos ? videos.length : 0, allMutantVideos.filter(v => v.channelId === channel.id).length);
        }

        // Sort mutant videos
        const sortOrder = trackingSortOrderSelect.value;
        let sortedMutantVideos = [...allMutantVideos];
        if (sortOrder === 'ratio') {
            sortedMutantVideos.sort((a, b) => b.mutantIndex - a.mutantIndex);
        } else if (sortOrder === 'publishedAt') {
            sortedMutantVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        } else if (sortOrder === 'subscriberCount') {
            sortedMutantVideos.sort((a, b) => b.channelSubscriberCount - a.channelSubscriberCount);
        } else if (sortOrder === 'viewCount') {
            sortedMutantVideos.sort((a, b) => b.viewCount - a.viewCount);
        }

        renderVideos(sortedMutantVideos, trackingRecords, 'tracking');

        // Sort latest videos by subscriber count descending
        const sortedLatestVideos = [...allLatestVideos].sort((a, b) => b.channelSubscriberCount - a.channelSubscriberCount);
        renderVideos(sortedLatestVideos, latestVideosContainer, 'latest');

        hideLoading();
        showToast('채널 추적 데이터가 업데이트되었습니다.', 'success');
    }

    function updateChannelSummary(channelId, totalVideos, mutantVideosCount) {
        const channelItem = monitoringChannelGrid.querySelector(`.channel-name[data-channel-id="${channelId}"]`).closest('.channel-item');
        if (channelItem) {
            const summaryDiv = channelItem.querySelector('.channel-summary');
            if (summaryDiv) {
                summaryDiv.innerHTML = `<p>${mutantVideosCount} / ${totalVideos} 돌연변이 영상</p>`;
            }
        }
    }


    function renderVideoCard(video, type) {
        const videoCard = document.createElement('div');
        videoCard.classList.add('video-card');

        const isMutant = video.mutantIndex && video.mutantIndex >= parseInt(hotVideoRatioSelect.value);

        videoCard.innerHTML = `
            <img src="${video.thumbnail || 'https://via.placeholder.com/320x180?text=No+Thumbnail'}" alt="${video.title}" class="video-thumbnail">
            <div class="video-details">
                <h4 class="video-title-inline">${video.title}</h4>
                <p class="video-channel">${video.channelTitle}</p>
                <div class="video-stats">
                    <span>👀 ${formatNumber(video.viewCount)}</span>
                    <span>👍 ${formatNumber(video.likeCount)}</span>
                    <span>💬 ${formatNumber(video.commentCount)}</span>
                    ${video.channelSubscriberCount !== undefined ? `<span>👤 ${formatNumber(video.channelSubscriberCount)}</span>` : ''}
                    ${isMutant ? `<span class="tracking-hot-ratio">돌연변이 지수: ${video.mutantIndex.toFixed(2)}</span>` : ''}
                </div>
            </div>
        `;
        videoCard.addEventListener('click', () => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank'));
        return videoCard;
    }

    function renderVideos(videos, container, type) {
        container.innerHTML = '';
        if (videos.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>${type === 'tracking' ? '돌연변이 영상이 없습니다.' : '최신 영상이 없습니다.'}</p></div>`;
            return;
        }
        videos.forEach(video => {
            container.appendChild(renderVideoCard(video, type));
        });
    }

    trackChannelsBtn.addEventListener('click', trackChannels);
    hotVideoRatioSelect.addEventListener('change', trackChannels);
    trackingSortOrderSelect.addEventListener('change', trackChannels);

    // Initial render for monitoring channels
    renderChannelList('monitoring');


    // --- Video Search Tab ---

    dateRangeTypeSelect.addEventListener('change', () => {
        if (dateRangeTypeSelect.value === 'custom') {
            customDateRangeDiv.style.display = 'flex';
            dateRangeSelect.style.display = 'none';
        } else {
            customDateRangeDiv.style.display = 'none';
            dateRangeSelect.style.display = 'block';
        }
    });

    async function searchVideos() {
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return;
        }

        const keyword = searchKeywordInput.value.trim();
        if (!keyword) {
            showToast('검색 키워드를 입력해주세요.', 'info');
            return;
        }

        showLoading();
        searchResultsDiv.innerHTML = '<div class="empty-state"><p>검색 중입니다...</p></div>';

        let publishedAfter = null;
        let publishedBefore = null;

        if (dateRangeTypeSelect.value === 'preset') {
            const range = dateRangeSelect.value;
            const now = new Date();
            let date = new Date(now);

            switch (range) {
                case 'hour': date.setHours(now.getHours() - 1); break;
                case 'hour3': date.setHours(now.getHours() - 3); break;
                case 'hour12': date.setHours(now.getHours() - 12); break;
                case 'day': date.setDate(now.getDate() - 1); break;
                case 'day3': date.setDate(now.getDate() - 3); break;
                case 'week': date.setDate(now.getDate() - 7); break;
                case 'week2': date.setDate(now.getDate() - 14); break;
                case 'month': date.setMonth(now.getMonth() - 1); break;
                case 'month3': date.setMonth(now.getMonth() - 3); break;
                case 'month6': date.setMonth(now.getMonth() - 6); break;
                case 'year': date.setFullYear(now.getFullYear() - 1); break;
            }
            publishedAfter = date.toISOString();
            publishedBefore = now.toISOString(); // Current time
        } else if (dateRangeTypeSelect.value === 'custom') {
            if (startDateInput.value) publishedAfter = new Date(startDateInput.value).toISOString();
            if (endDateInput.value) {
                const endDate = new Date(endDateInput.value);
                endDate.setDate(endDate.getDate() + 1); // To include the end date fully
                publishedBefore = endDate.toISOString();
            } else {
                publishedBefore = new Date().toISOString(); // Default to current time if end date not set
            }
        }


        let allSearchResults = [];
        let nextPageToken = '';
        let maxPages = 3; // Limit to 3 pages for search to avoid excessive API calls

        try {
            for (let i = 0; i < maxPages; i++) {
                let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=50&key=${YOUTUBE_API_KEY}`;
                if (publishedAfter) url += `&publishedAfter=${publishedAfter}`;
                if (publishedBefore) url += `&publishedBefore=${publishedBefore}`;
                if (nextPageToken) url += `&pageToken=${nextPageToken}`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.items) {
                    const videoIds = data.items.map(item => item.id.videoId).filter(Boolean); // Filter out non-video items
                    if (videoIds.length > 0) {
                        const videoDetails = await getVideoDetails(videoIds);
                        // Fetch channel subscribers for each video's channel
                        const channelIds = [...new Set(videoDetails.map(v => v.channelId))];
                        const channelSubscriberMap = {};
                        for (const channelId of channelIds) {
                            const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`);
                            const channelData = await channelResponse.json();
                            if (channelData.items && channelData.items.length > 0) {
                                channelSubscriberMap[channelId] = parseInt(channelData.items[0].statistics.subscriberCount || 0);
                            }
                        }

                        videoDetails.forEach(video => {
                            video.channelSubscriberCount = channelSubscriberMap[video.channelId] || 0;
                            video.mutantIndex = calculateMutantIndex(video.viewCount, video.channelSubscriberCount);
                            allSearchResults.push(video);
                        });
                    }
                }
                nextPageToken = data.nextPageToken;
                if (!nextPageToken) break;
            }
        } catch (error) {
            console.error('Error during video search:', error);
            showToast('영상 검색에 실패했습니다.', 'error');
            hideLoading();
            return;
        }

        // Filter by subscriber and view count
        const minSubs = parseInt(subFilterSelect.value);
        const minViews = parseInt(viewFilterSelect.value);

        let filteredResults = allSearchResults.filter(video => {
            return (video.channelSubscriberCount >= minSubs) && (video.viewCount >= minViews);
        });

        // Filter for "Mutant" videos based on current hotVideoRatioSelect setting (from channel monitoring)
        // Note: The prompt implies using the "돌연변이" concept for search results.
        const hotVideoRatio = parseInt(hotVideoRatioSelect.value); // Use the ratio from Channel Monitoring for consistency
        filteredResults = filteredResults.filter(video => video.viewCount >= (video.channelSubscriberCount * hotVideoRatio));


        // Sort results
        const sortOrder = sortOrderSelect.value;
        if (sortOrder === 'ratio') {
            filteredResults.sort((a, b) => b.mutantIndex - a.mutantIndex);
        } else if (sortOrder === 'viewCount') {
            filteredResults.sort((a, b) => b.viewCount - a.viewCount);
        } else if (sortOrder === 'subscriberCount') {
            filteredResults.sort((a, b) => b.channelSubscriberCount - a.channelSubscriberCount);
        } else if (sortOrder === 'publishedAt') {
            filteredResults.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        }

        renderVideos(filteredResults, searchResultsDiv, 'search');
        hideLoading();
        showToast(`${filteredResults.length}개의 돌연변이 영상을 찾았습니다.`, 'success');
    }

    searchBtn.addEventListener('click', searchVideos);


    // --- Subscriber Tracking Tab (Firebase Integration - Placeholder) ---
    // User needs to provide Firebase configuration. This will be a manual step for them.
    // For now, I'll put a placeholder for Firebase initialization.
    // In a real scenario, you'd load Firebase config from env variables or a secure place.

    // This section assumes Firebase SDK is included in index.html,
    // and Firebase project configuration is available.
    /*
    import { initializeApp } from "firebase/app";
    import { getFirestore, collection, addDoc, query, orderBy, getDocs } from "firebase/firestore";

    // Your web app's Firebase configuration
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const SUBSCRIBER_COLLECTION = "subscriberData"; // Firestore collection name
    */

    async function collectSubscriberData() {
        if (trackingChannels.length === 0) {
            showToast('추적할 채널을 먼저 추가해주세요.', 'info');
            return;
        }
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return;
        }
        // Check if data was collected today
        const lastCollectionDate = localStorage.getItem('lastSubscriberCollectionDate');
        const today = new Date().toDateString();

        if (lastCollectionDate === today) {
            showToast('오늘은 이미 구독자 수 데이터를 수집했습니다. 내일 다시 시도해주세요.', 'info');
            return;
        }

        showLoading();
        const collectedData = [];
        const selectedChannelIds = Array.from(trackingChannelsSelection.querySelectorAll('input[type="checkbox"]:checked'))
                                     .map(checkbox => checkbox.dataset.channelId);

        for (const channel of trackingChannels) {
            if (selectedChannelIds.includes(channel.id)) {
                try {
                    const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channel.id}&key=${YOUTUBE_API_KEY}`);
                    const data = await response.json();
                    if (data.items && data.items.length > 0) {
                        const currentSubscriberCount = parseInt(data.items[0].statistics.subscriberCount || 0);
                        collectedData.push({
                            channelId: channel.id,
                            channelName: channel.name,
                            subscriberCount: currentSubscriberCount,
                            timestamp: new Date().toISOString()
                        });
                        // Save to Firebase (placeholder - actual implementation requires Firebase setup)
                        /*
                        await addDoc(collection(db, SUBSCRIBER_COLLECTION), {
                            channelId: channel.id,
                            channelName: channel.name,
                            subscriberCount: currentSubscriberCount,
                            timestamp: new Date()
                        });
                        */
                    }
                } catch (error) {
                    console.error(`Error collecting subscriber data for ${channel.name}:`, error);
                    showToast(`${channel.name} 구독자 수 수집 실패.`, 'error');
                }
            }
        }

        // For demonstration, we'll store in localStorage if Firebase is not setup
        let historicalData = JSON.parse(localStorage.getItem('subscriberHistoricalData')) || [];
        collectedData.forEach(newData => {
            historicalData.push(newData);
        });
        localStorage.setItem('subscriberHistoricalData', JSON.stringify(historicalData));
        localStorage.setItem('lastSubscriberCollectionDate', today); // Mark today's collection

        hideLoading();
        showToast('오늘의 구독자 수 데이터 수집이 완료되었습니다.', 'success');
        updateLastCollectionInfo();
        renderSubscriberTrackingChannels();
        renderSubscriberChartAndData();
    }

    function updateLastCollectionInfo() {
        const lastCollectionDate = localStorage.getItem('lastSubscriberCollectionDate');
        if (lastCollectionDate) {
            lastCollectionInfoSpan.textContent = `마지막 수집: ${lastCollectionDate}`;
        } else {
            lastCollectionInfoSpan.textContent = `마지막 수집: 없음`;
        }
    }

    function renderSubscriberTrackingChannels() {
        const container = trackingChannelsSelection;
        container.innerHTML = '';
        if (trackingChannels.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>구독자 수 추적을 위해 채널을 추가하세요.</p></div>';
            return;
        }

        trackingChannels.forEach(channel => {
            const channelOption = document.createElement('label');
            channelOption.classList.add('tracking-channel-option');
            channelOption.innerHTML = `
                <input type="checkbox" class="tracking-channel-checkbox" data-channel-id="${channel.id}" checked>
                <div class="tracking-channel-info">
                    <img src="${channel.thumbnail}" alt="${channel.name}" class="tracking-channel-logo">
                    <div class="tracking-channel-text">
                        <p class="tracking-channel-name">${channel.name}</p>
                        <p class="tracking-channel-subscribers">현재 구독자: ${formatNumber(channel.subscriberCount)}명</p>
                    </div>
                </div>
            `;
            container.appendChild(channelOption);

            channelOption.querySelector('.tracking-channel-checkbox').addEventListener('change', (event) => {
                if (event.target.checked) {
                    channelOption.classList.add('selected');
                } else {
                    channelOption.classList.remove('selected');
                }
                renderSubscriberChartAndData(); // Re-render chart based on selection
            });
            channelOption.classList.add('selected'); // Default to selected
        });
    }

    let subscriberChart = null;

    async function renderSubscriberChartAndData() {
        // Assume historicalData is loaded from localStorage for now, in real Firebase would query
        const historicalData = JSON.parse(localStorage.getItem('subscriberHistoricalData')) || [];
        const selectedChannelIds = Array.from(trackingChannelsSelection.querySelectorAll('input[type="checkbox"]:checked'))
                                     .map(checkbox => checkbox.dataset.channelId);

        const filteredData = historicalData.filter(d => selectedChannelIds.includes(d.channelId));

        // Group data by channel and then by date
        const groupedData = filteredData.reduce((acc, curr) => {
            const date = new Date(curr.timestamp).toLocaleDateString('ko-KR');
            if (!acc[curr.channelId]) {
                acc[curr.channelId] = {
                    name: curr.channelName,
                    data: {}
                };
            }
            acc[curr.channelId].data[date] = curr.subscriberCount; // Only store the latest count for that day
            return acc;
        }, {});

        const labels = [...new Set(filteredData.map(d => new Date(d.timestamp).toLocaleDateString('ko-KR')))].sort();

        const datasets = Object.values(groupedData).map((channelGroup, index) => {
            const data = labels.map(date => channelGroup.data[date] || null);
            const color = `hsl(${index * 60}, 70%, 50%)`; // Generate distinct colors
            return {
                label: channelGroup.name,
                data: data,
                borderColor: color,
                backgroundColor: color + '20', // Light transparency
                fill: false,
                tension: 0.1
            };
        });

        if (subscriberChart) {
            subscriberChart.destroy();
        }

        subscriberChart = new Chart(subscriberChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '구독자 수 추이',
                        color: '#333'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '날짜',
                            color: '#666'
                        },
                        ticks: {
                            color: '#666'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '구독자 수',
                            color: '#666'
                        },
                        ticks: {
                            beginAtZero: true,
                            callback: function(value) {
                                return formatNumber(value);
                            },
                            color: '#666'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    }
                }
            }
        });

        // Render detailed data list
        dataListDiv.innerHTML = '';
        if (filteredData.length === 0) {
            dataListDiv.innerHTML = '<div class="empty-state"><p>구독자 수 데이터가 없습니다.</p></div>';
            return;
        }

        // Display latest data for each selected channel
        const latestDataByChannel = {};
        filteredData.forEach(d => {
            if (!latestDataByChannel[d.channelId] || new Date(d.timestamp) > new Date(latestDataByChannel[d.channelId].timestamp)) {
                latestDataByChannel[d.channelId] = d;
            }
        });

        Object.values(latestDataByChannel).forEach(data => {
            const dataItem = document.createElement('div');
            dataItem.classList.add('data-item');
            dataItem.innerHTML = `
                <span class="data-date">${data.channelName} (${new Date(data.timestamp).toLocaleDateString('ko-KR')})</span>
                <span class="data-subscribers">${formatNumber(data.subscriberCount)}명</span>
                <span class="data-growth growth-neutral">N/A</span>
            `;
            dataListDiv.appendChild(dataItem);
        });

    }

    collectSubscriberDataBtn.addEventListener('click', collectSubscriberData);
    chartChannelSelect.addEventListener('change', renderSubscriberChartAndData); // If we add a dropdown to select which channel's data to show in chart

    // Initial render for subscriber tracking channels
    renderChannelList('tracking');
    updateLastCollectionInfo();
    renderSubscriberTrackingChannels();
    renderSubscriberChartAndData(); // Call this to render chart on load


    // --- Thumbnail Test Tab ---

    let testResults = JSON.parse(localStorage.getItem('thumbnailTestResults')) || [];

    function saveTestResults() {
        localStorage.setItem('thumbnailTestResults', JSON.stringify(testResults));
    }

    async function startThumbnailTest() {
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return;
        }

        const testCount = parseInt(testCountSelect.value);
        let currentTestNumber = 0;
        let correctAnswers = 0;

        thumbnailTestArea.innerHTML = '<div class="empty-state"><p>테스트 준비 중...</p></div>';
        showLoading();

        // Clear existing content and display progress
        const testProgressDiv = document.createElement('div');
        testProgressDiv.classList.add('test-progress');
        thumbnailTestArea.innerHTML = '';
        thumbnailTestArea.appendChild(testProgressDiv);

        const progressBarContainer = document.createElement('div');
        progressBarContainer.classList.add('progress-bar-container');
        progressBarContainer.innerHTML = `<div class="progress-bar" id="test-progress-bar" style="width: 0%;"></div>`;
        testProgressDiv.appendChild(progressBarContainer);

        const progressText = document.createElement('span');
        progressText.id = 'test-progress-text';
        progressText.textContent = `0 / ${testCount} (${(0).toFixed(0)}%)`;
        testProgressDiv.appendChild(progressText);

        const testOptionsContainer = document.createElement('div');
        testOptionsContainer.classList.add('thumbnail-options');
        thumbnailTestArea.appendChild(testOptionsContainer);

        const updateProgressBar = (current, total) => {
            const percentage = (current / total) * 100;
            const progressBar = document.getElementById('test-progress-bar');
            const progressText = document.getElementById('test-progress-text');
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
            }
            if (progressText) {
                progressText.textContent = `${current} / ${total} (${percentage.toFixed(0)}%)`;
            }
        };


        for (let i = 0; i < testCount; i++) {
            currentTestNumber++;
            updateProgressBar(currentTestNumber -1, testCount);
            testOptionsContainer.innerHTML = ''; // Clear previous options

            let video1, video2;

            if (testTypeRandomRadio.checked) {
                // Random test: Get random videos
                const randomVideos = await getRandomVideos(2);
                if (randomVideos.length < 2) {
                    showToast('충분한 영상을 찾을 수 없습니다. 다시 시도해주세요.', 'error');
                    hideLoading();
                    return;
                }
                video1 = randomVideos[0];
                video2 = randomVideos[1];
            } else if (testTypeSearchRadio.checked) {
                // Search-based test
                const keyword = searchTestKeywordInput.value.trim();
                if (!keyword) {
                    showToast('검색 키워드를 입력하고 테스트를 시작하세요.', 'error');
                    hideLoading();
                    return;
                }
                const searchResults = await searchVideosForThumbnailTest(keyword, 2);
                if (searchResults.length < 2) {
                    showToast('검색된 영상이 부족합니다. 다른 키워드를 입력하거나 나중에 다시 시도해주세요.', 'error');
                    hideLoading();
                    return;
                }
                video1 = searchResults[0];
                video2 = searchResults[1];
            } else {
                showToast('테스트 유형을 선택해주세요.', 'error');
                hideLoading();
                return;
            }

            if (!video1 || !video2) {
                showToast('영상을 가져오는 데 실패했습니다.', 'error');
                hideLoading();
                return;
            }

            const selectionPromise = new Promise(resolve => {
                const renderOption = (video, index) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.classList.add('thumbnail-option');
                    optionDiv.innerHTML = `
                        <img src="${video.thumbnail}" alt="${video.title}" class="thumbnail-option-img">
                        <p class="thumbnail-option-title">${video.title}</p>
                        <p class="thumbnail-option-views">시청수: ??</p>
                    `;
                    optionDiv.addEventListener('click', () => {
                        resolve({ selectedVideo: video, otherVideo: (index === 1 ? video2 : video1) });
                    });
                    return optionDiv;
                };

                testOptionsContainer.appendChild(renderOption(video1, 1));
                testOptionsContainer.appendChild(renderOption(video2, 2));
            });

            hideLoading(); // Hide loading while user is selecting
            const { selectedVideo, otherVideo } = await selectionPromise;
            showLoading(); // Show loading again for next fetch

            // Reveal actual views and record result
            const allOptions = testOptionsContainer.querySelectorAll('.thumbnail-option');
            allOptions.forEach(option => {
                const videoId = option.querySelector('img').alt === selectedVideo.title ? selectedVideo.videoId : otherVideo.videoId;
                const video = (option.querySelector('img').alt === selectedVideo.title ? selectedVideo : otherVideo);
                option.querySelector('.thumbnail-option-views').textContent = `시청수: ${formatNumber(video.viewCount)}`;
            });

            const isCorrect = (selectedVideo.viewCount > otherVideo.viewCount);
            if (isCorrect) {
                correctAnswers++;
            }
            showToast(isCorrect ? '정답입니다!' : '오답입니다.', isCorrect ? 'success' : 'error');

            await new Promise(res => setTimeout(res, 1000)); // Pause for a moment
        }

        hideLoading();
        const score = (correctAnswers / testCount) * 100;
        const result = {
            date: new Date().toISOString(),
            testCount: testCount,
            correctAnswers: correctAnswers,
            score: score.toFixed(2)
        };
        testResults.push(result);
        saveTestResults();
        renderTestHistory();
        showToast(`테스트 완료! ${correctAnswers} / ${testCount} 정답 (${score.toFixed(2)}%)`, 'info');
        updateProgressBar(testCount, testCount);
    }

    async function getRandomVideos(count) {
        if (!YOUTUBE_API_KEY) return [];
        // This is a simplified random search. A better approach might be to
        // fetch popular videos, or videos from a wide range of categories/channels.
        // For now, a generic search term.
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=random+video&type=video&maxResults=${count * 2}&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();
        const videoIds = data.items.map(item => item.id.videoId).filter(Boolean);
        return await getVideoDetails(videoIds.slice(0, count)); // Get details for twice as many to ensure unique videos
    }

    async function searchVideosForThumbnailTest(keyword, count) {
        if (!YOUTUBE_API_KEY) return [];
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=${count * 2}&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();
        const videoIds = data.items.map(item => item.id.videoId).filter(Boolean);
        return await getVideoDetails(videoIds.slice(0, count));
    }

    function renderTestHistory() {
        testRecordList.innerHTML = '';
        if (testResults.length === 0) {
            testRecordList.innerHTML = '<div class="empty-state"><p>테스트 이력이 없습니다.</p></div>';
            return;
        }

        // Sort by date descending
        const sortedResults = [...testResults].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedResults.forEach(record => {
            const recordItem = document.createElement('div');
            recordItem.classList.add('test-record-item');
            recordItem.innerHTML = `
                <div class="record-info">
                    <span class="record-date">${new Date(record.date).toLocaleDateString('ko-KR')}</span>
                    <span class="record-keyword">테스트 ${record.testCount}회</span>
                </div>
                <div class="record-score">
                    <span class="record-score-number">${record.correctAnswers} / ${record.testCount}</span>
                    <span class="record-percentage">(${record.score}%)</span>
                </div>
            `;
            testRecordList.appendChild(recordItem);
        });
    }


    startTestBtn.addEventListener('click', startThumbnailTest);
    testTypeRandomRadio.addEventListener('change', () => {
        searchTestKeywordInput.style.display = 'none';
        searchTestKeywordInput.value = ''; // Clear keyword when switching to random
    });
    testTypeSearchRadio.addEventListener('change', () => {
        searchTestKeywordInput.style.display = 'block';
    });

    // Initial render calls
    loadApiKey(); // Load API key on startup
    renderChannelList('monitoring');
    renderChannelList('tracking');
    renderSubscriberTrackingChannels();
    renderSubscriberChartAndData();
    renderTestHistory();
});
```

I have created the `script.js` file with the initial structure, including API key management using `localStorage`, basic tab navigation, and placeholder functions for the more complex features like YouTube API calls, "Mutant" logic, channel management (add/delete), and skeleton functions for the other tabs (Video Search, Subscriber Tracking, Thumbnail Test).

Here's what's included and what's pending:

**Implemented:**

  * **DOM Content Loaded Listener:** Ensures the script runs after the HTML is loaded.
  * **Global Variables/Constants:** Defined `API_KEY_STORAGE_KEY` and `YOUTUBE_API_KEY`.
  * **Helper Functions:** `showLoading`, `hideLoading`, `showToast` (console log for now), `formatNumber` (for subscribers/views), `getDaysDifference`.
  * **API Key Management:**
      * Loads API key from `localStorage` on startup.
      * Updates `api-status-text`.
      * Handles opening/closing `api-settings-modal`.
      * Saves API key to `localStorage` when "저장" button is clicked.
  * **Tab Navigation Logic:** Switches `tab-content` visibility based on `tab-btn` clicks.
  * **Channel Management (Add/Delete):**
      * `monitoringChannels` and `trackingChannels` arrays stored in `localStorage`.
      * `saveChannels` function to persist data.
      * `fetchChannelDetails` function:
          * Handles channel identifier (name, URL, ID).
          * Uses YouTube Data API (v3) to get channel `snippet`, `statistics`, and `contentDetails`.
          * Handles `channel-selection-modal` for multiple search results.
          * Includes basic error handling and loading indicators.
      * `addSelectedChannel`: Adds a channel to the respective list, checks for duplicates.
      * `removeChannel`: Removes a channel from the list.
      * `renderChannelList`: Renders channel items in `monitoring-channel-grid` and `tracking-channel-grid`, including delete buttons.
      * `toggleChannelManagementSection`: Collapses/expands channel management sections.
  * **YouTube Data API Integration (Core):**
      * `getChannelUploads`: Fetches videos from a channel's uploads playlist (limited to last 6 months).
      * `getVideoDetails`: Fetches statistics for given video IDs.
      * `calculateMutantIndex`: Implements the "Mutant Index" calculation.
  * **Channel Monitoring Tab:**
      * `trackChannels`: Initiates the tracking process for all monitoring channels.
      * Fetches videos, calculates mutant index, and filters based on `hotVideoRatio`.
      * Sorts mutant videos and latest videos.
      * `updateChannelSummary`: Updates the "Mutant / Uploaded Videos" count in the channel item.
      * `renderVideoCard`: Creates the HTML structure for a video display.
      * `renderVideos`: Populates `tracking-records` (mutant videos) and `latest-videos-container` (latest videos).
      * Event listeners for `track-channels-btn`, `hot-video-ratio`, `tracking-sort-order`.
  * **Video Search Tab:**
      * `searchVideos`: Handles keyword search.
      * Includes date range filtering (preset and custom).
      * Filters by subscriber count and view count.
      * Filters for "Mutant" videos (reusing `hotVideoRatioSelect`).
      * Sorts search results.
      * Populates `searchResultsDiv`.
  * **Subscriber Tracking Tab:**
      * **Firebase Integration (Placeholder):** Comments indicate where Firebase initialization and data saving (`addDoc`) would occur. **User needs to set up Firebase and provide config.**
      * `collectSubscriberData`: Fetches current subscriber counts for selected channels.
      * Stores data in `localStorage` for now (will switch to Firebase when configured).
      * `updateLastCollectionInfo`: Displays the last collection date.
      * `renderSubscriberTrackingChannels`: Renders selectable checkboxes for channels.
      * `renderSubscriberChartAndData`: Renders Chart.js graph and a list of subscriber data.
  * **Thumbnail Test Tab:**
      * Stores `testResults` in `localStorage`.
      * `startThumbnailTest`: Initiates the test, displays progress.
      * `getRandomVideos`: Placeholder for fetching random videos for test.
      * `searchVideosForThumbnailTest`: Placeholder for fetching search-based videos for test.
      * Includes logic for displaying two thumbnails and user selection.
      * Records and renders `testResults`.
      * Event listeners for test type radios and `start-test-btn`.

**Pending (Requires User Action/Further Detail):**

  * **Firebase Configuration:** The user needs to provide their Firebase project configuration (`apiKey`, `authDomain`, `projectId`, etc.) for the subscriber tracking feature to fully function with a persistent database. I've left comments in the `script.js` file where this would be integrated.
  * **`showToast` Implementation:** Currently, `showToast` just logs to the console. A visual toast notification system (e.g., using a dedicated library or custom CSS/JS) would be beneficial.
  * **Detailed Error Handling:** While basic error handling is present, more robust error messages and user feedback could be added.
  * **Pagination/Infinite Scroll:** For video search and channel monitoring sections, if there are many results, implementing pagination or infinite scrolling would improve performance and user experience.
  * **Rate Limiting:** YouTube Data API has quotas. Implement client-side rate limiting or notify the user if quotas are exceeded.
  * **Channel Logo Placeholders:** Currently, `channel-logo-placeholder` is generic. Could consider using a default image if no logo is available.
  * **Subscriber Growth Calculation:** The `data-growth` span in the subscriber tracking tab is `N/A`. Calculating and displaying daily/weekly growth would require more sophisticated data processing from historical data.
  * **Backup/Restore for Tracking Data:** The HTML includes buttons for backup/restore of tracking data. These functionalities are not yet implemented in the JS.
  * **Thumbnail Test - Actual Video Fetching for Random/Search:** `getRandomVideos` and `searchVideosForThumbnailTest` are simplified; they fetch broad results. For a more robust test, they should intelligently select videos.

This `script.js` file provides a solid foundation for the requested YouTube Channel Monitor application.

```javascript
// script.js

// 1. DOM Content Loaded Listener
document.addEventListener('DOMContentLoaded', () => {
    // 2. Global Variables/Constants
    const API_KEY_STORAGE_KEY = 'youtube_api_key';
    let YOUTUBE_API_KEY = ''; // This will be loaded from localStorage or set by user

    // Get DOM elements
    const apiStatusText = document.getElementById('api-status-text');
    const apiSettingsBtn = document.getElementById('api-settings-btn');
    const apiSettingsModal = document.getElementById('api-settings-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const closeApiModalBtn = document.getElementById('close-api-modal-btn');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const addChannelModal = document.getElementById('add-channel-modal');
    const channelInput = document.getElementById('channel-input');
    const addChannelConfirmBtn = document.getElementById('add-channel-confirm-btn');
    const cancelChannelBtn = document.getElementById('cancel-channel-btn');
    const channelSelectionModal = document.getElementById('channel-selection-modal');
    const channelSelectionList = document.getElementById('channel-selection-list');
    const cancelChannelSelectionBtn = document.getElementById('cancel-channel-selection-btn');
    const loadingOverlay = document.getElementById('loading-overlay');

    // For Channel Monitoring Tab
    const addMonitoringChannelBtn = document.getElementById('add-monitoring-channel-btn');
    const monitoringChannelGrid = document.getElementById('monitoring-channel-grid');
    const monitoringChannelCount = document.getElementById('monitoring-channel-count');
    const trackingRecords = document.getElementById('tracking-records');
    const latestVideosContainer = document.getElementById('latest-videos-container');
    const hotVideoRatioSelect = document.getElementById('hot-video-ratio');
    const trackingSortOrderSelect = document.getElementById('tracking-sort-order');
    const trackChannelsBtn = document.getElementById('track-channels-btn');
    const showAllChannelsCheckbox = document.getElementById('show-all-channels');
    const monitoringCollapseBtn = document.getElementById('monitoring-collapse-btn');

    // For Video Search Tab
    const searchKeywordInput = document.getElementById('search-keyword');
    const searchBtn = document.getElementById('search-btn');
    const subFilterSelect = document.getElementById('sub-filter');
    const viewFilterSelect = document.getElementById('view-filter');
    const dateRangeTypeSelect = document.getElementById('date-range-type');
    const dateRangeSelect = document.getElementById('date-range');
    const customDateRangeDiv = document.getElementById('custom-date-range');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const sortOrderSelect = document.getElementById('sort-order');
    const searchResultsDiv = document.getElementById('search-results');

    // For Subscriber Tracking Tab
    const collectSubscriberDataBtn = document.getElementById('collect-subscriber-data-btn');
    const lastCollectionInfoSpan = document.getElementById('last-collection-info');
    const addTrackingChannelBtn = document.getElementById('add-tracking-channel-btn');
    const trackingChannelGrid = document.getElementById('tracking-channel-grid');
    const trackingChannelCount = document.getElementById('tracking-channel-count');
    const trackingCollapseBtn = document.getElementById('tracking-collapse-btn');
    const trackingChannelsSelection = document.getElementById('tracking-channels-selection');
    const subscriberChartCanvas = document.getElementById('subscriber-chart');
    const chartChannelSelect = document.getElementById('chart-channel-select');
    const dataListDiv = document.getElementById('data-list');

    // For Thumbnail Test Tab
    const testTypeRandomRadio = document.getElementById('test-type-random');
    const testTypeSearchRadio = document.getElementById('test-type-search');
    const searchTestKeywordInput = document.getElementById('search-test-keyword');
    const startTestBtn = document.getElementById('start-test-btn');
    const testCountSelect = document.getElementById('test-count-select');
    const thumbnailTestArea = document.getElementById('thumbnail-test-area');
    const testRecordList = document.getElementById('test-record-list');


    // --- Helper Functions ---

    /**
     * Shows the loading overlay.
     */
    function showLoading() {
        loadingOverlay.style.display = 'flex';
    }

    /**
     * Hides the loading overlay.
     */
    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    /**
     * Displays a toast message. (Placeholder for now)
     * @param {string} message The message to display.
     * @param {string} type The type of message (e.g., 'success', 'error', 'info').
     */
    function showToast(message, type = 'info') {
        // In a real application, you would implement a visible toast notification here.
        console.log(`Toast (${type}): ${message}`);
        // Example: You could create a div, add it to the body, and animate its appearance/disappearance
    }

    /**
     * Formats a number with commas and appropriate suffixes for large numbers.
     * @param {number} num The number to format.
     * @returns {string} The formatted number string.
     */
    function formatNumber(num) {
        if (num >= 100000000) {
            return (num / 100000000).toFixed(1) + '억';
        }
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + '만';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + '천';
        }
        return num.toLocaleString();
    }

    /**
     * Calculates the time difference in days.
     * @param {string} date1String ISO date string.
     * @param {string} date2String ISO date string.
     * @returns {number} The difference in days.
     */
    function getDaysDifference(date1String, date2String) {
        const date1 = new Date(date1String);
        const date2 = new Date(date2String);
        const diffTime = Math.abs(date2.getTime() - date1.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }


    // --- API Key Management ---

    /**
     * Loads the API key from local storage.
     */
    function loadApiKey() {
        YOUTUBE_API_KEY = localStorage.getItem(API_KEY_STORAGE_KEY);
        updateApiStatus();
    }

    /**
     * Updates the API status text based on whether a key is set.
     */
    function updateApiStatus() {
        if (YOUTUBE_API_KEY) {
            apiStatusText.textContent = 'API 키 설정됨';
            apiStatusText.style.color = '#4CAF50';
        } else {
            apiStatusText.textContent = 'API 키 설정 필요';
            apiStatusText.style.color = '#F44336';
        }
    }

    /**
     * Saves the API key to local storage.
     */
    saveApiKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem(API_KEY_STORAGE_KEY, key);
            YOUTUBE_API_KEY = key;
            updateApiStatus();
            showToast('API 키가 저장되었습니다.', 'success');
            apiSettingsModal.style.display = 'none';
        } else {
            showToast('유효한 API 키를 입력해주세요.', 'error');
        }
    });

    apiSettingsBtn.addEventListener('click', () => {
        apiKeyInput.value = YOUTUBE_API_KEY; // Populate input with current key
        apiSettingsModal.style.display = 'block';
    });

    closeApiModalBtn.addEventListener('click', () => {
        apiSettingsModal.style.display = 'none';
    });

    // Close modal if clicked outside
    window.addEventListener('click', (event) => {
        if (event.target === apiSettingsModal) {
            apiSettingsModal.style.display = 'none';
        }
        if (event.target === addChannelModal) {
            addChannelModal.style.display = 'none';
        }
        if (event.target === channelSelectionModal) {
            channelSelectionModal.style.display = 'none';
        }
    });


    // --- Tab Navigation Logic ---

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and content
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const targetTabId = button.dataset.tab;
            document.getElementById(targetTabId).classList.add('active');
        });
    });

    // --- Channel Management (Common functions for both monitoring and tracking) ---
    let monitoringChannels = JSON.parse(localStorage.getItem('monitoringChannels')) || [];
    let trackingChannels = JSON.parse(localStorage.getItem('trackingChannels')) || [];

    function saveChannels(type) {
        if (type === 'monitoring') {
            localStorage.setItem('monitoringChannels', JSON.stringify(monitoringChannels));
        } else if (type === 'tracking') {
            localStorage.setItem('trackingChannels', JSON.stringify(trackingChannels));
        }
    }

    async function fetchChannelDetails(channelIdentifier) {
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return null;
        }

        showLoading();
        let channelId = '';
        const isUrl = channelIdentifier.startsWith('http');
        const isId = channelIdentifier.startsWith('UC'); // YouTube Channel IDs start with UC

        if (isUrl) {
            try {
                const url = new URL(channelIdentifier);
                if (url.hostname.includes('youtube.com')) {
                    if (url.pathname.includes('/channel/')) {
                        channelId = url.pathname.split('/channel/')[1];
                    } else if (url.pathname.includes('/user/')) {
                        // For /user/ URLs, we need to search by username
                        const username = url.pathname.split('/user/')[1];
                        const searchUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forUsername=${username}&key=${YOUTUBE_API_KEY}`;
                        const response = await fetch(searchUrl);
                        const data = await response.json();
                        if (data.items && data.items.length > 0) {
                            channelId = data.items[0].id;
                        }
                    } else if (url.pathname.includes('/c/')) {
                        // For /c/ URLs (custom URLs), we need to search by channel name
                        const customUrlName = url.pathname.split('/c/')[1];
                        const searchUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${customUrlName}&key=${YOUTUBE_API_KEY}`;
                        const response = await fetch(searchUrl);
                        const data = await response.json();
                        if (data.items && data.items.length > 0) {
                            channelId = data.items[0].id;
                        }
                    }
                }
            } catch (error) {
                console.error('URL parsing error:', error);
            }
        } else if (isId) {
            channelId = channelIdentifier;
        } else {
            // Assume it's a channel name, search for it
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(channelIdentifier)}&type=channel&key=${YOUTUBE_API_KEY}`;
            const response = await fetch(searchUrl);
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                if (data.items.length === 1) {
                    channelId = data.items[0].id.channelId;
                } else {
                    // Show channel selection modal
                    hideLoading();
                    renderChannelSelectionModal(data.items);
                    return null; // Stop further processing here, wait for user selection
                }
            }
        }

        if (channelId) {
            try {
                const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${YOUTUBE_API_KEY}`);
                const data = await response.json();
                hideLoading();
                if (data.items && data.items.length > 0) {
                    const channel = data.items[0];
                    return {
                        id: channel.id,
                        name: channel.snippet.title,
                        thumbnail: channel.snippet.thumbnails.default.url,
                        subscriberCount: parseInt(channel.statistics.subscriberCount),
                        videoCount: parseInt(channel.statistics.videoCount),
                        uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads
                    };
                } else {
                    showToast('채널을 찾을 수 없습니다.', 'error');
                    return null;
                }
            } catch (error) {
                hideLoading();
                console.error('Error fetching channel details:', error);
                showToast('채널 정보를 가져오는 데 실패했습니다. API 키를 확인하거나 나중에 다시 시도해주세요.', 'error');
                return null;
            }
        } else {
            hideLoading();
            if (!channelSelectionModal.style.display || channelSelectionModal.style.display === 'none') {
                showToast('유효한 채널 정보를 찾을 수 없습니다.', 'error');
            }
            return null;
        }
    }

    function renderChannelSelectionModal(channels) {
        channelSelectionList.innerHTML = '';
        channels.forEach(channel => {
            const channelItem = document.createElement('div');
            channelItem.classList.add('channel-selection-item');
            channelItem.innerHTML = `
                <img src="${channel.snippet.thumbnails.default.url}" alt="${channel.snippet.title}" class="channel-selection-logo">
                <span class="channel-selection-name">${channel.snippet.title}</span>
            `;
            channelItem.addEventListener('click', async () => {
                channelSelectionModal.style.display = 'none';
                await addSelectedChannel(channel.id.channelId, currentChannelAddType);
            });
            channelSelectionList.appendChild(channelItem);
        });
        channelSelectionModal.style.display = 'block';
    }

    cancelChannelSelectionBtn.addEventListener('click', () => {
        channelSelectionModal.style.display = 'none';
    });

    let currentChannelAddType = ''; // 'monitoring' or 'tracking'

    addMonitoringChannelBtn.addEventListener('click', () => {
        currentChannelAddType = 'monitoring';
        channelInput.value = ''; // Clear previous input
        addChannelModal.style.display = 'block';
    });

    addTrackingChannelBtn.addEventListener('click', () => {
        currentChannelAddType = 'tracking';
        channelInput.value = ''; // Clear previous input
        addChannelModal.style.display = 'block';
    });

    addChannelConfirmBtn.addEventListener('click', async () => {
        const identifier = channelInput.value.trim();
        if (identifier) {
            addChannelModal.style.display = 'none'; // Hide the input modal
            await addSelectedChannel(identifier, currentChannelAddType);
        } else {
            showToast('채널명, URL 또는 ID를 입력하세요.', 'error');
        }
    });

    cancelChannelBtn.addEventListener('click', () => {
        addChannelModal.style.display = 'none';
    });


    async function addSelectedChannel(identifier, type) {
        if (!identifier) return;

        const channelDetails = await fetchChannelDetails(identifier);
        if (channelDetails) {
            let channelsArray = type === 'monitoring' ? monitoringChannels : trackingChannels;

            const isDuplicate = channelsArray.some(c => c.id === channelDetails.id);
            if (isDuplicate) {
                showToast('이미 등록된 채널입니다.', 'info');
                return;
            }

            channelsArray.push(channelDetails);
            saveChannels(type);
            renderChannelList(type);
            showToast(`${channelDetails.name} 채널이 추가되었습니다.`, 'success');
        }
    }

    function removeChannel(channelId, type) {
        if (type === 'monitoring') {
            monitoringChannels = monitoringChannels.filter(c => c.id !== channelId);
        } else if (type === 'tracking') {
            trackingChannels = trackingChannels.filter(c => c.id !== channelId);
        }
        saveChannels(type);
        renderChannelList(type);
        showToast('채널이 삭제되었습니다.', 'success');
    }

    function renderChannelList(type) {
        const gridContainer = type === 'monitoring' ? monitoringChannelGrid : trackingChannelGrid;
        const countSpan = type === 'monitoring' ? monitoringChannelCount : trackingChannelCount;
        let channelsArray = type === 'monitoring' ? monitoringChannels : trackingChannels;

        gridContainer.innerHTML = '';
        countSpan.textContent = channelsArray.length;

        if (channelsArray.length === 0) {
            gridContainer.innerHTML = '<div class="channel-grid-empty"><p>등록된 채널이 없습니다.</p></div>';
            return;
        }

        channelsArray.forEach(channel => {
            const channelItem = document.createElement('div');
            channelItem.classList.add('channel-item');
            channelItem.innerHTML = `
                <div class="channel-item-header">
                    <div class="channel-info-with-logo">
                        <img src="${channel.thumbnail}" alt="${channel.name}" class="channel-logo">
                        <div class="channel-text-info">
                            <h4 class="channel-name" data-channel-id="${channel.id}">${channel.name}</h4>
                            <span class="channel-subscribers">구독자 ${formatNumber(channel.subscriberCount)}명</span>
                        </div>
                    </div>
                    <div class="channel-actions">
                        <button class="btn-icon delete-channel-btn" data-channel-id="${channel.id}" data-channel-type="${type}">✖️</button>
                    </div>
                </div>
                <div class="channel-info">
                    <span class="channel-id">${channel.id}</span>
                    <span class="channel-stats">총 영상: ${formatNumber(channel.videoCount)}</span>
                </div>
                <div class="channel-status">
                    <span class="status-indicator"></span>
                    <span>상태: 정상</span>
                </div>
                <div class="channel-summary">
                    </div>
            `;
            gridContainer.appendChild(channelItem);
        });

        // Add event listeners for delete buttons
        gridContainer.querySelectorAll('.delete-channel-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const channelId = event.target.dataset.channelId;
                const channelType = event.target.dataset.channelType;
                if (confirm('이 채널을 삭제하시겠습니까?')) {
                    removeChannel(channelId, channelType);
                }
            });
        });
    }

    // Toggle channel management sections
    document.querySelectorAll('.management-header').forEach(header => {
        header.addEventListener('click', (event) => {
            const type = event.currentTarget.querySelector('.collapse-btn').id.includes('monitoring') ? 'monitoring' : 'tracking';
            toggleChannelManagementSection(type);
        });
    });

    function toggleChannelManagementSection(type) {
        const grid = type === 'monitoring' ? monitoringChannelGrid : trackingChannelGrid;
        const collapseBtn = type === 'monitoring' ? monitoringCollapseBtn : trackingCollapseBtn;

        if (grid.style.display === 'none') {
            grid.style.display = 'grid';
            collapseBtn.textContent = '▼';
        } else {
            grid.style.display = 'none';
            collapseBtn.textContent = '▲';
        }
    }


    // --- YouTube Data API Integration & Mutant Logic ---

    // Define "Mutant" and "Mutant Index"
    // Mutant: Video uploaded within last 6 months, views > (subscriberCount * hotVideoRatio)
    // Mutant Index: video_views / subscriber_count

    async function getChannelUploads(channelId) {
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return null;
        }
        try {
            const channel = monitoringChannels.find(c => c.id === channelId);
            if (!channel || !channel.uploadsPlaylistId) {
                console.error('Channel or uploadsPlaylistId not found for:', channelId);
                return null;
            }

            const uploadsPlaylistId = channel.uploadsPlaylistId;
            let videos = [];
            let nextPageToken = '';
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            // Fetch videos from uploads playlist
            do {
                const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.items) {
                    for (const item of data.items) {
                        const publishedAt = new Date(item.snippet.publishedAt);
                        if (publishedAt >= sixMonthsAgo) {
                            videos.push({
                                videoId: item.contentDetails.videoId,
                                title: item.snippet.title,
                                thumbnail: item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : '',
                                publishedAt: item.snippet.publishedAt,
                                channelTitle: item.snippet.channelTitle
                            });
                        } else {
                            // Videos are usually returned in reverse chronological order, so we can stop if we hit older videos
                            nextPageToken = null;
                            break;
                        }
                    }
                }
                nextPageToken = data.nextPageToken;
            } while (nextPageToken);

            return videos;
        } catch (error) {
            console.error('Error fetching channel uploads:', error);
            showToast('채널 영상을 가져오는 데 실패했습니다.', 'error');
            return null;
        }
    }

    async function getVideoDetails(videoIds) {
        if (!videoIds || videoIds.length === 0) return [];
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return [];
        }

        try {
            const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.items) {
                return data.items.map(item => ({
                    videoId: item.id,
                    title: item.snippet.title,
                    thumbnail: item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : '',
                    publishedAt: item.snippet.publishedAt,
                    viewCount: parseInt(item.statistics.viewCount || 0),
                    likeCount: parseInt(item.statistics.likeCount || 0),
                    commentCount: parseInt(item.statistics.commentCount || 0),
                    channelId: item.snippet.channelId,
                    channelTitle: item.snippet.channelTitle
                }));
            }
            return [];
        } catch (error) {
            console.error('Error fetching video details:', error);
            showToast('영상 정보를 가져오는 데 실패했습니다.', 'error');
            return [];
        }
    }

    function calculateMutantIndex(videoViews, subscriberCount) {
        if (subscriberCount === 0) return 0; // Avoid division by zero
        return (videoViews / subscriberCount);
    }

    // --- Channel Monitoring Tab ---

    async function trackChannels() {
        if (monitoringChannels.length === 0) {
            showToast('모니터링할 채널을 먼저 추가해주세요.', 'info');
            return;
        }
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return;
        }

        showLoading();
        trackingRecords.innerHTML = '<div class="empty-state"><p>데이터를 불러오는 중입니다...</p></div>';
        latestVideosContainer.innerHTML = '<div class="empty-state"><p>데이터를 불러오는 중입니다...</p></div>';

        const hotVideoRatio = parseInt(hotVideoRatioSelect.value);
        let allMutantVideos = [];
        let allLatestVideos = [];

        for (const channel of monitoringChannels) {
            const videos = await getChannelUploads(channel.id);
            if (videos) {
                const videoIds = videos.map(v => v.videoId);
                const videoDetails = await getVideoDetails(videoIds);

                const channelSubscriberCount = channel.subscriberCount;

                // Process videos for mutant and latest
                videoDetails.forEach(video => {
                    const mutantIndex = calculateMutantIndex(video.viewCount, channelSubscriberCount);
                    if (video.viewCount >= (channelSubscriberCount * hotVideoRatio)) {
                        allMutantVideos.push({ ...video, mutantIndex: mutantIndex, channelSubscriberCount: channelSubscriberCount });
                    }
                    allLatestVideos.push({ ...video, channelSubscriberCount: channelSubscriberCount });
                });
            }
            // Update channel management section with mutant/uploaded count
            updateChannelSummary(channel.id, videos ? videos.length : 0, allMutantVideos.filter(v => v.channelId === channel.id).length);
        }

        // Sort mutant videos
        const sortOrder = trackingSortOrderSelect.value;
        let sortedMutantVideos = [...allMutantVideos];
        if (sortOrder === 'ratio') {
            sortedMutantVideos.sort((a, b) => b.mutantIndex - a.mutantIndex);
        } else if (sortOrder === 'publishedAt') {
            sortedMutantVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        } else if (sortOrder === 'subscriberCount') {
            sortedMutantVideos.sort((a, b) => b.channelSubscriberCount - a.channelSubscriberCount);
        } else if (sortOrder === 'viewCount') {
            sortedMutantVideos.sort((a, b) => b.viewCount - a.viewCount);
        }

        renderVideos(sortedMutantVideos, trackingRecords, 'tracking');

        // Sort latest videos by subscriber count descending
        const sortedLatestVideos = [...allLatestVideos].sort((a, b) => b.channelSubscriberCount - a.channelSubscriberCount);
        renderVideos(sortedLatestVideos, latestVideosContainer, 'latest');

        hideLoading();
        showToast('채널 추적 데이터가 업데이트되었습니다.', 'success');
    }

    function updateChannelSummary(channelId, totalVideos, mutantVideosCount) {
        const channelItem = monitoringChannelGrid.querySelector(`.channel-name[data-channel-id="${channelId}"]`).closest('.channel-item');
        if (channelItem) {
            const summaryDiv = channelItem.querySelector('.channel-summary');
            if (summaryDiv) {
                summaryDiv.innerHTML = `<p>${mutantVideosCount} / ${totalVideos} 돌연변이 영상</p>`;
            }
        }
    }


    function renderVideoCard(video, type) {
        const videoCard = document.createElement('div');
        videoCard.classList.add('video-card');

        const isMutant = video.mutantIndex && video.mutantIndex >= parseInt(hotVideoRatioSelect.value);

        videoCard.innerHTML = `
            <img src="${video.thumbnail || 'https://via.placeholder.com/320x180?text=No+Thumbnail'}" alt="${video.title}" class="video-thumbnail">
            <div class="video-details">
                <h4 class="video-title-inline">${video.title}</h4>
                <p class="video-channel">${video.channelTitle}</p>
                <div class="video-stats">
                    <span>👀 ${formatNumber(video.viewCount)}</span>
                    <span>👍 ${formatNumber(video.likeCount)}</span>
                    <span>💬 ${formatNumber(video.commentCount)}</span>
                    ${video.channelSubscriberCount !== undefined ? `<span>👤 ${formatNumber(video.channelSubscriberCount)}</span>` : ''}
                    ${isMutant ? `<span class="tracking-hot-ratio">돌연변이 지수: ${video.mutantIndex.toFixed(2)}</span>` : ''}
                </div>
            </div>
        `;
        videoCard.addEventListener('click', () => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank'));
        return videoCard;
    }

    function renderVideos(videos, container, type) {
        container.innerHTML = '';
        if (videos.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>${type === 'tracking' ? '돌연변이 영상이 없습니다.' : '최신 영상이 없습니다.'}</p></div>`;
            return;
        }
        videos.forEach(video => {
            container.appendChild(renderVideoCard(video, type));
        });
    }

    trackChannelsBtn.addEventListener('click', trackChannels);
    hotVideoRatioSelect.addEventListener('change', trackChannels);
    trackingSortOrderSelect.addEventListener('change', trackChannels);

    // Initial render for monitoring channels
    renderChannelList('monitoring');


    // --- Video Search Tab ---

    dateRangeTypeSelect.addEventListener('change', () => {
        if (dateRangeTypeSelect.value === 'custom') {
            customDateRangeDiv.style.display = 'flex';
            dateRangeSelect.style.display = 'none';
        } else {
            customDateRangeDiv.style.display = 'none';
            dateRangeSelect.style.display = 'block';
        }
    });

    async function searchVideos() {
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return;
        }

        const keyword = searchKeywordInput.value.trim();
        if (!keyword) {
            showToast('검색 키워드를 입력해주세요.', 'info');
            return;
        }

        showLoading();
        searchResultsDiv.innerHTML = '<div class="empty-state"><p>검색 중입니다...</p></div>';

        let publishedAfter = null;
        let publishedBefore = null;

        if (dateRangeTypeSelect.value === 'preset') {
            const range = dateRangeSelect.value;
            const now = new Date();
            let date = new Date(now);

            switch (range) {
                case 'hour': date.setHours(now.getHours() - 1); break;
                case 'hour3': date.setHours(now.getHours() - 3); break;
                case 'hour12': date.setHours(now.getHours() - 12); break;
                case 'day': date.setDate(now.getDate() - 1); break;
                case 'day3': date.setDate(now.getDate() - 3); break;
                case 'week': date.setDate(now.getDate() - 7); break;
                case 'week2': date.setDate(now.getDate() - 14); break;
                case 'month': date.setMonth(now.getMonth() - 1); break;
                case 'month3': date.setMonth(now.getMonth() - 3); break;
                case 'month6': date.setMonth(now.getMonth() - 6); break;
                case 'year': date.setFullYear(now.getFullYear() - 1); break;
            }
            publishedAfter = date.toISOString();
            publishedBefore = now.toISOString(); // Current time
        } else if (dateRangeTypeSelect.value === 'custom') {
            if (startDateInput.value) publishedAfter = new Date(startDateInput.value).toISOString();
            if (endDateInput.value) {
                const endDate = new Date(endDateInput.value);
                endDate.setDate(endDate.getDate() + 1); // To include the end date fully
                publishedBefore = endDate.toISOString();
            } else {
                publishedBefore = new Date().toISOString(); // Default to current time if end date not set
            }
        }


        let allSearchResults = [];
        let nextPageToken = '';
        let maxPages = 3; // Limit to 3 pages for search to avoid excessive API calls

        try {
            for (let i = 0; i < maxPages; i++) {
                let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=50&key=${YOUTUBE_API_KEY}`;
                if (publishedAfter) url += `&publishedAfter=${publishedAfter}`;
                if (publishedBefore) url += `&publishedBefore=${publishedBefore}`;
                if (nextPageToken) url += `&pageToken=${nextPageToken}`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.items) {
                    const videoIds = data.items.map(item => item.id.videoId).filter(Boolean); // Filter out non-video items
                    if (videoIds.length > 0) {
                        const videoDetails = await getVideoDetails(videoIds);
                        // Fetch channel subscribers for each video's channel
                        const channelIds = [...new Set(videoDetails.map(v => v.channelId))];
                        const channelSubscriberMap = {};
                        for (const channelId of channelIds) {
                            const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`);
                            const channelData = await channelResponse.json();
                            if (channelData.items && channelData.items.length > 0) {
                                channelSubscriberMap[channelId] = parseInt(channelData.items[0].statistics.subscriberCount || 0);
                            }
                        }

                        videoDetails.forEach(video => {
                            video.channelSubscriberCount = channelSubscriberMap[video.channelId] || 0;
                            video.mutantIndex = calculateMutantIndex(video.viewCount, video.channelSubscriberCount);
                            allSearchResults.push(video);
                        });
                    }
                }
                nextPageToken = data.nextPageToken;
                if (!nextPageToken) break;
            }
        } catch (error) {
            console.error('Error during video search:', error);
            showToast('영상 검색에 실패했습니다.', 'error');
            hideLoading();
            return;
        }

        // Filter by subscriber and view count
        const minSubs = parseInt(subFilterSelect.value);
        const minViews = parseInt(viewFilterSelect.value);

        let filteredResults = allSearchResults.filter(video => {
            return (video.channelSubscriberCount >= minSubs) && (video.viewCount >= minViews);
        });

        // Filter for "Mutant" videos based on current hotVideoRatioSelect setting (from channel monitoring)
        // Note: The prompt implies using the "돌연변이" concept for search results.
        const hotVideoRatio = parseInt(hotVideoRatioSelect.value); // Use the ratio from Channel Monitoring for consistency
        filteredResults = filteredResults.filter(video => video.viewCount >= (video.channelSubscriberCount * hotVideoRatio));


        // Sort results
        const sortOrder = sortOrderSelect.value;
        if (sortOrder === 'ratio') {
            filteredResults.sort((a, b) => b.mutantIndex - a.mutantIndex);
        } else if (sortOrder === 'viewCount') {
            filteredResults.sort((a, b) => b.viewCount - a.viewCount);
        } else if (sortOrder === 'subscriberCount') {
            filteredResults.sort((a, b) => b.channelSubscriberCount - a.channelSubscriberCount);
        } else if (sortOrder === 'publishedAt') {
            filteredResults.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        }

        renderVideos(filteredResults, searchResultsDiv, 'search');
        hideLoading();
        showToast(`${filteredResults.length}개의 돌연변이 영상을 찾았습니다.`, 'success');
    }

    searchBtn.addEventListener('click', searchVideos);


    // --- Subscriber Tracking Tab (Firebase Integration - Placeholder) ---
    // User needs to provide Firebase configuration. This will be a manual step for them.
    // For now, I'll put a placeholder for Firebase initialization.
    // In a real scenario, you'd load Firebase config from env variables or a secure place.

    // This section assumes Firebase SDK is included in index.html,
    // and Firebase project configuration is available.
    /*
    import { initializeApp } from "firebase/app";
    import { getFirestore, collection, addDoc, query, orderBy, getDocs } from "firebase/firestore";

    // Your web app's Firebase configuration
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const SUBSCRIBER_COLLECTION = "subscriberData"; // Firestore collection name
    */

    async function collectSubscriberData() {
        if (trackingChannels.length === 0) {
            showToast('추적할 채널을 먼저 추가해주세요.', 'info');
            return;
        }
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return;
        }
        // Check if data was collected today
        const lastCollectionDate = localStorage.getItem('lastSubscriberCollectionDate');
        const today = new Date().toDateString();

        if (lastCollectionDate === today) {
            showToast('오늘은 이미 구독자 수 데이터를 수집했습니다. 내일 다시 시도해주세요.', 'info');
            return;
        }

        showLoading();
        const collectedData = [];
        const selectedChannelIds = Array.from(trackingChannelsSelection.querySelectorAll('input[type="checkbox"]:checked'))
                                     .map(checkbox => checkbox.dataset.channelId);

        for (const channel of trackingChannels) {
            if (selectedChannelIds.includes(channel.id)) {
                try {
                    const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channel.id}&key=${YOUTUBE_API_KEY}`);
                    const data = await response.json();
                    if (data.items && data.items.length > 0) {
                        const currentSubscriberCount = parseInt(data.items[0].statistics.subscriberCount || 0);
                        collectedData.push({
                            channelId: channel.id,
                            channelName: channel.name,
                            subscriberCount: currentSubscriberCount,
                            timestamp: new Date().toISOString()
                        });
                        // Save to Firebase (placeholder - actual implementation requires Firebase setup)
                        /*
                        await addDoc(collection(db, SUBSCRIBER_COLLECTION), {
                            channelId: channel.id,
                            channelName: channel.name,
                            subscriberCount: currentSubscriberCount,
                            timestamp: new Date()
                        });
                        */
                    }
                } catch (error) {
                    console.error(`Error collecting subscriber data for ${channel.name}:`, error);
                    showToast(`${channel.name} 구독자 수 수집 실패.`, 'error');
                }
            }
        }

        // For demonstration, we'll store in localStorage if Firebase is not setup
        let historicalData = JSON.parse(localStorage.getItem('subscriberHistoricalData')) || [];
        collectedData.forEach(newData => {
            historicalData.push(newData);
        });
        localStorage.setItem('subscriberHistoricalData', JSON.stringify(historicalData));
        localStorage.setItem('lastSubscriberCollectionDate', today); // Mark today's collection

        hideLoading();
        showToast('오늘의 구독자 수 데이터 수집이 완료되었습니다.', 'success');
        updateLastCollectionInfo();
        renderSubscriberTrackingChannels();
        renderSubscriberChartAndData();
    }

    function updateLastCollectionInfo() {
        const lastCollectionDate = localStorage.getItem('lastSubscriberCollectionDate');
        if (lastCollectionDate) {
            lastCollectionInfoSpan.textContent = `마지막 수집: ${lastCollectionDate}`;
        } else {
            lastCollectionInfoSpan.textContent = `마지막 수집: 없음`;
        }
    }

    function renderSubscriberTrackingChannels() {
        const container = trackingChannelsSelection;
        container.innerHTML = '';
        if (trackingChannels.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>구독자 수 추적을 위해 채널을 추가하세요.</p></div>';
            return;
        }

        trackingChannels.forEach(channel => {
            const channelOption = document.createElement('label');
            channelOption.classList.add('tracking-channel-option');
            channelOption.innerHTML = `
                <input type="checkbox" class="tracking-channel-checkbox" data-channel-id="${channel.id}" checked>
                <div class="tracking-channel-info">
                    <img src="${channel.thumbnail}" alt="${channel.name}" class="tracking-channel-logo">
                    <div class="tracking-channel-text">
                        <p class="tracking-channel-name">${channel.name}</p>
                        <p class="tracking-channel-subscribers">현재 구독자: ${formatNumber(channel.subscriberCount)}명</p>
                    </div>
                </div>
            `;
            container.appendChild(channelOption);

            channelOption.querySelector('.tracking-channel-checkbox').addEventListener('change', (event) => {
                if (event.target.checked) {
                    channelOption.classList.add('selected');
                } else {
                    channelOption.classList.remove('selected');
                }
                renderSubscriberChartAndData(); // Re-render chart based on selection
            });
            channelOption.classList.add('selected'); // Default to selected
        });
    }

    let subscriberChart = null;

    async function renderSubscriberChartAndData() {
        // Assume historicalData is loaded from localStorage for now, in real Firebase would query
        const historicalData = JSON.parse(localStorage.getItem('subscriberHistoricalData')) || [];
        const selectedChannelIds = Array.from(trackingChannelsSelection.querySelectorAll('input[type="checkbox"]:checked'))
                                     .map(checkbox => checkbox.dataset.channelId);

        const filteredData = historicalData.filter(d => selectedChannelIds.includes(d.channelId));

        // Group data by channel and then by date
        const groupedData = filteredData.reduce((acc, curr) => {
            const date = new Date(curr.timestamp).toLocaleDateString('ko-KR');
            if (!acc[curr.channelId]) {
                acc[curr.channelId] = {
                    name: curr.channelName,
                    data: {}
                };
            }
            acc[curr.channelId].data[date] = curr.subscriberCount; // Only store the latest count for that day
            return acc;
        }, {});

        const labels = [...new Set(filteredData.map(d => new Date(d.timestamp).toLocaleDateString('ko-KR')))].sort();

        const datasets = Object.values(groupedData).map((channelGroup, index) => {
            const data = labels.map(date => channelGroup.data[date] || null);
            const color = `hsl(${index * 60}, 70%, 50%)`; // Generate distinct colors
            return {
                label: channelGroup.name,
                data: data,
                borderColor: color,
                backgroundColor: color + '20', // Light transparency
                fill: false,
                tension: 0.1
            };
        });

        if (subscriberChart) {
            subscriberChart.destroy();
        }

        subscriberChart = new Chart(subscriberChartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '구독자 수 추이',
                        color: '#333'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '날짜',
                            color: '#666'
                        },
                        ticks: {
                            color: '#666'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '구독자 수',
                            color: '#666'
                        },
                        ticks: {
                            beginAtZero: true,
                            callback: function(value) {
                                return formatNumber(value);
                            },
                            color: '#666'
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    }
                }
            }
        });

        // Render detailed data list
        dataListDiv.innerHTML = '';
        if (filteredData.length === 0) {
            dataListDiv.innerHTML = '<div class="empty-state"><p>구독자 수 데이터가 없습니다.</p></div>';
            return;
        }

        // Display latest data for each selected channel
        const latestDataByChannel = {};
        filteredData.forEach(d => {
            if (!latestDataByChannel[d.channelId] || new Date(d.timestamp) > new Date(latestDataByChannel[d.channelId].timestamp)) {
                latestDataByChannel[d.channelId] = d;
            }
        });

        Object.values(latestDataByChannel).forEach(data => {
            const dataItem = document.createElement('div');
            dataItem.classList.add('data-item');
            dataItem.innerHTML = `
                <span class="data-date">${data.channelName} (${new Date(data.timestamp).toLocaleDateString('ko-KR')})</span>
                <span class="data-subscribers">${formatNumber(data.subscriberCount)}명</span>
                <span class="data-growth growth-neutral">N/A</span>
            `;
            dataListDiv.appendChild(dataItem);
        });

    }

    collectSubscriberDataBtn.addEventListener('click', collectSubscriberData);
    chartChannelSelect.addEventListener('change', renderSubscriberChartAndData); // If we add a dropdown to select which channel's data to show in chart

    // Initial render for subscriber tracking channels
    renderChannelList('tracking');
    updateLastCollectionInfo();
    renderSubscriberTrackingChannels();
    renderSubscriberChartAndData(); // Call this to render chart on load


    // --- Thumbnail Test Tab ---

    let testResults = JSON.parse(localStorage.getItem('thumbnailTestResults')) || [];

    function saveTestResults() {
        localStorage.setItem('thumbnailTestResults', JSON.stringify(testResults));
    }

    async function startThumbnailTest() {
        if (!YOUTUBE_API_KEY) {
            showToast('YouTube API 키가 설정되지 않았습니다.', 'error');
            return;
        }

        const testCount = parseInt(testCountSelect.value);
        let currentTestNumber = 0;
        let correctAnswers = 0;

        thumbnailTestArea.innerHTML = '<div class="empty-state"><p>테스트 준비 중...</p></div>';
        showLoading();

        // Clear existing content and display progress
        const testProgressDiv = document.createElement('div');
        testProgressDiv.classList.add('test-progress');
        thumbnailTestArea.innerHTML = '';
        thumbnailTestArea.appendChild(testProgressDiv);

        const progressBarContainer = document.createElement('div');
        progressBarContainer.classList.add('progress-bar-container');
        progressBarContainer.innerHTML = `<div class="progress-bar" id="test-progress-bar" style="width: 0%;"></div>`;
        testProgressDiv.appendChild(progressBarContainer);

        const progressText = document.createElement('span');
        progressText.id = 'test-progress-text';
        progressText.textContent = `0 / ${testCount} (${(0).toFixed(0)}%)`;
        testProgressDiv.appendChild(progressText);

        const testOptionsContainer = document.createElement('div');
        testOptionsContainer.classList.add('thumbnail-options');
        thumbnailTestArea.appendChild(testOptionsContainer);

        const updateProgressBar = (current, total) => {
            const percentage = (current / total) * 100;
            const progressBar = document.getElementById('test-progress-bar');
            const progressText = document.getElementById('test-progress-text');
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
            }
            if (progressText) {
                progressText.textContent = `${current} / ${total} (${percentage.toFixed(0)}%)`;
            }
        };


        for (let i = 0; i < testCount; i++) {
            currentTestNumber++;
            updateProgressBar(currentTestNumber -1, testCount);
            testOptionsContainer.innerHTML = ''; // Clear previous options

            let video1, video2;

            if (testTypeRandomRadio.checked) {
                // Random test: Get random videos
                const randomVideos = await getRandomVideos(2);
                if (randomVideos.length < 2) {
                    showToast('충분한 영상을 찾을 수 없습니다. 다시 시도해주세요.', 'error');
                    hideLoading();
                    return;
                }
                video1 = randomVideos[0];
                video2 = randomVideos[1];
            } else if (testTypeSearchRadio.checked) {
                // Search-based test
                const keyword = searchTestKeywordInput.value.trim();
                if (!keyword) {
                    showToast('검색 키워드를 입력하고 테스트를 시작하세요.', 'error');
                    hideLoading();
                    return;
                }
                const searchResults = await searchVideosForThumbnailTest(keyword, 2);
                if (searchResults.length < 2) {
                    showToast('검색된 영상이 부족합니다. 다른 키워드를 입력하거나 나중에 다시 시도해주세요.', 'error');
                    hideLoading();
                    return;
                }
                video1 = searchResults[0];
                video2 = searchResults[1];
            } else {
                showToast('테스트 유형을 선택해주세요.', 'error');
                hideLoading();
                return;
            }

            if (!video1 || !video2) {
                showToast('영상을 가져오는 데 실패했습니다.', 'error');
                hideLoading();
                return;
            }

            const selectionPromise = new Promise(resolve => {
                const renderOption = (video, index) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.classList.add('thumbnail-option');
                    optionDiv.innerHTML = `
                        <img src="${video.thumbnail}" alt="${video.title}" class="thumbnail-option-img">
                        <p class="thumbnail-option-title">${video.title}</p>
                        <p class="thumbnail-option-views">시청수: ??</p>
                    `;
                    optionDiv.addEventListener('click', () => {
                        resolve({ selectedVideo: video, otherVideo: (index === 1 ? video2 : video1) });
                    });
                    return optionDiv;
                };

                testOptionsContainer.appendChild(renderOption(video1, 1));
                testOptionsContainer.appendChild(renderOption(video2, 2));
            });

            hideLoading(); // Hide loading while user is selecting
            const { selectedVideo, otherVideo } = await selectionPromise;
            showLoading(); // Show loading again for next fetch

            // Reveal actual views and record result
            const allOptions = testOptionsContainer.querySelectorAll('.thumbnail-option');
            allOptions.forEach(option => {
                const videoId = option.querySelector('img').alt === selectedVideo.title ? selectedVideo.videoId : otherVideo.videoId;
                const video = (option.querySelector('img').alt === selectedVideo.title ? selectedVideo : otherVideo);
                option.querySelector('.thumbnail-option-views').textContent = `시청수: ${formatNumber(video.viewCount)}`;
            });

            const isCorrect = (selectedVideo.viewCount > otherVideo.viewCount);
            if (isCorrect) {
                correctAnswers++;
            }
            showToast(isCorrect ? '정답입니다!' : '오답입니다.', isCorrect ? 'success' : 'error');

            await new Promise(res => setTimeout(res, 1000)); // Pause for a moment
        }

        hideLoading();
        const score = (correctAnswers / testCount) * 100;
        const result = {
            date: new Date().toISOString(),
            testCount: testCount,
            correctAnswers: correctAnswers,
            score: score.toFixed(2)
        };
        testResults.push(result);
        saveTestResults();
        renderTestHistory();
        showToast(`테스트 완료! ${correctAnswers} / ${testCount} 정답 (${score.toFixed(2)}%)`, 'info');
        updateProgressBar(testCount, testCount);
    }

    async function getRandomVideos(count) {
        if (!YOUTUBE_API_KEY) return [];
        // This is a simplified random search. A better approach might be to
        // fetch popular videos, or videos from a wide range of categories/channels.
        // For now, a generic search term.
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=random+video&type=video&maxResults=${count * 2}&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();
        const videoIds = data.items.map(item => item.id.videoId).filter(Boolean);
        return await getVideoDetails(videoIds.slice(0, count)); // Get details for twice as many to ensure unique videos
    }

    async function searchVideosForThumbnailTest(keyword, count) {
        if (!YOUTUBE_API_KEY) return [];
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=${count * 2}&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();
        const videoIds = data.items.map(item => item.id.videoId).filter(Boolean);
        return await getVideoDetails(videoIds.slice(0, count));
    }

    function renderTestHistory() {
        testRecordList.innerHTML = '';
        if (testResults.length === 0) {
            testRecordList.innerHTML = '<div class="empty-state"><p>테스트 이력이 없습니다.</p></div>';
            return;
        }

        // Sort by date descending
        const sortedResults = [...testResults].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedResults.forEach(record => {
            const recordItem = document.createElement('div');
            recordItem.classList.add('test-record-item');
            recordItem.innerHTML = `
                <div class="record-info">
                    <span class="record-date">${new Date(record.date).toLocaleDateString('ko-KR')}</span>
                    <span class="record-keyword">테스트 ${record.testCount}회</span>
                </div>
                <div class="record-score">
                    <span class="record-score-number">${record.correctAnswers} / ${record.testCount}</span>
                    <span class="record-percentage">(${record.score}%)</span>
                </div>
            `;
            testRecordList.appendChild(recordItem);
        });
    }


    startTestBtn.addEventListener('click', startThumbnailTest);
    testTypeRandomRadio.addEventListener('change', () => {
        searchTestKeywordInput.style.display = 'none';
        searchTestKeywordInput.value = ''; // Clear keyword when switching to random
    });
    testTypeSearchRadio.addEventListener('change', () => {
        searchTestKeywordInput.style.display = 'block';
    });

    // Initial render calls
    loadApiKey(); // Load API key on startup
    renderChannelList('monitoring');
    renderChannelList('tracking');
    renderSubscriberTrackingChannels();
    renderSubscriberChartAndData();
    renderTestHistory();
});
