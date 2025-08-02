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
    openModal,
    closeModal
} from './main.js';

// 이 모듈에서만 사용되는 DOM 요소들
const addMonitoringChannelBtn = document.getElementById('add-monitoring-channel-btn');
const monitoringChannelGrid = document.getElementById('monitoring-channel-grid');
const videoList = document.getElementById('video-list');
const channelSelectionModal = document.getElementById('channel-selection-modal');
const channelSelectionList = document.getElementById('channel-selection-list');
const monitorBtn = document.getElementById('monitor-btn');

// 전역 변수
let selectedChannelsToMonitor = new Set();
let monitoringIntervalId = null;

// =====================================================================================================
// 이벤트 리스너 설정
// =====================================================================================================
function setupEventListeners() {
    addMonitoringChannelBtn.addEventListener('click', () => {
        // 이 버튼 클릭 시 main.js에서 모달을 엽니다.
    });

    // 모니터링 채널 선택 모달 열기
    monitorBtn.addEventListener('click', () => {
        if (Object.keys(channels).length === 0) {
            alert('먼저 채널을 추가해주세요.');
            return;
        }
        renderChannelSelectionList();
        openModal(channelSelectionModal);
    });

    // 모니터링 시작 버튼 클릭
    document.getElementById('start-monitoring-btn').addEventListener('click', () => {
        closeModal(channelSelectionModal);
        startMonitoring();
    });

    // 모니터링 중지 버튼 클릭
    document.getElementById('stop-monitoring-btn').addEventListener('click', stopMonitoring);

    // 채널 삭제 이벤트 위임
    monitoringChannelGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-channel-btn')) {
            const channelId = e.target.dataset.channelId;
            removeChannel(channelId);
        }
    });

    // 채널 선택 모달의 체크박스 변경 이벤트
    channelSelectionList.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const channelId = e.target.value;
            if (e.target.checked) {
                selectedChannelsToMonitor.add(channelId);
            } else {
                selectedChannelsToMonitor.delete(channelId);
            }
        }
    });
}

// =====================================================================================================
// 채널 관리 및 렌더링
// =====================================================================================================
// 채널 ID로 채널 정보를 가져와서 로컬 스토리지에 저장 (main.js에서 호출)
export async function addChannel(input, type) {
    showLoading('채널 정보를 가져오는 중...');
    let params = { part: 'snippet,statistics' };

    if (input.startsWith('UC')) {
        params.id = input;
    } else if (input.startsWith('@')) {
        params.forHandle = input.slice(1);
    } else {
        params.forHandle = input;
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
    hideLoading();
}

// 채널 삭제
function removeChannel(channelId) {
    if (confirm('정말로 이 채널을 삭제하시겠습니까?')) {
        delete channels[channelId];
        saveChannelsToLocalStorage();
        renderMonitoringChannels();
        stopMonitoring();
    }
}

// 모니터링 채널 목록을 화면에 렌더링
export function renderMonitoringChannels() {
    monitoringChannelGrid.innerHTML = '';
    const monitoringChannels = Object.values(channels).filter(c => c.type === 'monitoring');

    if (monitoringChannels.length === 0) {
        monitoringChannelGrid.innerHTML = `<div class="empty-state">
            <p>모니터링할 채널을 추가해주세요.</p>
            <button id="add-monitoring-channel-btn" class="btn btn-primary">채널 추가</button>
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

// 채널 선택 모달에 채널 목록 렌더링
function renderChannelSelectionList() {
    channelSelectionList.innerHTML = '';
    const monitoringChannels = Object.values(channels).filter(c => c.type === 'monitoring');

    if (monitoringChannels.length === 0) {
        channelSelectionList.innerHTML = '<p>추가된 채널이 없습니다.</p>';
        return;
    }

    monitoringChannels.forEach(channel => {
        const isChecked = selectedChannelsToMonitor.has(channel.id);
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <input type="checkbox" id="select-${channel.id}" value="${channel.id}" ${isChecked ? 'checked' : ''}>
            <label for="select-${channel.id}">${channel.name}</label>
        `;
        channelSelectionList.appendChild(listItem);
    });
}

// =====================================================================================================
// 모니터링 로직
// =====================================================================================================
async function startMonitoring() {
    if (selectedChannelsToMonitor.size === 0) {
        alert('모니터링할 채널을 하나 이상 선택해주세요.');
        return;
    }
    
    stopMonitoring();
    showLoading('채널 모니터링 시작...');
    await fetchVideos();
    hideLoading();

    monitoringIntervalId = setInterval(fetchVideos, 5 * 60 * 1000); // 5분마다 업데이트
}

function stopMonitoring() {
    if (monitoringIntervalId) {
        clearInterval(monitoringIntervalId);
        monitoringIntervalId = null;
        videoList.innerHTML = '<p class="empty-state">모니터링을 시작하면 최신 영상이 여기에 표시됩니다.</p>';
    }
}

async function fetchVideos() {
    const videoIds = [];
    const channelIds = Array.from(selectedChannelsToMonitor).join(',');

    showLoading('새 영상을 확인하는 중...');

    const searchParams = {
        channelId: channelIds,
        part: 'snippet',
        order: 'date',
        maxResults: 50,
        type: 'video'
    };

    const searchData = await fetchYouTubeApi('search', searchParams);
    
    if (!searchData || searchData.items.length === 0) {
        hideLoading();
        videoList.innerHTML = '<p class="empty-state">최신 영상을 찾을 수 없습니다.</p>';
        return;
    }

    searchData.items.forEach(item => {
        videoIds.push(item.id.videoId);
    });

    const videoData = await fetchYouTubeApi('videos', {
        id: videoIds.join(','),
        part: 'snippet,statistics'
    });

    if (!videoData || videoData.items.length === 0) {
        hideLoading();
        videoList.innerHTML = '<p class="empty-state">영상 정보를 가져오는 데 실패했습니다.</p>';
        return;
    }

    renderVideos(videoData.items);
    hideLoading();
}

function renderVideos(videos) {
    videoList.innerHTML = '';
    videos.sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt));

    videos.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.innerHTML = `
            <img src="${video.snippet.thumbnails.medium.url}" alt="${video.snippet.title}">
            <div class="video-info">
                <h4><a href="https://www.youtube.com/watch?v=${video.id}" target="_blank">${video.snippet.title}</a></h4>
                <p>조회수: ${video.statistics.viewCount}회</p>
                <p>채널: ${video.snippet.channelTitle}</p>
                <p>업로드: ${new Date(video.snippet.publishedAt).toLocaleDateString()}</p>
            </div>
        `;
        videoList.appendChild(videoCard);
    });
}

// =====================================================================================================
// 초기화
// =====================================================================================================
document.addEventListener('DOMContentLoaded', () => {
    renderMonitoringChannels();
    setupEventListeners();
});
