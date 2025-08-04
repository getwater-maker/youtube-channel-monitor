// js/api_keys.js (최적화 버전)
// 불필요한 콘솔 로그 제거, 직관적 처리, 한글 주석 포함

let apiKeys = [];
let currentKeyIndex = 0;

/**
 * 로컬 스토리지에서 API 키 배열을 불러옵니다.
 */
export function loadApiKeys() {
    try {
        const storedKeys = localStorage.getItem('youtubeApiKeys');
        if (storedKeys) {
            // 로컬 스토리지에서 키 불러오기 성공
            return JSON.parse(storedKeys);
        }
    } catch (e) {
        // 로딩 실패 시 무시 (키 없음)
    }
    return [];
}

/**
 * API 키 배열을 로컬 스토리지에 저장합니다.
 * 빈 값(공백 등)은 자동으로 제외됩니다.
 */
export function saveApiKeys(keys) {
    const validKeys = keys.filter(key => key.trim() !== '');
    if (validKeys.length > 0) {
        try {
            localStorage.setItem('youtubeApiKeys', JSON.stringify(validKeys));
            apiKeys = validKeys;
            currentKeyIndex = 0;
            return true;
        } catch (e) {
            alert('API 키를 저장하는 중 오류가 발생했습니다.');
            return false;
        }
    } else {
        alert('저장할 유효한 API 키가 없습니다.');
        return false;
    }
}

/**
 * 유튜브 API 요청을 처리합니다.
 * 키가 소진되거나 에러일 경우 자동으로 다음 키로 전환해 재시도합니다.
 * 모든 키가 실패하면 알림을 띄웁니다.
 */
export async function fetchYoutubeApi(url, retries = 0) {
    if (apiKeys.length === 0) {
        alert('먼저 API 키를 입력/저장해주세요.');
        throw new Error('API 키 없음');
    }
    if (retries >= apiKeys.length) {
        alert('모든 API 키의 할당량이 소진되었거나 유효하지 않습니다.');
        throw new Error('모든 API 키 사용불가');
    }
    const currentKey = apiKeys[currentKeyIndex];
    const requestUrl = `${url}&key=${currentKey}`;

    try {
        const response = await fetch(requestUrl);
        const data = await response.json();

        // 오류 발생 시 다음 키로 전환 후 재시도
        if (data.error) {
            if (data.error.code === 403 || data.error.code === 400) {
                // 유효하지 않은 키 또는 할당량 소진 시
                currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
                return fetchYoutubeApi(url, retries + 1);
            } else {
                // 기타 오류는 바로 반환
                alert(data.error.message || 'API 오류가 발생했습니다.');
                throw new Error(data.error.message);
            }
        }
        return data;

    } catch (error) {
        // 네트워크 또는 기타 예외 발생 시 다음 키로 전환
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        if (retries + 1 < apiKeys.length) {
            return fetchYoutubeApi(url, retries + 1);
        } else {
            alert('네트워크 오류 또는 모든 키의 요청 실패가 발생했습니다.');
            throw error;
        }
    }
}

/**
 * 저장된 API 키를 텍스트 파일로 다운로드합니다.
 */
export function downloadApiKeys() {
    if (apiKeys.length === 0) {
        alert('저장된 API 키가 없습니다. 먼저 API 키를 저장해주세요.');
        return;
    }
    const keysText = apiKeys.join('\n');
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

// 모듈이 로드될 때 자동으로 apiKeys 배열 초기화
apiKeys = loadApiKeys();
