// js/api_keys.js

let apiKeys = [];
let currentApiKeyIndex = 0;

// API 키를 로컬 스토리지에 저장하는 함수
export function saveApiKeys(keys) {
    apiKeys = keys.filter(key => key.trim() !== ''); // 빈 키 제거
    if (apiKeys.length > 0) {
        localStorage.setItem('youtubeApiKeys', JSON.stringify(apiKeys));
        currentApiKeyIndex = 0;
        console.log(`API 키 ${apiKeys.length}개가 저장되었습니다.`);
        return true;
    }
    console.error('API 키가 입력되지 않았습니다.');
    return false;
}

// 로컬 스토리지에서 API 키를 불러오는 함수
export function loadApiKeys() {
    const storedKeys = localStorage.getItem('youtubeApiKeys');
    if (storedKeys) {
        apiKeys = JSON.parse(storedKeys);
        console.log(`API 키 ${apiKeys.length}개가 로드되었습니다.`);
        return true;
    }
    return false;
}

// 다음 API 키를 가져오는 함수
function getNextApiKey() {
    if (apiKeys.length === 0) {
        return null;
    }
    const key = apiKeys[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length; // 다음 인덱스로 순환
    return key;
}

// API 요청을 처리하는 핵심 함수
export async function fetchYoutubeApi(url, retries = 0) {
    if (retries >= apiKeys.length) {
        throw new Error('모든 API 키의 할당량이 소진되었거나 요청이 실패했습니다.');
    }

    const apiKey = apiKeys[retries];
    if (!apiKey) {
        throw new Error('사용 가능한 API 키가 없습니다. API 키를 먼저 입력해주세요.');
    }

    const fullUrl = `${url}&key=${apiKey}`;
    try {
        const response = await fetch(fullUrl);
        const data = await response.json();
        
        if (!response.ok) {
            // 할당량 초과 에러(code 403) 확인
            if (data.error && data.error.code === 403) {
                console.warn(`API 키 ${apiKey} 할당량 소진. 다음 키로 재시도합니다.`);
                return fetchYoutubeApi(url, retries + 1); // 재귀적으로 다음 키로 재시도
            } else {
                throw new Error(data.error.message || `API 요청 실패: ${response.status}`);
            }
        }
        
        return data;
    } catch (error) {
        console.error('API 요청 중 오류 발생:', error);
        throw error;
    }
}
