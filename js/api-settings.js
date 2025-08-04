// js/api-settings.js

/**
 * YouTube API 키를 브라우저의 localStorage에 저장하는 함수
 * @param {string} key - 저장할 YouTube API 키
 */
export function saveApiKey(key) {
    localStorage.setItem('youtube_api_key', key);
}

/**
 * localStorage에서 저장된 YouTube API 키를 가져오는 함수
 * @returns {string|null} 저장된 API 키 또는 키가 없으면 null
 */
export function getApiKey() {
    return localStorage.getItem('youtube_api_key');
}

/**
 * API 키 설정 모달을 열고, 저장된 키가 있다면 입력 필드에 채워넣는 함수
 */
export function openApiSettingsModal() {
    const modal = document.getElementById('api-settings-modal');
    modal.style.display = 'flex';
    const apiKeyInput = document.getElementById('api-key-input');
    apiKeyInput.value = getApiKey() || '';
}

/**
 * API 키 설정 모달을 닫는 함수
 */
export function closeApiSettingsModal() {
    const modal = document.getElementById('api-settings-modal');
    modal.style.display = 'none';
}

/**
 * API 키의 상태를 확인하여 UI에 표시하는 함수
 */
export function updateApiStatus() {
    const apiKey = getApiKey();
    const statusText = document.getElementById('api-status-text');

    if (apiKey) {
        statusText.textContent = 'API 키 설정됨';
        statusText.classList.remove('status-needed');
        statusText.classList.add('status-ok');
    } else {
        statusText.textContent = 'API 키 설정 필요';
        statusText.classList.remove('status-ok');
        statusText.classList.add('status-needed');
    }
}
