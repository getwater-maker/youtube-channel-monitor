// js/api_keys.js

/**
 * API 키 목록을 로컬스토리지에서 불러옵니다.
 * @returns {string[]} API 키 배열
 */
export function loadApiKeys() {
    const keys = JSON.parse(localStorage.getItem('youtubeApiKeys') || '[]');
    return Array.isArray(keys) ? keys.filter(k => !!k) : [];
}

/**
 * API 키 목록을 로컬스토리지에 저장합니다.
 * @param {string[]} keys 
 * @returns {boolean}
 */
export function saveApiKeys(keys) {
    if (!Array.isArray(keys)) return false;
    localStorage.setItem('youtubeApiKeys', JSON.stringify(keys));
    return true;
}

/**
 * API 키 목록을 파일로 다운로드합니다.
 */
export function downloadApiKeys() {
    const keys = loadApiKeys();
    const blob = new Blob([keys.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtube_api_keys.txt';
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * 저장된 API 키 중 순환 방식으로 YouTube API를 요청합니다.
 * @param {string} url 
 * @returns {Promise<object>}
 */
let apiKeyIdx = 0;
export async function fetchYoutubeApi(url) {
    const keys = loadApiKeys();
    if (!keys.length) throw new Error('API 키가 없습니다.');
    let tryCount = 0;
    let lastError = null;

    while (tryCount < keys.length) {
        const apiKey = keys[apiKeyIdx];
        const requestUrl = url + (url.includes('?') ? '&' : '?') + 'key=' + apiKey;
        try {
            const resp = await fetch(requestUrl);
            const data = await resp.json();
            if (!data.error) return data;
            lastError = data.error;
            // 할당량 초과, 금지 등의 오류 시 다음 키로
            if (
                data.error.code === 403 ||
                data.error.code === 400 ||
                data.error.errors?.[0]?.reason === 'quotaExceeded'
            ) {
                apiKeyIdx = (apiKeyIdx + 1) % keys.length;
            } else {
                throw new Error(data.error.message);
            }
        } catch (e) {
            lastError = e;
            apiKeyIdx = (apiKeyIdx + 1) % keys.length;
        }
        tryCount++;
    }
    throw new Error(lastError?.message || 'API 요청 실패');
}
