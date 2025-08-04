// js/api_keys.js

/**
 * 최대 5개의 API 키를 localStorage에 저장합니다.
 * @param {string[]} keys - API 키 배열(최대 5개)
 * @returns {boolean} - 성공 여부
 */
export function saveApiKeys(keys) {
    // 5개로 고정, 부족하면 빈 값으로 채움
    const fixedKeys = Array(5).fill("").map((_, i) => keys[i] || "");
    localStorage.setItem('ytApiKeys', JSON.stringify(fixedKeys));
    return true;
}

/**
 * localStorage에서 API 키 배열을 불러옵니다.
 * @returns {string[]} - API 키 배열(5개, 값이 없으면 빈 문자열)
 */
export function loadApiKeys() {
    const stored = localStorage.getItem('ytApiKeys');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // 5개로 맞춤
            return Array(5).fill("").map((_, i) => parsed[i] || "");
        } catch {
            return ["", "", "", "", ""];
        }
    }
    return ["", "", "", "", ""];
}

/**
 * 텍스트 파일로 API 키 목록을 다운로드합니다.
 */
export function downloadApiKeys() {
    const keys = loadApiKeys();
    const blob = new Blob([keys.join('\n')], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "api_keys.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
