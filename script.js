// 필요한 DOM 요소들 가져오기
const appContainer = document.querySelector('.app-container');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const loadingOverlay = document.getElementById('loading-overlay');

// API 설정 모달
const apiSettingsBtn = document.getElementById('api-settings-btn');
const apiModal = document.getElementById('api-modal');
const saveApiBtn = document.getElementById('save-api-btn');
const cancelApiBtn = document.getElementById('cancel-api-btn');
const apiKey1 = document.getElementById('api-key-1');
// ... (나머지 API 키 입력 필드)

// 채널 추가 모달
const addMonitoringChannelBtn = document.getElementById('add-monitoring-channel-btn');
const addTrackingChannelBtn = document.getElementById('add-tracking-channel-btn');
const channelModal = document.getElementById('channel-modal');
const channelInput = document.getElementById('channel-input');
const addChannelConfirmBtn = document.getElementById('add-channel-confirm-btn');
const cancelChannelBtn = document.getElementById('cancel-channel-btn');

// ... (다른 요소들도 여기에 추가)

// 전역 변수
let apiKeys = [];
let currentApiKeyIndex = 0;
let channels = {}; // { 'UC...': { id: 'UC...', name: '채널명', type: 'monitoring', subCount: 123456 }, ... }
let subscriberData = {}; // { '날짜': { 'UC...': 123456, ... }, ... }
let trackingData = {}; // { 'UC...': { latestVideoId: '', record: [] }, ... }

// 초기화 함수 호출
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupEventListeners();
    updateApiStatus();
    renderChannelManagement('monitoring');
    renderChannelManagement('tracking');
});

// 로컬 스토리지에서 설정 불러오기
function loadSettings() {
    const storedApiKeys = localStorage.getItem('apiKeys');
    if (storedApiKeys) {
        apiKeys = JSON.parse(storedApiKeys);
    }
    // ... (다른 설정들도 불러오는 로직 추가)
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 탭 전환 이벤트
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // ... (탭 전환 로직)
        });
    });

    // API 모달 이벤트
    apiSettingsBtn.addEventListener('click', () => {
        // ... (모달 열기 로직)
    });
    saveApiBtn.addEventListener('click', () => {
        // ... (API 키 저장 로직)
    });
    // ... (다른 버튼 이벤트)
}

// 탭 전환 함수
function switchTab(tabName) {
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// 모달 열기/닫기 함수
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// 이벤트 리스너 설정 함수에 아래 로직 추가
function setupEventListeners() {
    // ...
    // 탭 전환 이벤트
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });

    // API 모달 이벤트
    apiSettingsBtn.addEventListener('click', () => openModal('api-modal'));
    cancelApiBtn.addEventListener('click', () => closeModal('api-modal'));
    saveApiBtn.addEventListener('click', saveApiKeys);

    // 채널 모달 이벤트
    addMonitoringChannelBtn.addEventListener('click', () => {
        openModal('channel-modal');
        // ... (모니터링 채널 추가임을 표시하는 로직)
    });
    addTrackingChannelBtn.addEventListener('click', () => {
        openModal('channel-modal');
        // ... (추적 채널 추가임을 표시하는 로직)
    });
    cancelChannelBtn.addEventListener('click', () => closeModal('channel-modal'));
    addChannelConfirmBtn.addEventListener('click', addChannel);

    // ...
}

// API 호출 헬퍼 함수
async function fetchYouTubeApi(endpoint, params) {
    // API 키가 없으면 에러 반환
    if (apiKeys.length === 0) {
        alert('API 키를 먼저 설정해주세요.');
        return null;
    }

    const currentKey = apiKeys[currentApiKeyIndex];
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}?key=${currentKey}&${new URLSearchParams(params).toString()}`;

    try {
        const response = await fetch(url);
        if (response.status === 403) {
            // 할당량 초과 시 다음 키로 변경
            console.warn('API 할당량 초과. 다음 키로 교체합니다.');
            currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
            updateApiStatus();
            // 재시도
            return fetchYouTubeApi(endpoint, params);
        }
        if (!response.ok) {
            throw new Error(`API 오류: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API 호출 중 오류 발생:', error);
        return null;
    }
}

// 채널 ID로 채널 정보 가져오는 함수
async function getChannelInfo(channelIdentifier) {
    showLoading();
    let params;
    if (channelIdentifier.startsWith('UC')) {
        params = { part: 'snippet,statistics', id: channelIdentifier };
    } else {
        // 채널명이나 URL로 검색하는 로직 (search API 필요)
        // ...
    }

    const data = await fetchYouTubeApi('channels', params);
    hideLoading();
    return data;
}

// 로딩 오버레이
function showLoading(message = '데이터를 불러오는 중...') {
    loadingOverlay.style.display = 'flex';
    loadingOverlay.querySelector('p').textContent = message;
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// 채널 추가 처리 함수
async function addChannel() {
    const input = channelInput.value.trim();
    if (!input) {
        alert('채널 정보를 입력해주세요.');
        return;
    }

    // 채널 정보를 가져와서 처리하는 로직
    const channelData = await getChannelInfo(input);
    if (!channelData || channelData.items.length === 0) {
        alert('채널을 찾을 수 없습니다.');
        return;
    }
    const channel = channelData.items[0];

    const channelId = channel.id;
    const channelName = channel.snippet.title;

    // 모니터링/추적 탭에 따라 채널 추가
    const activeTab = document.querySelector('.tab-content.active').id;
    if (activeTab === 'channel-monitor') {
        channels[channelId] = { id: channelId, name: channelName, type: 'monitoring' };
    } else if (activeTab === 'subscriber-tracking') {
        channels[channelId] = { id: channelId, name: channelName, type: 'tracking' };
    }

    saveChannelsToLocalStorage();
    closeModal('channel-modal');
    channelInput.value = '';

    renderChannelManagement('monitoring');
    renderChannelManagement('tracking');
}

// 채널 목록을 로컬 스토리지에 저장
function saveChannelsToLocalStorage() {
    localStorage.setItem('channels', JSON.stringify(channels));
}

// 채널 관리 UI 렌더링
function renderChannelManagement(type) {
    const grid = document.getElementById(`${type}-channel-grid`);
    const countSpan = document.getElementById(`${type}-channel-count`);
    grid.innerHTML = '';
    
    let count = 0;
    for (const id in channels) {
        const channel = channels[id];
        if (channel.type === type) {
            count++;
            const channelDiv = document.createElement('div');
            channelDiv.className = 'channel-card';
            channelDiv.innerHTML = `
                <img src="${channel.snippet.thumbnails.default.url}" alt="${channel.name}" class="channel-thumbnail">
                <span class="channel-name">${channel.name}</span>
                <button class="remove-channel-btn" data-channel-id="${id}">x</button>
            `;
            grid.appendChild(channelDiv);
        }
    }

    countSpan.textContent = count;
    // ... (삭제 버튼 이벤트 리스너 추가)
}

