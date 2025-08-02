// =====================================================================================================
// subscriber-tracking.js: '구독자 수 추적' 탭의 모든 로직을 담당하는 모듈
// =====================================================================================================
import {
    showLoading,
    hideLoading,
    fetchYouTubeApi,
    channels,
    saveChannelsToLocalStorage,
    openModal,
    closeModal,
    channelModal,
    channelInput,
    updateApiStatus
} from './main.js';

// 이 모듈에서만 사용되는 DOM 요소들
const addTrackingChannelBtn = document.getElementById('add-tracking-channel-btn');
const trackingChannelGrid = document.getElementById('tracking-channel-grid');
const trackingChannelCountSpan = document.getElementById('tracking-channel-count');

const collectSubscriberDataBtn = document.getElementById('collect-subscriber-data-btn');
const lastCollectionInfoSpan = document.getElementById('last-collection-info');
const subscriberChartCanvas = document.getElementById('subscriber-chart');
const chartChannelSelect = document.getElementById('chart-channel-select');
const subscriberDataList = document.getElementById('subscriber-data-list');

const inputWatchTimeBtn = document.getElementById('input-watch-time-btn');
const watchTimeModal = document.getElementById('watch-time-modal');
const watchTimeInputList = document.getElementById('watch-time-input-list');
const saveWatchTimeBtn = document.getElementById('save-watch-time-btn');
const cancelWatchTimeBtn = document.getElementById('cancel-watch-time-btn');
const watchTimeDataList = document.getElementById('watch-time-data-list');
const trackingChannelsSelection = document.getElementById('tracking-channels-selection');

// 로컬 스토리지에 저장될 데이터
let subscriberData = JSON.parse(localStorage.getItem('subscriberData')) || {};
let watchTimeData = JSON.parse(localStorage.getItem('watchTimeData')) || {};
let trackingChannels = Object.values(channels).filter(c => c.type === 'tracking');

// Chart.js 인스턴스
let subscriberChart = null;

// =====================================================================================================
// 이벤트 리스너 설정 함수
// =====================================================================================================
function setupEventListeners() {
    addTrackingChannelBtn.addEventListener('click', () => {
        openModal(channelModal);
    });

    // 채널 삭제 이벤트 위임
    trackingChannelGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-channel-btn')) {
            const channelId = e.target.dataset.channelId;
            removeChannel(channelId);
        }
    });

    collectSubscriberDataBtn.addEventListener('click', collectSubscriberData);
    chartChannelSelect.addEventListener('change', renderChart);
    
    // 시청시간 모달 관련 이벤트
    inputWatchTimeBtn.addEventListener('click', () => {
        openModal(watchTimeModal);
        renderWatchTimeInputs();
    });
    saveWatchTimeBtn.addEventListener('click', saveWatchTime);
    cancelWatchTimeBtn.addEventListener('click', () => closeModal(watchTimeModal));
    
    // 전체 선택/해제 버튼 이벤트
    const selectAllBtn = document.getElementById('selectAllTrackingChannels');
    const deselectAllBtn = document.getElementById('deselectAllTrackingChannels');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => toggleAllChannelSelection(true));
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => toggleAllChannelSelection(false));
    }

    // 채널 선택 체크박스 변경 시 차트 렌더링
    trackingChannelsSelection.addEventListener('change', renderChart);
}

// =====================================================================================================
// 채널 관리 및 렌더링 함수
// =====================================================================================================
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
        type: type
    };
    
    saveChannelsToLocalStorage();
    renderTrackingChannels();
    // 다른 탭의 채널 목록도 업데이트 필요
}

function removeChannel(channelId) {
    if (confirm('정말로 이 채널을 삭제하시겠습니까?')) {
        delete channels[channelId];
        delete subscriberData[channelId];
        saveChannelsToLocalStorage();
        localStorage.setItem('subscriberData', JSON.stringify(subscriberData));
        renderTrackingChannels();
        renderChart();
    }
}

// 등록된 추적 채널 목록을 화면에 렌더링
function renderTrackingChannels() {
    trackingChannelGrid.innerHTML = '';
    const trackingChannels = Object.values(channels).filter(c => c.type === 'tracking');
    
    if (trackingChannels.length === 0) {
        trackingChannelGrid.innerHTML = '<div class="empty-state"><p>추적할 채널을 추가해주세요.</p></div>';
    } else {
        trackingChannels.forEach(channel => {
            const channelCard = document.createElement('div');
            channelCard.className = 'channel-card';
            channelCard.innerHTML = `
                <img src="${channel.thumbnail}" alt="${channel.name}" class="channel-thumbnail">
                <span class="channel-name">${channel.name}</span>
                <button class="remove-channel-btn" data-channel-id="${channel.id}">x</button>
            `;
            trackingChannelGrid.appendChild(channelCard);
        });
    }
    trackingChannelCountSpan.textContent = trackingChannels.length;
    renderTrackingChannelSelection();
}

// 추적 채널 선택 체크박스 렌더링
function renderTrackingChannelSelection() {
    trackingChannelsSelection.innerHTML = '';
    const trackingChannels = Object.values(channels).filter(c => c.type === 'tracking');
    trackingChannels.forEach(channel => {
        const label = document.createElement('label');
        label.className = 'channel-select-item';
        label.innerHTML = `
            <input type="checkbox" name="tracking-channel" value="${channel.id}" checked>
            <span>${channel.name}</span>
        `;
        trackingChannelsSelection.appendChild(label);
    });
}

function toggleAllChannelSelection(checked) {
    document.querySelectorAll('.tracking-channels-selection input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = checked;
    });
    renderChart();
}

// =====================================================================================================
// 데이터 수집 및 차트 렌더링 함수
// =====================================================================================================
async function collectSubscriberData() {
    const trackingChannels = Object.values(channels).filter(c => c.type === 'tracking');
    if (trackingChannels.length === 0) {
        alert('추적할 채널을 먼저 추가해주세요.');
        return;
    }

    showLoading('구독자 수를 수집 중...');
    const today = new Date().toISOString().slice(0, 10);
    const channelIds = trackingChannels.map(c => c.id).join(',');
    
    const data = await fetchYouTubeApi('channels', {
        part: 'statistics',
        id: channelIds
    });
    
    if (!data) {
        hideLoading();
        return;
    }
    
    if (!subscriberData[today]) {
        subscriberData[today] = {};
    }
    
    data.items.forEach(item => {
        subscriberData[today][item.id] = parseInt(item.statistics.subscriberCount);
    });
    
    localStorage.setItem('subscriberData', JSON.stringify(subscriberData));
    lastCollectionInfoSpan.textContent = `마지막 수집: ${today}`;

    hideLoading();
    renderChart();
    renderSubscriberDataList();
}

function renderChart() {
    if (subscriberChart) {
        subscriberChart.destroy();
    }
    
    const selectedChannels = Array.from(document.querySelectorAll('.tracking-channels-selection input:checked')).map(cb => cb.value);
    
    const dates = Object.keys(subscriberData).sort();
    const datasets = selectedChannels.map(channelId => {
        const channelName = channels[channelId]?.name || '알 수 없음';
        const data = dates.map(date => subscriberData[date]?.[channelId] || null);
        
        return {
            label: channelName,
            data: data,
            fill: false,
            borderColor: getRandomColor(),
            tension: 0.1
        };
    });
    
    const chartData = {
        labels: dates,
        datasets: datasets
    };

    const config = {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false,
                }
            }
        },
    };
    
    subscriberChart = new Chart(subscriberChartCanvas, config);
}

// 구독자 데이터 목록 렌더링
function renderSubscriberDataList() {
    subscriberDataList.innerHTML = '';
    const dates = Object.keys(subscriberData).sort((a, b) => new Date(b) - new Date(a));
    
    if (dates.length === 0) {
        subscriberDataList.innerHTML = `
            <div class="empty-state" style="color: #666;">
                <p>아직 기록된 데이터가 없습니다.</p>
                <p>상단의 "오늘 구독자 수 수집" 버튼을 눌러 시작해보세요.</p>
            </div>
        `;
        return;
    }

    dates.forEach(date => {
        const dateItem = document.createElement('div');
        dateItem.className = 'data-list-item';
        let channelListHtml = '';
        
        for (const channelId in subscriberData[date]) {
            const subCount = subscriberData[date][channelId];
            const channelName = channels[channelId]?.name || channelId;
            channelListHtml += `<li><strong>${channelName}:</strong> ${subCount.toLocaleString()}명</li>`;
        }
        
        dateItem.innerHTML = `
            <h4>${date}</h4>
            <ul>${channelListHtml}</ul>
        `;
        subscriberDataList.appendChild(dateItem);
    });
}

// =====================================================================================================
// 시청 시간 입력 및 렌더링 함수
// =====================================================================================================
function renderWatchTimeInputs() {
    watchTimeInputList.innerHTML = '';
    const today = new Date().toISOString().slice(0, 10);
    const trackingChannels = Object.values(channels).filter(c => c.type === 'tracking');

    trackingChannels.forEach(channel => {
        const inputGroup = document.createElement('div');
        inputGroup.className = 'watch-time-input-group';
        const savedTime = watchTimeData[today]?.[channel.id] || '';
        inputGroup.innerHTML = `
            <label for="watch-time-${channel.id}">${channel.name}</label>
            <input type="number" id="watch-time-${channel.id}" data-channel-id="${channel.id}" value="${savedTime}" placeholder="시청시간 (분)">
        `;
        watchTimeInputList.appendChild(inputGroup);
    });
}

function saveWatchTime() {
    const today = new Date().toISOString().slice(0, 10);
    if (!watchTimeData[today]) {
        watchTimeData[today] = {};
    }
    
    document.querySelectorAll('#watch-time-input-list input').forEach(input => {
        const channelId = input.dataset.channelId;
        const time = parseInt(input.value) || 0;
        if (time > 0) {
            watchTimeData[today][channelId] = time;
        } else {
            delete watchTimeData[today][channelId];
        }
    });

    localStorage.setItem('watchTimeData', JSON.stringify(watchTimeData));
    closeModal(watchTimeModal);
    renderWatchTimeDataList();
}

function renderWatchTimeDataList() {
    watchTimeDataList.innerHTML = '';
    const dates = Object.keys(watchTimeData).sort((a, b) => new Date(b) - new Date(a));

    if (dates.length === 0) {
        watchTimeDataList.innerHTML = `
            <div class="empty-state" style="color: #666;">
                <p>아직 기록된 시청시간 데이터가 없습니다.</p>
                <p>상단의 "오늘 구독자 수 수집" 버튼을 눌러 시작해보세요.</p>
            </div>
        `;
        return;
    }
    
    dates.forEach(date => {
        const dateItem = document.createElement('div');
        dateItem.className = 'data-list-item';
        let channelListHtml = '';
        
        for (const channelId in watchTimeData[date]) {
            const time = watchTimeData[date][channelId];
            const channelName = channels[channelId]?.name || channelId;
            channelListHtml += `<li><strong>${channelName}:</strong> ${time.toLocaleString()}분</li>`;
        }
        
        dateItem.innerHTML = `
            <h4>${date}</h4>
            <ul>${channelListHtml}</ul>
        `;
        watchTimeDataList.appendChild(dateItem);
    });
}

// =====================================================================================================
// 유틸리티 함수
// =====================================================================================================
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// =====================================================================================================
// 초기화
// =====================================================================================================
document.addEventListener('DOMContentLoaded', () => {
    // main.js의 loadSettings()가 먼저 실행되어야 합니다.
    renderTrackingChannels();
    renderChart();
    renderSubscriberDataList();
    renderWatchTimeDataList();
    setupEventListeners();
});


