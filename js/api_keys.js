// js/api_keys.js

// 로컬 스토리지에 API 키를 저장하는 함수
export function saveApiKeys(keys) {
    const validKeys = keys.filter(key => key.trim() !== '');
    if (validKeys.length > 0) {
        try {
            localStorage.setItem('youtubeApiKeys', JSON.stringify(validKeys));
            // 키를 저장할 때 현재 키 인덱스를 0으로 초기화
            currentKeyIndex = 0;
            return true;
        } catch (e) {
            console.error('로컬 스토리지 저장 실패', e);
            alert('API 키를 저장하는 중 오류가 발생했습니다.');
            return false;
        }
    } else {
        alert('유효한 API 키가 없습니다.');
        return false;
    }
}

// 로컬 스토리지에서 API 키를 불러오는 함수
export function loadApiKeys() {
    try {
        const storedKeys = localStorage.getItem('youtubeApiKeys');
        if (storedKeys) {
            return JSON.parse(storedKeys);
        }
    } catch (e) {
        console.error('로컬 스토리지 로드 실패', e);
    }
    return [];
}

// 현재 사용 중인 API 키와 키 목록을 관리
let apiKeys = loadApiKeys();
let currentKeyIndex = 0;

// API 요청을 처리하는 핵심 함수
export async function fetchYoutubeApi(url, retries = 0) {
    if (apiKeys.length === 0) {
        alert('API 키를 먼저 등록해주세요.');
        throw new Error('API 키 없음');
    }

    const currentKey = apiKeys[currentKeyIndex];
    const requestUrl = `${url}&key=${currentKey}`;
    
    // 재시도 횟수와 현재 사용 중인 키 정보를 더 명확하게 표시
    console.log(`[API 요청] 키 #${currentKeyIndex + 1} (${retries + 1}번째 시도)`);

    try {
        const response = await fetch(requestUrl);
        const data = await response.json();
        
        if (data.error) {
            console.error('[API 오류]', data.error.message);
            // 할당량 초과 에러(403) 처리
            if (data.error.code === 403 && data.error.message.includes('quota')) {
                console.warn('API 할당량 초과. 다음 키로 전환합니다.');
                // 다음 키로 인덱스 변경
                currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                if (retries < apiKeys.length - 1) {
                    return fetchYoutubeApi(url, retries + 1); // 다음 키로 재시도
                } else {
                    alert('모든 API 키의 할당량이 소진되었습니다.');
                    throw new Error('모든 API 키 할당량 소진');
                }
            } else {
                throw new Error(data.error.message);
            }
        }
        return data;
    } catch (error) {
        console.error('네트워크 또는 API 요청 실패:', error);
        throw error;
    }
}

// 로컬 스토리지에 저장된 API 키를 텍스트 파일로 다운로드하는 함수
export function downloadApiKeys() {
    const storedKeys = localStorage.getItem('youtubeApiKeys');
    if (!storedKeys) {
        alert('저장된 API 키가 없습니다. 먼저 API 키를 저장해주세요.');
        return;
    }
    
    const keysArray = JSON.parse(storedKeys);
    const keysText = keysArray.join('\n');
    
    const blob = new Blob([keysText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'api_keys.txt';
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('api_keys.txt 파일이 다운로드되었습니다.');
}
