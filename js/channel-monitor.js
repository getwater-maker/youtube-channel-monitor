// =====================================================================================================
// channel-monitor.js: '채널 모니터링' 탭의 모든 로직을 담당하는 모듈
// 이 파일은 채널 추가, 목록 렌더링, 영상 목록 업데이트 등 기능을 담당합니다.
// =====================================================================================================

import {
    showLoading,
    hideLoading,
    fetchYouTubeApi,
    channels,
    saveChannelsToLocalStorage,
    openModal,        // ✅ main.js에 있는 함수만 import
    closeModal,
    channelModal      // ✅ main.js에서 export된 DOM 요소
} from './main.js';

// 이 모듈에서만 사용되는 DOM 요소들
const addMonitoringChannelBtn = document.getElementById('add-monitoring-channel-btn');
const addTrackingChannelBtn = document.getElementById('add-tracking-channel-btn');
const monitoringChannelGrid = document.getElementById('monitoring-channel-grid');
const trackingRecords = document.getElementById('tracking-records');
const latestVideosContainer = document.getElementById('latest-videos-container');
const channelSelectionModal = document.getElementById('channel-selection-modal');
const channelSelectionList = document.getElementById('channel-selection-list');
const startMonitoringBtn = document.getElementById('start-monitoring-btn');
const monitoringChannelCountSpan = document.getElementById('monitoring-channel-count');
const hotVideoRatioSelect = document.getElementById('hot-video-ratio');
const trackingSortOrderSelect = document.getElementById('tracking-sort-order');
const showAllChannelsCheckbox = document.getElementById('show-all-channels');
const backupTrackingDataBtn = document.getElementById('backup-tracking-data-btn');
const restoreTrackingDataBtn = document.getElementById('restore-tracking-data-btn');
const restoreTrackingDataInput = document.getElementById('restore-tracking-data-input');
const monitoringCollapseBtn = document.getElementById('monitoring-collapse-btn');

// 전역 변수
let selectedChannelsToMonitor = new Set();
let monitoringIntervalId = null;
let allTrackingData = {}; // 채널별 영상 데이터를 저장할 객체
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5분마다 업데이트

// =====================================================================================================
// 이벤트 리스너 설정
// =====================================================================================================
export function setupEventListeners() {
    startMonitoringBtn.addEventListener('click', () => {
        // 모니터링 시작/중지 버튼 토글
        if (monitoringIntervalId) {
            stopMonitoring();
            startMonitoringBtn.textContent = '📈 채널 추적 시작';
            startMonitoringBtn.classList.add('btn-primary');
            startMonitoringBtn.classList.remove('btn-danger');
        } else {
            if (Object.values(channels).filter(c => c.type === 'monitoring').length === 0) {
                alert('먼저 모니터링할 채널을 추가해주세요.');
                return;
            }
            startMonitoringBtn.textContent = '⏸️ 채널 추적 중지';
            startMonitoringBtn.classList.remove('btn-primary');
            startMonitoringBtn.classList.add('btn-danger');
            startMonitoring();
        }
    });

    monitoringChannelGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-channel-btn')) {
            const channelId = e.target.dataset.channelId;
            removeChannel(channelId);
        }
    });

    monitoringCollapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleChannelManagementSection('monitoring');
    });

    backupTrackingDataBtn.addEventListener('click', backupData);
    restoreTrackingDataBtn.addEventListener('click', () => restoreTrackingDataInput.click());
    restoreTrackingDataInput.addEventListener('change', restoreData);

    trackingSortOrderSelect.addEventListener('change', renderTrackingRecords);
    hotVideoRatioSelect.addEventListener('change', renderTrackingRecords);
    showAllChannelsCheckbox.addEventListener('change', renderTrackingRecords);

    // '채널 모니터링' 탭의 '채널 추가' 버튼
    if (addMonitoringChannelBtn) {
        addMonitoringChannelBtn.addEventListener('click', () => {
            openModal(channelModal); // ✅ openChannelModal → openModal(channelModal)
        });
    }

    // '구독자 수 추적' 탭의 '채널 추가' 버튼
    if (addTrackingChannelBtn) {
        addTrackingChannelBtn.addEventListener('click', () => {
            openModal(channelModal); // ✅ openChannelModal → openModal(channelModal)
        });
    }
}

// =====================================================================================================
// 채널 관리 및 렌더링
// =====================================================================================================
export async function addChannel(input, type) {
    showLoading('채널 정보를 가져오는 중...');
    let params = { part: 'snippet,statistics' };

    if (input.startsWith('UC')) {
        params.id = input;
    } else if (input.startsWith('@')) {
        params.forHandle = input.slice(1);
    } else {
        // 채널명으로 검색
        const searchData = await fetchYouTubeApi('search', { q: input, type: 'channel', maxResults: 1 });
        if (!searchData || !searchData.items || searchData.items.length === 0) {
            hideLoading();
            alert('채널을 찾을 수 없습니다.');
            return;
        }
        params.id = searchData.items[0].id.channelId;
    }
    
    const data = await fetchYouTubeApi('channels', params);
    
    if (!data || !data.items || data.items.length === 0) {
        hideLoading();
        alert('채널을 찾을 수 없습니다.');
        return;
    }

    const channel = data.items[0];
    const channelId = channel.id;

    if (channels[channelId]) {
        hideLoading();
        alert('이미 추가된 채널입니다.');
        return;
    }

    channels[channelId] = {
        id: channelId,
        name: channel.snippet.title,
        thumbnail: channel.snippet.thumbnails.default.url,
        type: type,
    };
    
    saveChannelsToLocalStorage();
    renderMonitoringChannels();
    renderLatestVideos();
    hideLoading();
}

function removeChannel(channelId) {
    if (confirm('정말로 이 채널을 삭제하시겠습니까?')) {
        delete channels[channelId];
        saveChannelsToLocalStorage();
        renderMonitoringChannels();
        renderLatestVideos();
        stopMonitoring();
    }
}

export function renderMonitoringChannels() {
    monitoringChannelGrid.innerHTML = '';
    const monitoringChannels = Object.values(channels).filter(c => c.type === 'monitoring');

    if (monitoringChannelCountSpan) {
        monitoringChannelCountSpan.textContent = monitoringChannels.length;
    }

    if (monitoringChannels.length === 0) {
        monitoringChannelGrid.innerHTML = `<div class="empty-state">
            <p>모니터링할 채널을 추가해주세요.</p>
        </div>`;
        return;
    }

    monitoringChannels.forEach(channel => {
        const channelCard = document.createElement('div');
        channelCard.className = 'channel-card';
        channelCard.innerHTML = `
            <img src="${channel.thumbnail}" alt="${channel.name}">
            <div class="channel-info">
                <h4>${channel.name}</h4>
                <button class="btn btn-danger btn-small remove-channel-btn" data-channel-id="${channel.id}">삭제</button>
            </div>
        `;
        monitoringChannelGrid.appendChild(channelCard);
    });
}

function toggleChannelManagementSection(type) {
    const section = document.querySelector(`.${type}-channel-management`);
    const grid = document.getElementById(`${type}-channel-grid`);
    const collapseBtn = document.getElementById(`${type}-collapse-btn`);
    if (grid && collapseBtn) {
        if (grid.style.display === 'none') {
            grid.style.display = 'grid';
            collapseBtn.textContent = '▲';
        } else {
            grid.style.display = 'none';
            collapseBtn.textContent = '▼';
        }
    }
}

// =====================================================================================================
// 모니터링 로직
// =====================================================================================================
async function startMonitoring() {
    stopMonitoring();
    showLoading('채널 모니터링 시작...');
    selectedChannelsToMonitor = new Set(Object.values(channels).filter(c => c.type === 'monitoring').map(c => c.id));
    await fetchVideos();
    hideLoading();

    monitoringIntervalId = setInterval(fetchVideos, UPDATE_INTERVAL);
}

function stopMonitoring() {
    if (monitoringIntervalId) {
        clearInterval(monitoringIntervalId);
        monitoringIntervalId = null;
        trackingRecords.innerHTML = `<div class="empty-state"><p>채널 추적을 시작하면 최신 영상이 여기에 표시됩니다.</p></div>`;
    }
}

async function fetchVideos() {
    if (selectedChannelsToMonitor.size === 0) {
        stopMonitoring();
        return;
    }
    
    showLoading('새 영상을 확인하는 중...');

    const channelIds = Array.from(selectedChannelsToMonitor);
    const channelDataPromises = channelIds.map(channelId => {
        return fetchYouTubeApi('search', {
            channelId: channelId,
            part: 'snippet',
            order: 'date',
            maxResults: 50,
            type: 'video'
        });
    });

    const searchResults = await Promise.all(channelDataPromises);
    const videoIds = searchResults.flatMap(result => result && result.items ? result.items.map(item => item.id.videoId) : []);

    if (videoIds.length === 0) {
        hideLoading();
        trackingRecords.innerHTML = `<div class="empty-state"><p>최신 영상을 찾을 수 없습니다.</p></div>`;
        return;
    }

    const videoData = await fetchYouTubeApi('videos', {
        id: videoIds.join(','),
        part: 'snippet,statistics'
    });

    if (!videoData || videoData.items.length === 0) {
        hideLoading();
        trackingRecords.innerHTML = `<div class="empty-state"><p>영상 정보를 가져오는 데 실패했습니다.</p></div>`;
        return;
    }

    const allVideos = videoData.items;

    // 영상별로 데이터를 통합
    allVideos.forEach(video => {
        if (!allTrackingData[video.id]) {
            allTrackingData[video.id] = {
                title: video.snippet.title,
                channelId: video.snippet.channelId,
                channelTitle: video.snippet.channelTitle,
                thumbnail: video.snippet.thumbnails.medium.url,
                publishedAt: video.snippet.publishedAt,
                statistics: {
                    viewCount: video.statistics.viewCount,
                    likeCount: video.statistics.likeCount,
                    commentCount: video.statistics.commentCount,
                },
                channelStats: null // 채널 구독자 수는 별도로 가져와야 함
            };
        }
    });

    // 채널 통계 가져오기
    const uniqueChannelIds = [...new Set(allVideos.map(v => v.snippet.channelId))];
    const channelStatsPromises = uniqueChannelIds.map(id => 
        fetchYouTubeApi('channels', { id: id, part: 'statistics' })
    );
    const channelStatsResults = await Promise.all(channelStatsPromises);

    const channelStatsMap = {};
    channelStatsResults.forEach(result => {
        if (result && result.items && result.items.length > 0) {
            channelStatsMap[result.items[0].id] = result.items[0].statistics;
        }
    });

    // 모든 영상 데이터에 채널 통계 병합
    Object.keys(allTrackingData).forEach(videoId => {
        const video = allTrackingData[videoId];
        const channelStats = channelStatsMap[video.channelId];
        if (channelStats) {
            video.channelStats = channelStats;
            // 돌연변이 비율 계산 (조회수 / 구독자 수)
            const viewCount = parseInt(video.statistics.viewCount, 10) || 0;
            const subscriberCount = parseInt(channelStats.subscriberCount, 10) || 1;
            video.ratio = (viewCount / subscriberCount) * 100;
        }
    });

    renderTrackingRecords();
    hideLoading();
}

function renderTrackingRecords() {
    trackingRecords.innerHTML = '';
    const videoData = Object.values(allTrackingData);

    if (videoData.length === 0) {
        trackingRecords.innerHTML = `<div class="empty-state"><p>추적된 영상이 없습니다.</p></div>`;
        return;
    }

    const showAll = showAllChannelsCheckbox.checked;
    const hotVideoRatio = parseFloat(hotVideoRatioSelect.value);

    // 필터링
    const filteredVideos = videoData.filter(video => {
        if (showAll) {
            return true;
        }
        return video.ratio && video.ratio >= hotVideoRatio;
    });

    // 정렬
    const sortBy = trackingSortOrderSelect.value;
    filteredVideos.sort((a, b) => {
        if (sortBy === 'ratio') {
            return (b.ratio || 0) - (a.ratio || 0);
        } else if (sortBy === 'publishedAt') {
            return new Date(b.publishedAt) - new Date(a.publishedAt);
        } else if (sortBy === 'viewCount') {
            return (parseInt(b.statistics.viewCount) || 0) - (parseInt(a.statistics.viewCount) || 0);
        } else if (sortBy === 'subscriberCount') {
            return (parseInt(b.channelStats.subscriberCount) || 0) - (parseInt(a.channelStats.subscriberCount) || 0);
        }
        return 0;
    });

    filteredVideos.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card tracking-card';
        videoCard.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}">
            <div class="video-info">
                <h4><a href="http://youtube.com/watch?v=${video.id}" target="_blank">${video.title}</a></h4>
                <p><strong>채널:</strong> ${video.channelTitle}</p>
                <p><strong>조회수:</strong> ${formatNumber(video.statistics.viewCount)}회</p>
                <p><strong>구독자:</strong> ${video.channelStats ? formatNumber(video.channelStats.subscriberCount) : '정보 없음'}</p>
                ${video.ratio ? `<p><strong>돌연변이 비율:</strong> ${video.ratio.toFixed(2)}%</p>` : ''}
                <p><strong>업로드:</strong> ${new Date(video.publishedAt).toLocaleDateString()}</p>
            </div>
        `;
        trackingRecords.appendChild(videoCard);
    });
}

function formatNumber(num) {
    if (num === null || num === undefined) {
        return '0';
    }
    const n = parseInt(num, 10);
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '억';
    if (n >= 10000) return (n / 10000).toFixed(1) + '만';
    return n.toLocaleString();
}

export function renderLatestVideos() {
    latestVideosContainer.innerHTML = '';
    const monitoringChannels = Object.values(channels).filter(c => c.type === 'monitoring');

    if (monitoringChannels.length === 0) {
        latestVideosContainer.innerHTML = `<div class="empty-state">
            <p>등록된 채널이 없습니다.</p>
        </div>`;
        return;
    }

    monitoringChannels.forEach(channel => {
        const channelSection = document.createElement('div');
        channelSection.className = 'channel-latest-videos';
        channelSection.innerHTML = `
            <h3>${channel.name}의 최신 영상</h3>
            <div id="latest-videos-${channel.id}" class="latest-video-list">
                <p>로딩 중...</p>
            </div>
        `;
        latestVideosContainer.appendChild(channelSection);
        fetchAndRenderLatestVideos(channel.id);
    });
}

async function fetchAndRenderLatestVideos(channelId) {
    const listContainer = document.getElementById(`latest-videos-${channelId}`);
    listContainer.innerHTML = '<p>로딩 중...</p>';

    const searchData = await fetchYouTubeApi('search', {
        channelId: channelId,
        part: 'snippet',
        order: 'date',
        maxResults: 5,
        type: 'video'
    });

    if (!searchData || searchData.items.length === 0) {
        listContainer.innerHTML = '<p>최신 영상을 찾을 수 없습니다.</p>';
        return;
    }

    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
    const videoData = await fetchYouTubeApi('videos', {
        id: videoIds,
        part: 'snippet,statistics'
    });

    listContainer.innerHTML = '';
    if (!videoData || videoData.items.length === 0) {
        listContainer.innerHTML = '<p>영상 정보를 가져오는 데 실패했습니다.</p>';
        return;
    }

    videoData.items.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.innerHTML = `
            <img src="${video.snippet.thumbnails.medium.url}" alt="${video.snippet.title}">
            <div class="video-info">
                <h4><a href="http://youtube.com/watch?v=${video.id}" target="_blank">${video.snippet.title}</a></h4>
                <p><strong>조회수:</strong> ${formatNumber(video.statistics.viewCount)}회</p>
                <p><strong>업로드:</strong> ${new Date(video.snippet.publishedAt).toLocaleDateString()}</p>
            </div>
        `;
        listContainer.appendChild(videoCard);
    });
}

function backupData() {
    const dataStr = JSON.stringify(allTrackingData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtube_tracking_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('데이터가 성공적으로 백업되었습니다.');
}

function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const restoredData = JSON.parse(e.target.result);
            allTrackingData = restoredData;
            renderTrackingRecords();
            alert('데이터가 성공적으로 복원되었습니다.');
        } catch (error) {
            alert('파일 형식이 올바르지 않습니다. JSON 파일을 선택해주세요.');
        }
    };
    reader.readAsText(file);
}


// =====================================================================================================
// 초기화
// =====================================================================================================
document.addEventListener('DOMContentLoaded', () => {
    renderMonitoringChannels();
    renderLatestVideos();
    setupEventListeners();
});
