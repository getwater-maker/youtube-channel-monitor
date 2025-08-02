// =====================================================================================================
// main.js: 애플리케이션의 공통 로직 및 상태 관리를 담당하는 모듈
// 이 파일은 다른 모듈에서 필요한 함수와 데이터를 export하여 공유합니다.
// =====================================================================================================

// 공통으로 사용되는 DOM 요소들을 export하여 다른 모듈에서 직접 접근 가능하도록 합니다.
export const appContainer = document.querySelector('.app-container');
export const loadingOverlay = document.getElementById('loading-overlay');
export const apiStatusText = document.getElementById('api-status-text');

export const tabButtons = document.querySelectorAll('.tab-btn');
export const tabContents = document.querySelectorAll('.tab-content');

export const apiModal = document.getElementById('api-modal');
export const channelModal = document.getElementById('channel-modal');
export const channelSelectionModal = document.getElementById('channel-selection-modal');
export const channelInput = document.getElementById('channel-input');
export const addChannelConfirmBtn = document.getElementById('add-channel-confirm-btn');


// API 키 및 기타 전역 상태 변수
export let apiKeys = [];
export let currentApiKeyIndex = 0;
export let channels = {};
export let lastApiCheck = 0;
export let apiStats = {};

// =====================================================================================================
// 로컬 스토리지 관리 함수
// =====================================================================================================
// 로컬 스토리지에서 모든 설정을 불러와 전역 변수에 할당합니다.
export function loadSettings() {
    const storedApiKeys = localStorage.getItem('apiKeys');
    if (storedApiKeys) {
        apiKeys = JSON.parse(storedApiKeys);
        updateApiStatus();
    }
    const storedChannels = localStorage.getItem('channels');
    if (storedChannels) {
        channels = JSON.parse(storedChannels);
    }
    const storedApiStats = localStorage.getItem('apiStats');
    if (storedApiStats) {
        apiStats = JSON.parse(storedApiStats);
    }
    const storedLastApiCheck = localStorage.getItem('lastApiCheck');
    if (storedLastApiCheck) {
        lastApiCheck = parseInt(storedLastApiCheck);
    }
}

// API 키를 로컬 스토리지에 저장합니다.
export function saveApiKeys() {
    const apiInputs = document.querySelectorAll('#api-modal .api-inputs input');
    apiKeys = Array.from(apiInputs).map(input => input.value.trim()).filter(key => key);
    localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
    updateApiStatus();
    alert('API 키가 저장되었습니다.');
}

// 채널 정보를 로컬 스토리지에 저장합니다.
export function saveChannelsToLocalStorage() {
    localStorage.setItem('channels', JSON.stringify(channels));
}

// API 사용 통계를 로컬 스토리지에 저장합니다.
export function saveApiStats() {
    localStorage.setItem('apiStats', JSON.stringify(apiStats));
    localStorage.setItem('lastApiCheck', Date.now());
}

// =====================================================================================================
// UI 제어 함수 (모달, 로딩 오버레이)
// =====================================================================================================
// 모달 창을 엽니다.
export function openModal(modal) {
    modal.style.display = 'block';
    appContainer.style.overflow = 'hidden';
}

// 모달 창을 닫습니다.
export function closeModal(modal) {
    modal.style.display = 'none';
    appContainer.style.overflow = '';
}

// 로딩 오버레이를 표시합니다.
export function showLoading(message = '데이터를 불러오는 중...') {
    loadingOverlay.querySelector('p').textContent = message;
    loadingOverlay.style.display = 'flex';
}

// 로딩 오버레이를 숨깁니다.
export function hideLoading() {
    loadingOverlay.style.display = 'none';
}

// API 상태를 업데이트합니다.
export function updateApiStatus() {
    if (apiKeys.length > 0) {
        apiStatusText.textContent = `API 키 ${apiKeys.length}개 설정됨`;
        apiStatusText.style.color = '#28a745';
        apiStatusText.title = `현재 사용 키: #${currentApiKeyIndex + 1}`;
    } else {
        apiStatusText.textContent = 'API 키 설정 필요';
        apiStatusText.style.color = '#dc3545';
        apiStatusText.title = '';
    }
}

// =====================================================================================================
// 이벤트 리스너 설정
// =====================================================================================================
// 탭 전환 이벤트 리스너를 설정합니다.
function setupTabEvents() {
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });
}

// 탭 전환 함수
function switchTab(tabName) {
    tabContents.forEach(content => content.classList.remove('active'));
    tabButtons.forEach(button => button.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// 모달 관련 이벤트 리스너 설정
function setupModalEvents() {
    const apiSettingsBtn = document.getElementById('api-settings-btn');
    const saveApiBtn = document.getElementById('save-api-btn');
    const cancelApiBtn = document.getElementById('cancel-api-btn');

    apiSettingsBtn.addEventListener('click', () => openModal(apiModal));
    saveApiBtn.addEventListener('click', saveApiKeys);
    cancelApiBtn.addEventListener('click', () => closeModal(apiModal));
}

// =====================================================================================================
// YouTube API 호출 함수
// 이 함수는 API 호출 로직과 할당량 초과 시 키 순환 로직을 포함합니다.
// =====================================================================================================
export async function fetchYouTubeApi(endpoint, params) {
    if (apiKeys.length === 0) {
        alert('API 키를 먼저 설정해주세요.');
        return null;
    }

    const currentKey = apiKeys[currentApiKeyIndex];
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}?key=${currentKey}&${new URLSearchParams(params).toString()}`;

    // API 통계 업데이트 (선택사항)
    if (!apiStats[currentKey]) {
        apiStats[currentKey] = { calls: 0, errors: 0 };
    }
    apiStats[currentKey].calls++;

    try {
        const response = await fetch(url);
        if (response.status === 403) {
            console.warn(`API 할당량 초과 또는 키 오류: ${currentKey}. 다음 키로 교체합니다.`);
            apiStats[currentKey].errors++;
            
            // 다음 키로 순환
            currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
            updateApiStatus();

            // 모든 키가 실패했는지 확인
            const allKeysFailed = Object.values(apiStats).every(stats => stats.errors > 0);
            if (allKeysFailed) {
                alert('모든 API 키의 할당량이 소진되었거나 유효하지 않습니다. 새로운 키를 추가하거나 내일 다시 시도해주세요.');
                return null;
            }

            // 다음 키로 재시도
            return await fetchYouTubeApi(endpoint, params);
        }
        if (!response.ok) {
            throw new Error(`API 오류: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API 호출 중 오류 발생:', error);
        return null;
    } finally {
        saveApiStats();
    }
}

// =====================================================================================================
// 초기화
// =====================================================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupTabEvents();
    setupModalEvents();
});

