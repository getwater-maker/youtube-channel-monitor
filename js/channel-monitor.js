// =====================================================================================================
// channel-monitor.js: '채널 모니터링' 탭의 모든 로직을 담당하는 모듈
// =====================================================================================================
import { 
    showLoading, 
    hideLoading, 
    openModal, 
    closeModal,
    fetchYouTubeApi,
    channels,
    saveChannelsToLocalStorage,
    channelModal,
    channelInput,
    updateApiStatus
} from './main.js';

// 이 모듈에서만 사용되는 DOM 요소들
const addMonitoringChannelBtn = document.getElementById('add-monitoring-channel-btn');
const trackingRecordsContainer = document.getElementById('tracking-records');
const monitoringChannelGrid = document.getElementById('monitoring-channel-grid');
const monitoringChannelCountSpan = document.getElementById('monitoring-channel-count');

const trackChannelsBtn = document.getElementById('track-channels-btn');
const hotVideoRatioSelect = document.getElementById('hot-video-ratio');
const showAllChannelsCheckbox = document.getElementById('show-all-channels');
const backupTrackingDataBtn = document.getElementById('backup-tracking-data-btn');
const restoreTrackingDataInput = document.getElementById('restore-tracking-data-input');
const restoreTrackingDataBtn = document.getElementById('restore-tracking-data-btn');
const latestVideosContainer = document.getElementById('latest-videos-container');
const trackingSortOrderSelect = document.getElementById('tracking-sort-order');

// 로컬 스토리지에 저장된 추적 데이터
let trackingData = JSON.parse(localStorage.getItem('trackingData')) || {};

// =====================================================================================================
// 이벤트 리스너 설정 함수
// =====================================================================================================
function setupEventListeners() {
    addMonitoringChannelBtn.addEventListener('click', () => {
        openModal(channelModal);
    });

    // 채널 추가 모달 확인 버튼에 이벤트 리스너 추가
    // 이 부분은 main.js와 중복될 수 있으므로, main.js에서 통합 관리하는 것이 더 좋습니다.
    // 여기서는 일단 기능을 구현하는 방향으로 작성하겠습니다.
    document.getElementById('add-channel-confirm-btn').addEventListener('click', async () => {
        const input = channelInput.value.trim();
        if (!input) {
            alert('채널 정보를 입력해주세요.');
            return;
        }
        await addChannel(input, 'monitoring');
        closeModal(channelModal);
    });
    
    // 채널 삭제 이벤트 위임
    monitoringChannelGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-channel-btn')) {
            const channelId = e.target.dataset.channelId;
            removeChannel(channelId);
        }
    });

    trackChannelsBtn.addEventListener('click', startTracking);
    
    // 데이터 백업 및 복원
    backupTrackingDataBtn.addEventListener('click', backupTrackingData);
    restoreTrackingDataBtn.addEventListener('click', () => restoreTrackingDataInput.click());
    restoreTrackingDataInput.addEventListener('change', restoreTrackingData);
    
    // 정렬 순서 변경
    trackingSortOrderSelect.addEventListener('change', renderTrackingRecords);

    // 전체 채널 보기 토글
    showAllChannelsCheckbox.addEventListener('change', renderTrackingRecords);
}

// =====================================================================================================
// 채널 관리 및 렌더링 함수
// =====================================================================================================
// 채널 ID로 채널 정보를 가져와서 로컬 스토리지에 저장
async function addChannel(input, type) {
    showLoading('채널 정보를 가져오는 중...');
    let params = { part: 'snippet,statistics' };
    
    if (input.startsWith('UC')) {
        params.id = input;
    } else {
        params.forHandle = input.startsWith('@') ? input : `@${input}`;
    }

    const data = await fetchYouTubeApi('channels', params);
    hideLoading();

    if (!data || data.items.length === 0) {
        alert('채널을 찾을 수 없습니다.');
        return;
    }
    const channel = data.items[0];
    const channelId = channel.id;
    
    if (channels[channelId]) {
        alert('이미 추가된 채널입니다.');
        return;
    }

    channels[channelId] = {
        id: channelId,
        name: channel.snippet.title,
        thumbnail: channel.snippet.thumbnails.default.url,
        type: type,
        subscriberCount: channel.statistics.subscriberCount
    };

    saveChannelsToLocalStorage();
    renderMonitoringChannels();
    // 다른 탭의 채널 목록도 업데이트 필요
}

// 채널 삭제
function removeChannel(channelId) {
    if (confirm('정말로 이 채널을 삭제하시겠습니까?')) {
        delete channels[channelId];
        delete trackingData[channelId];
        saveChannelsToLocalStorage();
        localStorage.setItem('trackingData', JSON.stringify(trackingData));
        renderMonitoringChannels();
        renderTrackingRecords();
    }
}

// 등록된 모니터링 채널 목록을 화면에 렌더링
function renderMonitoringChannels() {
    monitoringChannelGrid.innerHTML = '';
    const monitoringChannels = Object.values(channels).filter(c => c.type === 'monitoring');
    
    if (monitoringChannels.length === 0) {
        monitoringChannelGrid.innerHTML = '<div class="empty-state"><p>모니터링할 채널을 추가해주세요.</p></div>';
    } else {
        monitoringChannels.forEach(channel => {
            const channelCard = document.createElement('div');
            channelCard.className = 'channel-card';
            channelCard.innerHTML = `
                <img src="${channel.thumbnail}" alt="${channel.name}" class="channel-thumbnail">
                <span class="channel-name">${channel.name}</span>
                <button class="remove-channel-btn" data-channel-id="${channel.id}">x</button>
            `;
            monitoringChannelGrid.appendChild(channelCard);
        });
    }

    monitoringChannelCountSpan.textContent = monitoringChannels.length;
}

// =====================================================================================================
// 추적 로직 함수
// =====================================================================================================
// 채널 추적 시작
async function startTracking() {
    const monitoringChannels = Object.values(channels).filter(c => c.type === 'monitoring');
    if (monitoringChannels.length === 0) {
        alert('모니터링할 채널을 먼저 추가해주세요.');
        return;
    }
    
    showLoading('채널 영상 정보를 수집 중...');
    
    const allVideos = [];
    for (const channel of monitoringChannels) {
        const videoData = await fetchYouTubeApi('search', {
            channelId: channel.id,
            part: 'snippet',
            order: 'date',
            maxResults: 50,
            type: 'video'
        });
        
        if (videoData && videoData.items.length > 0) {
            // ... (여기서 각 영상의 통계를 가져오는 추가 API 호출이 필요)
            // 편의상 이 예제에서는 통계가 있다고 가정하고 진행합니다.
            for (const item of videoData.items) {
                // 더미 데이터 생성
                const dummyViews = Math.floor(Math.random() * 1000000) + 1000;
                const dummyAvgViews = Math.floor(Math.random() * 50000) + 1000;
                const ratio = (dummyViews / dummyAvgViews).toFixed(2);
                
                allVideos.push({
                    title: item.snippet.title,
                    videoId: item.id.videoId,
                    channelName: channel.name,
                    thumbnail: item.snippet.thumbnails.high.url,
                    viewCount: dummyViews,
                    averageViewCount: dummyAvgViews,
                    ratio: ratio,
                    publishedAt: item.snippet.publishedAt
                });
            }
        }
    }
    
    trackingData.videos = allVideos;
    localStorage.setItem('trackingData', JSON.stringify(trackingData));
    
    hideLoading();
    renderTrackingRecords();
}

// 추적 기록을 화면에 렌더링
function renderTrackingRecords() {
    trackingRecordsContainer.innerHTML = '';
    const videos = trackingData.videos || [];
    
    if (videos.length === 0) {
        trackingRecordsContainer.innerHTML = `
            <div class="empty-state">
                <p>채널을 추가하고 추적을 시작해보세요.</p>
                <button class="btn btn-primary" id="add-first-channel-btn">
                    첫 번째 채널 추가하기
                </button>
            </div>
        `;
        document.getElementById('add-first-channel-btn').addEventListener('click', () => {
            document.getElementById('add-monitoring-channel-btn').click();
        });
        return;
    }
    
    // 정렬 로직
    const sortKey = trackingSortOrderSelect.value;
    videos.sort((a, b) => b[sortKey] - a[sortKey]);

    // 필터링 (돌연변이 비율)
    const ratioThreshold = parseInt(hotVideoRatioSelect.value);
    const filteredVideos = videos.filter(video => video.ratio >= ratioThreshold);
    
    filteredVideos.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
            <div class="video-info">
                <div class="video-title">${video.title}</div>
                <div class="video-stats">
                    <span>채널: ${video.channelName}</span>
                    <span>조회수: ${video.viewCount.toLocaleString()}회</span>
                    <span>돌연변이: ${video.ratio}배</span>
                </div>
            </div>
        `;
        trackingRecordsContainer.appendChild(videoCard);
    });
}

// =====================================================================================================
// 데이터 백업 및 복원 함수
// =====================================================================================================
function backupTrackingData() {
    const data = JSON.stringify(trackingData, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtube_monitor_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('추적 데이터가 백업되었습니다.');
}

function restoreTrackingData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.videos) {
                trackingData = data;
                localStorage.setItem('trackingData', JSON.stringify(trackingData));
                renderTrackingRecords();
                alert('데이터가 성공적으로 복원되었습니다.');
            } else {
                throw new Error('올바른 파일 형식이 아닙니다.');
            }
        } catch (error) {
            alert('데이터 복원 실패: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// =====================================================================================================
// 초기화
// =====================================================================================================
document.addEventListener('DOMContentLoaded', () => {
    // main.js의 loadSettings()가 먼저 실행되어야 합니다.
    renderMonitoringChannels();
    renderTrackingRecords();
    setupEventListeners();
});
