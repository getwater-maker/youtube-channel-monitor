// ========== script-utils.js ==========
// ============================================
// script-utils.js - 유틸리티 함수들
// ============================================

// 숫자 포맷팅
function formatNumber(num) {
    if (typeof num !== 'number') {
        num = parseInt(num) || 0;
    }
    
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(1) + 'B';
    } else if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}

// 날짜 포맷팅
function formatDate(dateString) {
    if (!dateString) return '알 수 없음';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return '1일 전';
    } else if (diffDays < 7) {
        return `${diffDays}일 전`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks}주 전`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months}개월 전`;
    } else {
        const years = Math.floor(diffDays / 365);
        return `${years}년 전`;
    }
}

// 정확한 시간 계산 함수
function getTimeAgo(dateString) {
    if (!dateString) return '알 수 없음';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    
    const minutes = Math.floor(diffTime / (1000 * 60));
    const hours = Math.floor(diffTime / (1000 * 60 * 60));
    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    
    if (minutes < 1) {
        return '방금 전';
    } else if (minutes < 60) {
        return `${minutes}분 전`;
    } else if (hours < 24) {
        return `${hours}시간 전`;
    } else if (days === 1) {
        return '어제';
    } else if (days < 7) {
        return `${days}일 전`;
    } else if (weeks < 4) {
        return `${weeks}주 전`;
    } else if (months < 12) {
        return `${months}개월 전`;
    } else {
        return `${years}년 전`;
    }
}

// 차트용 날짜 포맷
function formatDateForChart(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 표시용 날짜 포맷
function formatDateForDisplay(dateString) {
    if (!dateString) return '알 수 없음';
    
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

// 한국 시간 기준 날짜 반환
function getKoreanDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const koreaTime = new Date(utc + (9 * 3600000));
    return koreaTime.toISOString().split('T')[0];
}

// 어제 날짜 구하기
function getYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const utc = yesterday.getTime() + (yesterday.getTimezoneOffset() * 60000);
    const koreaTime = new Date(utc + (9 * 3600000));
    return koreaTime.toISOString().split('T')[0];
}

// 날짜 필터 생성
function getDateFilter(range) {
    const now = new Date();
    const date = new Date(now);
    
    switch (range) {
        case 'hour':
            date.setHours(date.getHours() - 1);
            break;
        case 'hour3':
            date.setHours(date.getHours() - 3);
            break;
        case 'hour12':
            date.setHours(date.getHours() - 12);
            break;
        case 'day':
            date.setDate(date.getDate() - 1);
            break;
        case 'day3':
            date.setDate(date.getDate() - 3);
            break;
        case 'week':
            date.setDate(date.getDate() - 7);
            break;
        case 'week2':
            date.setDate(date.getDate() - 14);
            break;
        case 'month':
            date.setMonth(date.getMonth() - 1);
            break;
        case 'month3':
            date.setMonth(date.getMonth() - 3);
            break;
        case 'month6':
            date.setMonth(date.getMonth() - 6);
            break;
        case 'year':
            date.setFullYear(date.getFullYear() - 1);
            break;
        default:
            date.setDate(date.getDate() - 7);
    }
    
    return date.toISOString();
}

// YouTube 썸네일 URL 선택
function getBestThumbnail(thumbnails) {
    if (!thumbnails) return null;
    
    // 우선순위: maxres > high > medium > standard > default
    if (thumbnails.maxres?.url) return thumbnails.maxres.url;
    if (thumbnails.high?.url) return thumbnails.high.url;
    if (thumbnails.medium?.url) return thumbnails.medium.url;
    if (thumbnails.standard?.url) return thumbnails.standard.url;
    if (thumbnails.default?.url) return thumbnails.default.url;
    
    return null;
}

// YouTube 영상 시간 파싱
function parseYouTubeDuration(durationStr) {
    if (!durationStr) return 0;
    
    const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    
    return hours * 3600 + minutes * 60 + seconds;
}

// Shorts 여부 판단
function isShorts(duration) {
    if (!duration) return true;
    
    const totalSeconds = parseYouTubeDuration(duration);
    return totalSeconds <= 60; // 1분 이하는 Shorts로 간주
}

// 채널 ID 유효성 검사
function isValidChannelId(channelId) {
    return channelId && typeof channelId === 'string' && /^UC[a-zA-Z0-9_-]{22}$/.test(channelId);
}

// 채널 ID 형식 확인
function isChannelId(input) {
    return /^UC[a-zA-Z0-9_-]{22}$/.test(input);
}

// 채널 URL 형식 확인
function isChannelUrl(input) {
    const urlPatterns = [
        /youtube\.com\/channel\/([^\/\?&]+)/,
        /youtube\.com\/c\/([^\/\?&]+)/,
        /youtube\.com\/user\/([^\/\?&]+)/,
        /youtube\.com\/@([^\/\?&]+)/,
        /youtu\.be\/channel\/([^\/\?&]+)/
    ];
    
    return urlPatterns.some(pattern => pattern.test(input));
}

// 구독자 증감 HTML 생성
function getSubscriberGrowthHTML(channelId, currentCount) {
    const growth = getSubscriberGrowth(channelId, currentCount);
    if (growth === null) return '';
    
    if (growth > 0) {
        return `<span class="subscriber-growth positive">+${formatNumber(growth)}</span>`;
    } else if (growth < 0) {
        return `<span class="subscriber-growth negative">${formatNumber(growth)}</span>`;
    } else {
        return `<span class="subscriber-growth neutral">±0</span>`;
    }
}

// 전날 대비 구독자 증감 계산
function getSubscriberGrowth(channelId, currentCount) {
    const dailyData = JSON.parse(localStorage.getItem('daily-subscriber-data') || '{}');
    const today = getKoreanDate();
    const yesterday = getYesterday();
    
    if (!dailyData[channelId] || !dailyData[channelId][yesterday]) {
        // 어제 데이터가 없으면 오늘 데이터 저장
        saveDailySubscriberCount(channelId, currentCount);
        return null;
    }
    
    const yesterdayCount = dailyData[channelId][yesterday];
    const growth = currentCount - yesterdayCount;
    
    // 오늘 데이터 저장
    saveDailySubscriberCount(channelId, currentCount);
    
    return growth;
}

// 일일 구독자 수 저장
function saveDailySubscriberCount(channelId, count) {
    const dailyData = JSON.parse(localStorage.getItem('daily-subscriber-data') || '{}');
    const today = getKoreanDate();
    
    if (!dailyData[channelId]) {
        dailyData[channelId] = {};
    }
    
    dailyData[channelId][today] = count;
    
    // 30일 이전 데이터 삭제 (용량 절약)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    Object.keys(dailyData[channelId]).forEach(date => {
        if (date < cutoffDate) {
            delete dailyData[channelId][date];
        }
    });
    
    localStorage.setItem('daily-subscriber-data', JSON.stringify(dailyData));
}

// UI 유틸리티 함수들
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function showTemporaryMessage(message, type = 'success', duration = 3000) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `temporary-message ${type}`;
    
    const colors = {
        success: '#4caf50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196f3'
    };
    
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.success};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-weight: 500;
        max-width: 300px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
    `;
    
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    // CSS 애니메이션 추가
    if (!document.getElementById('temp-message-styles')) {
        const style = document.createElement('style');
        style.id = 'temp-message-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 300);
    }, duration);
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    channelSearchResults = [];
}

// 외부 링크 열기
function openVideo(videoId) {
    if (videoId) {
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    }
}

function openChannel(channelId) {
    if (channelId) {
        window.open(`https://www.youtube.com/channel/${channelId}`, '_blank');
    }
}

// 텍스트 유틸리티
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function unescapeHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

// 배열 유틸리티
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function removeDuplicates(array, key = null) {
    if (!key) {
        return [...new Set(array)];
    }
    
    const seen = new Set();
    return array.filter(item => {
        const value = typeof key === 'function' ? key(item) : item[key];
        if (seen.has(value)) {
            return false;
        }
        seen.add(value);
        return true;
    });
}

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// 로컬 스토리지 유틸리티
function safeGetFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error(`로컬 스토리지에서 ${key} 읽기 오류:`, error);
        return defaultValue;
    }
}

function safeSetToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`로컬 스토리지에 ${key} 저장 오류:`, error);
        return false;
    }
}

function clearStorageByPattern(pattern) {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(pattern)) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return keysToRemove.length;
}

// 디바운스 함수
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

// 쓰로틀 함수
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 성능 측정
function measurePerformance(name, func) {
    return async function(...args) {
        const start = performance.now();
        const result = await func.apply(this, args);
        const end = performance.now();
        console.log(`${name} 실행 시간: ${(end - start).toFixed(2)}ms`);
        return result;
    };
}

// 오류 처리 유틸리티
function handleApiError(error) {
    console.error('API 오류:', error);
    
    if (error.message.includes('quotaExceeded') || error.message.includes('quota')) {
        return 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
    } else if (error.message.includes('keyInvalid')) {
        return 'API 키가 올바르지 않습니다. 설정을 확인해주세요.';
    } else if (error.message.includes('찾을 수 없습니다')) {
        return '요청한 데이터를 찾을 수 없습니다.';
    } else if (error.message.includes('네트워크')) {
        return '네트워크 연결을 확인해주세요.';
    } else {
        return `오류가 발생했습니다: ${error.message}`;
    }
}

// 데이터 검증
function validateChannelData(channel) {
    const errors = [];
    
    if (!channel.id || !isValidChannelId(channel.id)) {
        errors.push('올바르지 않은 채널 ID');
    }
    
    if (!channel.name || typeof channel.name !== 'string' || channel.name.trim().length === 0) {
        errors.push('채널명이 필요합니다');
    }
    
    if (typeof channel.subscriberCount !== 'number' || channel.subscriberCount < 0) {
        errors.push('올바르지 않은 구독자 수');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// 브라우저 호환성 확인
function checkBrowserCompatibility() {
    const features = {
        localStorage: typeof Storage !== 'undefined',
        fetch: typeof fetch !== 'undefined',
        Promise: typeof Promise !== 'undefined',
        arrow: (() => { try { eval('()=>{}'); return true; } catch(e) { return false; } })(),
        destructuring: (() => { try { eval('const {a} = {}'); return true; } catch(e) { return false; } })()
    };
    
    const unsupported = Object.entries(features)
        .filter(([feature, supported]) => !supported)
        .map(([feature]) => feature);
    
    if (unsupported.length > 0) {
        console.warn('지원되지 않는 브라우저 기능:', unsupported);
        return false;
    }
    
    return true;
}

// 색상 유틸리티
function getRandomColor() {
    const colors = [
        '#764ba2', '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
        '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#e91e63',
        '#ff5722', '#795548', '#607d8b', '#4caf50', '#ffeb3b'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 반응형 유틸리티
function isMobile() {
    return window.innerWidth <= 768;
}

function isTablet() {
    return window.innerWidth > 768 && window.innerWidth <= 1024;
}

function isDesktop() {
    return window.innerWidth > 1024;
}

// 키보드 단축키 처리
function handleKeyboardShortcuts(event) {
    // Ctrl/Cmd + K: 검색 포커스
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.getElementById('search-keyword');
        if (searchInput) {
            searchInput.focus();
        }
    }
    
    // ESC: 모달 닫기
    if (event.key === 'Escape') {
        closeAllModals();
    }
    
    // F5: 새로고침 (개발 모드에서만)
    if (event.key === 'F5' && event.ctrlKey) {
        if (confirm('페이지를 새로고침하시겠습니까?')) {
            location.reload();
        }
        event.preventDefault();
    }
}

// 초기화 함수들에서 사용할 수 있도록 키보드 이벤트 등록
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// 성능 최적화 - 이미지 지연 로딩
function initializeLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        });
        
        // 기존 이미지들에 대해 지연 로딩 적용
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
        
        // 새로 추가되는 이미지들을 위한 MutationObserver
        const mutationObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        const images = node.querySelectorAll ? node.querySelectorAll('img[data-src]') : [];
                        images.forEach(img => imageObserver.observe(img));
                    }
                });
            });
        });
        
        mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
}


// ========== script-api.js ==========
// ============================================
// script-api.js - API 관련 함수들
// ============================================

// API 키 관리 함수들
function openApiModal() {
    document.getElementById('api-modal').style.display = 'block';
    
    for (let i = 0; i < 5; i++) {
        const input = document.getElementById(`api-key-${i + 1}`);
        input.value = apiKeys[i] || '';
    }
    
    updateCurrentApiDisplay();
}

function closeApiModal() {
    document.getElementById('api-modal').style.display = 'none';
}

function saveApiKeys() {
    const newApiKeys = [];
    
    for (let i = 0; i < 5; i++) {
        const value = document.getElementById(`api-key-${i + 1}`).value.trim();
        if (value) {
            newApiKeys.push(value);
        }
    }
    
    if (newApiKeys.length === 0) {
        alert('최소 하나의 API 키를 입력해주세요.');
        return;
    }
    
    apiKeys = newApiKeys;
    currentApiIndex = 0;
    
    localStorage.setItem('youtube-api-keys', JSON.stringify(apiKeys));
    localStorage.setItem('youtube-current-api-index', currentApiIndex.toString());
    
    updateApiStatus();
    closeApiModal();
    
    showTemporaryMessage('API 키가 저장되었습니다.');
}

function updateApiStatus() {
    const statusText = document.getElementById('api-status-text');
    if (apiKeys.length > 0) {
        statusText.textContent = `API 키 ${apiKeys.length}개 설정됨 (현재: #${currentApiIndex + 1})`;
        statusText.style.color = '#4caf50';
    } else {
        statusText.textContent = 'API 키 설정 필요';
        statusText.style.color = '#f44336';
    }
}

function updateCurrentApiDisplay() {
    const currentApiSpan = document.getElementById('current-api-index');
    if (apiKeys.length > 0) {
        currentApiSpan.textContent = `#${currentApiIndex + 1} (총 ${apiKeys.length}개)`;
    } else {
        currentApiSpan.textContent = '-';
    }
}

function resetApiRotation() {
    if (apiKeys.length > 0) {
        currentApiIndex = 0;
        localStorage.setItem('youtube-current-api-index', currentApiIndex.toString());
        updateApiStatus();
        updateCurrentApiDisplay();
        showTemporaryMessage('API 순환이 첫 번째 키로 초기화되었습니다.');
    }
}

function getCurrentApiKey() {
    if (apiKeys.length === 0) {
        throw new Error('설정된 API 키가 없습니다.');
    }
    return apiKeys[currentApiIndex];
}

function rotateToNextApiKey() {
    if (apiKeys.length <= 1) {
        throw new Error('사용 가능한 다른 API 키가 없습니다.');
    }
    
    currentApiIndex = (currentApiIndex + 1) % apiKeys.length;
    localStorage.setItem('youtube-current-api-index', currentApiIndex.toString());
    updateApiStatus();
    
    console.log(`API 키 순환: #${currentApiIndex + 1} 사용`);
}

// 핵심 API 호출 함수
async function makeApiRequest(url, retryCount = 0) {
    try {
        console.log(`API 요청: ${url.replace(/key=[^&]+/, 'key=***')}`);
        
        const response = await fetch(url);
        const data = await response.json();
        
        // API 오류 처리
        if (data.error) {
            const errorCode = data.error.code;
            const errorMessage = data.error.message;
            
            console.error(`API 오류 [${errorCode}]: ${errorMessage}`);
            
            // 할당량 초과 오류 처리
            if (errorCode === 403 && 
                (errorMessage.includes('quotaExceeded') || 
                 errorMessage.includes('quota') ||
                 errorMessage.includes('dailyLimitExceeded'))) {
                
                console.log(`API 키 #${currentApiIndex + 1} 할당량 초과`);
                
                if (retryCount < apiKeys.length - 1) {
                    rotateToNextApiKey();
                    const newUrl = url.replace(/key=[^&]+/, `key=${getCurrentApiKey()}`);
                    return await makeApiRequest(newUrl, retryCount + 1);
                } else {
                    throw new Error('모든 API 키의 할당량이 초과되었습니다. 내일 다시 시도해주세요.');
                }
            }
            
            // 잘못된 API 키 오류
            if (errorCode === 400 && errorMessage.includes('keyInvalid')) {
                throw new Error('API 키가 올바르지 않습니다. 설정을 확인해주세요.');
            }
            
            // 기타 오류
            throw new Error(`YouTube API 오류: ${errorMessage}`);
        }
        
        console.log(`API 응답 성공: ${data.items?.length || 0}개 아이템`);
        return data;
        
    } catch (error) {
        if (error.message.includes('할당량') || error.message.includes('API 키')) {
            throw error;
        }
        
        // 네트워크 오류나 기타 오류 시 다음 API 키로 재시도
        if (retryCount < apiKeys.length - 1) {
            console.log(`API 키 #${currentApiIndex + 1}에서 오류 발생, 다음 키로 시도`);
            rotateToNextApiKey();
            const newUrl = url.replace(/key=[^&]+/, `key=${getCurrentApiKey()}`);
            return await makeApiRequest(newUrl, retryCount + 1);
        }
        
        throw new Error(`API 요청 실패: ${error.message}`);
    }
}

// 채널 정보 가져오기
async function fetchChannelInfo(channelId) {
    try {
        console.log(`채널 정보 요청: ${channelId}`);
        
        if (!isValidChannelId(channelId)) {
            throw new Error(`잘못된 채널 ID 형식: ${channelId}`);
        }
        
        const url = `https://www.googleapis.com/youtube/v3/channels?` +
            `part=snippet,statistics&id=${channelId}&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(url);
        
        if (!data.items || data.items.length === 0) {
            throw new Error(`채널 ID "${channelId}"를 찾을 수 없습니다.`);
        }
        
        const channelInfo = data.items[0];
        console.log(`채널 정보 획득 성공: ${channelInfo.snippet.title}`);
        
        return channelInfo;
        
    } catch (error) {
        console.error('채널 정보 가져오기 오류:', error);
        throw error;
    }
}

// 채널의 최신 영상 가져오기
async function fetchLatestVideo(channelId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&channelId=${channelId}&type=video&order=date&maxResults=10&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(url);
        
        if (!data.items || data.items.length === 0) {
            return null;
        }
        
        // 롱폼 영상 찾기
        for (const video of data.items) {
            try {
                const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
                    `part=statistics,snippet,contentDetails&id=${video.id.videoId}&key=${getCurrentApiKey()}`;
                
                const detailsData = await makeApiRequest(detailsUrl);
                
                if (detailsData.items && detailsData.items.length > 0) {
                    const videoDetails = detailsData.items[0];
                    const duration = videoDetails.contentDetails.duration;
                    
                    if (!isShorts(duration)) {
                        return {
                            id: video.id.videoId,
                            title: video.snippet.title,
                            publishedAt: video.snippet.publishedAt,
                            viewCount: videoDetails.statistics.viewCount || 0,
                            thumbnail: getBestThumbnail(videoDetails.snippet.thumbnails) || getBestThumbnail(video.snippet.thumbnails)
                        };
                    }
                }
            } catch (error) {
                console.log(`영상 ${video.id.videoId} 처리 중 오류:`, error);
                continue;
            }
        }
        
        return null;
        
    } catch (error) {
        console.error(`채널 ${channelId} 최신 영상 검색 오류:`, error);
        return null;
    }
}

// 채널명으로 검색
async function searchChannelsByName(channelName) {
    try {
        console.log(`채널 검색 시작: "${channelName}"`);
        
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=channel&q=${encodeURIComponent(channelName)}&maxResults=10&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(searchUrl);
        
        console.log(`검색 결과: ${data.items?.length || 0}개 채널 발견`);
        
        if (data.items && data.items.length > 0) {
            data.items.forEach((item, index) => {
                console.log(`${index + 1}. ${item.snippet.title} (ID: ${item.id.channelId})`);
            });
        }
        
        return data.items || [];
        
    } catch (error) {
        console.error('채널명 검색 오류:', error);
        throw error;
    }
}

// 채널 입력 해석 (ID, URL, 핸들 등)
async function resolveChannelInput(input) {
    try {
        if (isChannelId(input)) {
            await fetchChannelInfo(input);
            return input;
        }
        
        if (isChannelUrl(input)) {
            return await extractChannelIdFromUrl(input);
        }
        
        console.log(`채널명으로 검색: "${input}"`);
        const searchResults = await searchChannelsByName(input);
        
        if (searchResults.length === 0) {
            throw new Error(`"${input}" 채널을 찾을 수 없습니다.`);
        }
        
        const exactMatch = searchResults.find(channel => 
            channel.snippet.title.toLowerCase().trim() === input.toLowerCase().trim()
        );
        
        if (exactMatch) {
            console.log(`정확한 매치 발견: ${exactMatch.snippet.title}`);
            return exactMatch.id.channelId;
        }
        
        const partialMatch = searchResults.find(channel => 
            channel.snippet.title.toLowerCase().includes(input.toLowerCase()) ||
            input.toLowerCase().includes(channel.snippet.title.toLowerCase())
        );
        
        if (partialMatch) {
            console.log(`부분 매치 발견: ${partialMatch.snippet.title}`);
            return partialMatch.id.channelId;
        }
        
        console.log(`첫 번째 결과 사용: ${searchResults[0].snippet.title}`);
        return searchResults[0].id.channelId;
        
    } catch (error) {
        console.error('채널 입력 해석 오류:', error);
        throw error;
    }
}

// URL에서 채널 ID 추출
async function extractChannelIdFromUrl(url) {
    const handleMatch = url.match(/youtube\.com\/@([^\/\?&]+)/);
    if (handleMatch) {
        const handle = handleMatch[1];
        return await getChannelIdByHandle(handle);
    }
    
    const channelIdMatch = url.match(/youtube\.com\/channel\/([^\/\?&]+)/);
    if (channelIdMatch) {
        return channelIdMatch[1];
    }
    
    const customMatch = url.match(/youtube\.com\/c\/([^\/\?&]+)/);
    if (customMatch) {
        const customName = customMatch[1];
        return await getChannelIdByCustomName(customName);
    }
    
    const userMatch = url.match(/youtube\.com\/user\/([^\/\?&]+)/);
    if (userMatch) {
        const username = userMatch[1];
        return await getChannelIdByUsername(username);
    }
    
    throw new Error('지원하지 않는 URL 형식입니다.');
}

// 핸들로 채널 ID 찾기
async function getChannelIdByHandle(handle) {
    try {
        const cleanHandle = decodeURIComponent(handle.replace('@', ''));
        console.log(`핸들 검색: "${cleanHandle}"`);
        
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=channel&q=${encodeURIComponent(cleanHandle)}&maxResults=10&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(searchUrl);
        
        if (!data.items || data.items.length === 0) {
            throw new Error(`핸들 "${cleanHandle}"에 해당하는 채널을 찾을 수 없습니다.`);
        }
        
        for (const item of data.items) {
            const channelTitle = item.snippet.title.toLowerCase();
            const searchTerm = cleanHandle.toLowerCase();
            
            if (channelTitle === searchTerm || 
                channelTitle.includes(searchTerm) || 
                searchTerm.includes(channelTitle)) {
                console.log(`핸들 매치 발견: ${item.snippet.title}`);
                return item.id.channelId;
            }
        }
        
        console.log(`첫 번째 핸들 결과 사용: ${data.items[0].snippet.title}`);
        return data.items[0].id.channelId;
        
    } catch (error) {
        console.error('Handle 검색 오류:', error);
        throw error;
    }
}

// 커스텀명으로 채널 ID 찾기
async function getChannelIdByCustomName(customName) {
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=channel&q=${encodeURIComponent(customName)}&maxResults=10&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(searchUrl);
        
        if (!data.items || data.items.length === 0) {
            throw new Error(`채널 "${customName}"을 찾을 수 없습니다.`);
        }
        
        const exactMatch = data.items.find(item => 
            item.snippet.customUrl && item.snippet.customUrl.toLowerCase().includes(customName.toLowerCase())
        );
        
        return exactMatch ? exactMatch.id.channelId : data.items[0].id.channelId;
        
    } catch (error) {
        console.error('커스텀명 검색 오류:', error);
        throw error;
    }
}

// 사용자명으로 채널 ID 찾기
async function getChannelIdByUsername(username) {
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=channel&q=${encodeURIComponent(username)}&maxResults=10&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(searchUrl);
        
        if (!data.items || data.items.length === 0) {
            throw new Error(`사용자 "${username}"을 찾을 수 없습니다.`);
        }
        
        return data.items[0].id.channelId;
        
    } catch (error) {
        console.error('사용자명 검색 오류:', error);
        throw error;
    }
}

// 핫 영상 찾기 (채널 추적용)
async function findHotVideo(channelId, subscriberCount) {
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&channelId=${channelId}&type=video&order=date&maxResults=20&key=${getCurrentApiKey()}`;
        
        const searchData = await makeApiRequest(searchUrl);
        
        if (searchData.items.length === 0) {
            return null;
        }

        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
            `part=statistics,snippet,contentDetails&id=${videoIds}&key=${getCurrentApiKey()}`;
        
        const videosData = await makeApiRequest(videosUrl);

        for (const video of videosData.items) {
            const viewCount = parseInt(video.statistics?.viewCount || 0);
            const ratio = subscriberCount > 0 ? viewCount / subscriberCount : 0;
            const requiredRatio = parseFloat(document.getElementById('hot-video-ratio').value) || 2.0;
						
			if (!isShorts(video.contentDetails.duration) && ratio >= requiredRatio) {
                return {
                    id: video.id,
                    title: video.snippet.title,
                    viewCount: viewCount,
                    publishedAt: video.snippet.publishedAt,
                    ratio: ratio,
                    thumbnail: getBestThumbnail(video.snippet.thumbnails)
                };
            }
        }

        return null;
        
    } catch (error) {
        console.error(`채널 ${channelId} 핫 영상 검색 오류:`, error);
        return null;
    }
}

// 영상 검색 (검색 탭용)
async function performVideoSearch(keyword, params) {
    let publishedAfter, publishedBefore;
    
    if (params.dateRangeType === 'custom') {
        if (params.startDate) {
            publishedAfter = new Date(params.startDate).toISOString();
        }
        if (params.endDate) {
            const endDateObj = new Date(params.endDate);
            endDateObj.setHours(23, 59, 59, 999);
            publishedBefore = endDateObj.toISOString();
        }
    } else {
        publishedAfter = getDateFilter(params.dateRange);
    }
    
    let searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&type=video&q=${encodeURIComponent(keyword)}&` +
        `maxResults=50&key=${getCurrentApiKey()}`;
    
    if (publishedAfter) {
        searchUrl += `&publishedAfter=${publishedAfter}`;
    }
    if (publishedBefore) {
        searchUrl += `&publishedBefore=${publishedBefore}`;
    }
    
    const searchData = await makeApiRequest(searchUrl);
    
    if (searchData.items.length === 0) {
        return [];
    }
    
    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
        `part=statistics,snippet,contentDetails&id=${videoIds}&key=${getCurrentApiKey()}`;
    
    const videosData = await makeApiRequest(videosUrl);
    
    const filteredVideos = [];
    for (const video of videosData.items) {
        const duration = video.contentDetails?.duration;
        if (!isShorts(duration)) {
            filteredVideos.push(video);
        }
    }
    
    if (filteredVideos.length === 0) {
        return [];
    }
    
    const channelIds = [...new Set(filteredVideos.map(item => item.snippet.channelId))];
    const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?` +
        `part=statistics&id=${channelIds.join(',')}&key=${getCurrentApiKey()}`;
    
    const channelsData = await makeApiRequest(channelsUrl);
    
    const channelMap = {};
    channelsData.items.forEach(channel => {
        channelMap[channel.id] = channel.statistics;
    });
    
    let results = filteredVideos.map(video => {
        const channelStats = channelMap[video.snippet.channelId];
        const subscriberCount = parseInt(channelStats?.subscriberCount || 0);
        const viewCount = parseInt(video.statistics?.viewCount || 0);
        
        return {
            id: video.id,
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            publishedAt: video.snippet.publishedAt,
            viewCount: viewCount,
            subscriberCount: subscriberCount,
            thumbnail: getBestThumbnail(video.snippet.thumbnails),
            ratio: subscriberCount > 0 ? viewCount / subscriberCount : 0
        };
    });
    
    results = results.filter(video => {
        return video.subscriberCount >= params.subMin && 
               video.viewCount >= params.viewMin;
    });
    
    results.sort((a, b) => {
        switch (params.sortOrder) {
            case 'ratio':
                return b.ratio - a.ratio;
            case 'viewCount':
                return b.viewCount - a.viewCount;
            case 'subscriberCount':
                return b.subscriberCount - a.subscriberCount;
            case 'publishedAt':
                return new Date(b.publishedAt) - new Date(a.publishedAt);
            default:
                return b.ratio - a.ratio;
        }
    });
    
    return results;
}

// API 할당량 상태 확인
async function checkApiQuotaStatus() {
    const quotaStatus = {};
    
    for (let i = 0; i < apiKeys.length; i++) {
        try {
            // 간단한 API 호출로 할당량 확인
            const testUrl = `https://www.googleapis.com/youtube/v3/channels?` +
                `part=snippet&mine=true&key=${apiKeys[i]}`;
            
            await fetch(testUrl);
            quotaStatus[i] = 'available';
        } catch (error) {
            if (error.message.includes('quota')) {
                quotaStatus[i] = 'exceeded';
            } else {
                quotaStatus[i] = 'error';
            }
        }
    }
    
    return quotaStatus;
}

// script-api.js에 추가할 함수들

// API 키 파일 가져오기
function importApiKeysFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json,.csv';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                const importedKeys = parseApiKeyFile(content, file.name);
                
                if (importedKeys.length === 0) {
                    throw new Error('파일에서 유효한 API 키를 찾을 수 없습니다.');
                }
                
                // 기존 키와 합치기 또는 교체
                const action = confirm(
                    `${importedKeys.length}개의 API 키를 발견했습니다.\n\n` +
                    `확인: 기존 키에 추가\n` +
                    `취소: 기존 키를 모두 교체`
                );
                
                if (action) {
                    // 기존 키에 추가 (중복 제거)
                    const allKeys = [...apiKeys, ...importedKeys];
                    apiKeys = [...new Set(allKeys)]; // 중복 제거
                } else {
                    // 기존 키 교체
                    apiKeys = importedKeys;
                }
                
                currentApiIndex = 0;
                
                // 저장 및 UI 업데이트
                localStorage.setItem('youtube-api-keys', JSON.stringify(apiKeys));
                localStorage.setItem('youtube-current-api-index', currentApiIndex.toString());
                
                updateApiStatus();
                updateApiInputsFromArray();
                
                showTemporaryMessage(
                    `${apiKeys.length}개의 API 키가 로드되었습니다!`, 
                    'success'
                );
                
            } catch (error) {
                console.error('API 키 파일 읽기 오류:', error);
                alert(`파일을 읽을 수 없습니다: ${error.message}`);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// API 키 파일 파싱
function parseApiKeyFile(content, filename) {
    const keys = [];
    const extension = filename.toLowerCase().split('.').pop();
    
    try {
        if (extension === 'json') {
            // JSON 파일 처리
            const jsonData = JSON.parse(content);
            
            if (Array.isArray(jsonData)) {
                // ["key1", "key2", "key3"] 형태
                keys.push(...jsonData.filter(key => isValidApiKey(key)));
            } else if (jsonData.apiKeys && Array.isArray(jsonData.apiKeys)) {
                // {"apiKeys": ["key1", "key2"]} 형태
                keys.push(...jsonData.apiKeys.filter(key => isValidApiKey(key)));
            } else if (typeof jsonData === 'object') {
                // {"key1": "...", "key2": "..."} 형태
                Object.values(jsonData).forEach(value => {
                    if (isValidApiKey(value)) {
                        keys.push(value);
                    }
                });
            }
        } else {
            // TXT, CSV 파일 처리
            const lines = content.split(/\r?\n/);
            
            lines.forEach(line => {
                const trimmed = line.trim();
                
                // CSV 처리 (쉼표로 분리)
                if (trimmed.includes(',')) {
                    const csvKeys = trimmed.split(',').map(k => k.trim());
                    csvKeys.forEach(key => {
                        if (isValidApiKey(key)) {
                            keys.push(key);
                        }
                    });
                } else if (isValidApiKey(trimmed)) {
                    // 일반 텍스트 (한 줄에 하나씩)
                    keys.push(trimmed);
                }
            });
        }
    } catch (error) {
        throw new Error(`파일 형식 오류: ${error.message}`);
    }
    
    return keys;
}

// API 키 유효성 검사
function isValidApiKey(key) {
    if (!key || typeof key !== 'string') return false;
    
    // Google API 키 형식: AIza로 시작하고 39자
    return /^AIza[0-9A-Za-z-_]{35}$/.test(key.trim());
}

// API 키 배열을 입력 필드에 반영
function updateApiInputsFromArray() {
    // 기존 입력 필드들 초기화
    for (let i = 1; i <= 5; i++) {
        const input = document.getElementById(`api-key-${i}`);
        if (input) {
            input.value = apiKeys[i-1] || '';
        }
    }
    
    // 추가 키들이 있으면 표시
    if (apiKeys.length > 5) {
        updateAdditionalKeysDisplay();
    }
}

// 5개 초과 키들 표시
function updateAdditionalKeysDisplay() {
    const additionalKeys = apiKeys.slice(5);
    if (additionalKeys.length === 0) return;
    
    // 추가 키 표시 영역이 없으면 생성
    let additionalContainer = document.getElementById('additional-api-keys');
    if (!additionalContainer) {
        additionalContainer = document.createElement('div');
        additionalContainer.id = 'additional-api-keys';
        additionalContainer.style.cssText = `
            margin-top: 1rem;
            padding: 1rem;
            background: rgba(118, 75, 162, 0.1);
            border-radius: 8px;
            border: 1px solid rgba(118, 75, 162, 0.2);
        `;
        
        const apiInputs = document.querySelector('.api-inputs');
        if (apiInputs) {
            apiInputs.appendChild(additionalContainer);
        }
    }
    
    additionalContainer.innerHTML = `
        <h4 style="margin: 0 0 0.5rem 0; color: #333;">추가 API 키 (${additionalKeys.length}개)</h4>
        <div style="max-height: 150px; overflow-y: auto;">
            ${additionalKeys.map((key, index) => `
                <div style="margin-bottom: 0.25rem; font-family: monospace; font-size: 0.8rem; color: #666;">
                    ${index + 6}. ${key.substring(0, 20)}...${key.substring(key.length - 5)}
                </div>
            `).join('')}
        </div>
    `;
}

// API 키 내보내기
function exportApiKeys() {
    if (apiKeys.length === 0) {
        alert('내보낼 API 키가 없습니다.');
        return;
    }
    
    const exportData = {
        exportDate: new Date().toISOString(),
        totalKeys: apiKeys.length,
        currentKey: currentApiIndex + 1,
        apiKeys: apiKeys
    };
    
    // 파일 형식 선택
    const format = prompt(
        '내보낼 파일 형식을 선택하세요:\n\n' +
        '1 - JSON 형식 (권장)\n' +
        '2 - 텍스트 형식 (한 줄에 하나씩)\n' +
        '3 - CSV 형식 (쉼표로 구분)\n\n' +
        '번호를 입력하세요 (1-3):'
    );
    
    let content, filename, mimeType;
    
    switch(format) {
        case '2':
            content = apiKeys.join('\n');
            filename = 'youtube_api_keys.txt';
            mimeType = 'text/plain';
            break;
        case '3':
            content = apiKeys.join(',');
            filename = 'youtube_api_keys.csv';
            mimeType = 'text/csv';
            break;
        case '1':
        default:
            content = JSON.stringify(exportData, null, 2);
            filename = 'youtube_api_keys.json';
            mimeType = 'application/json';
    }
    
    // 파일 다운로드
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showTemporaryMessage(`${apiKeys.length}개의 API 키가 내보내기되었습니다.`, 'success');
}

// API 키 일괄 테스트
async function testAllApiKeys() {
    if (apiKeys.length === 0) {
        alert('테스트할 API 키가 없습니다.');
        return;
    }
    
    showLoading(true);
    
    const results = [];
    let workingCount = 0;
    
    for (let i = 0; i < apiKeys.length; i++) {
        try {
            // 간단한 API 호출로 테스트
            const testUrl = `https://www.googleapis.com/youtube/v3/videos?` +
                `part=snippet&chart=mostPopular&regionCode=KR&maxResults=1&key=${apiKeys[i]}`;
            
            const response = await fetch(testUrl);
            const data = await response.json();
            
            if (data.error) {
                results.push({
                    index: i + 1,
                    key: apiKeys[i].substring(0, 20) + '...',
                    status: 'error',
                    message: data.error.message
                });
            } else {
                results.push({
                    index: i + 1,
                    key: apiKeys[i].substring(0, 20) + '...',
                    status: 'working',
                    message: '정상 작동'
                });
                workingCount++;
            }
        } catch (error) {
            results.push({
                index: i + 1,
                key: apiKeys[i].substring(0, 20) + '...',
                status: 'error',
                message: '네트워크 오류'
            });
        }
    }
    
    showLoading(false);
    
    // 결과 표시
    const resultText = results.map(r => 
        `${r.index}. ${r.key} - ${r.status === 'working' ? '✅' : '❌'} ${r.message}`
    ).join('\n');
    
    alert(
        `API 키 테스트 완료\n\n` +
        `총 ${apiKeys.length}개 중 ${workingCount}개 정상 작동\n\n` +
        `상세 결과:\n${resultText}`
    );
}

// API 키 통계
function getApiKeyStats() {
    return {
        total: apiKeys.length,
        current: currentApiIndex + 1,
        estimated_daily_quota: apiKeys.length * 10000,
        estimated_tests_per_day: Math.floor(apiKeys.length * 10000 / 20) // 테스트당 약 20단위 사용
    };
}


// ========== script-channels.js ==========
// ============================================
// script-channels.js - 채널 관리 함수들
// ============================================

// 채널 모달 관리
function openChannelModal(type = 'general') {
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }
    
    const maxChannels = 20;
    let currentChannels;
    
    switch(type) {
        case 'monitoring':
            currentChannels = monitoringChannels;
            break;
        case 'tracking':
            currentChannels = trackingChannels;
            break;
        default:
            currentChannels = channels;
    }
    
    if (currentChannels.length >= maxChannels) {
        alert(`최대 ${maxChannels}개의 채널만 추가할 수 있습니다.`);
        return;
    }
    
    // 모달에 타입 정보 저장
    document.getElementById('channel-modal').dataset.channelType = type;
    document.getElementById('channel-modal').style.display = 'block';
    document.getElementById('channel-input').value = '';
    document.getElementById('channel-input').focus();
}

function closeChannelModal() {
    document.getElementById('channel-modal').style.display = 'none';
}

function closeChannelSelectionModal() {
    document.getElementById('channel-selection-modal').style.display = 'none';
    channelSearchResults = [];
}

// 채널 입력 처리
async function handleChannelInput() {
    const input = document.getElementById('channel-input').value.trim();
    if (!input) {
        alert('채널명, URL, 또는 ID를 입력해주세요.');
        return;
    }
    
    showLoading(true);
    
    try {
        if (isChannelId(input) || isChannelUrl(input)) {
            await addChannelDirectly(input);
            return;
        }
        
        await searchAndShowChannelSelection(input);
        
    } catch (error) {
        console.error('채널 입력 처리 오류:', error);
        let errorMessage = '채널 정보를 가져올 수 없습니다.';
        
        if (error.message.includes('quotaExceeded') || error.message.includes('quota')) {
            errorMessage = 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('찾을 수 없습니다')) {
            errorMessage = '입력한 채널을 찾을 수 없습니다. 채널명, URL 또는 ID를 다시 확인해주세요.';
        } else if (error.message.includes('keyInvalid')) {
            errorMessage = 'API 키가 올바르지 않습니다. 설정을 확인해주세요.';
        }
        
        alert(errorMessage);
    } finally {
        showLoading(false);
    }
}

// 채널명으로 검색하고 선택 모달 표시
async function searchAndShowChannelSelection(channelName) {
    console.log(`채널 검색 시작: "${channelName}"`);
    
    const searchResults = await searchChannelsByName(channelName);
    
    if (searchResults.length === 0) {
        throw new Error(`"${channelName}" 채널을 찾을 수 없습니다.`);
    }
    
    const exactMatches = searchResults.filter(channel => 
        channel.snippet.title.toLowerCase().trim() === channelName.toLowerCase().trim()
    );
    
    if (exactMatches.length === 1) {
        await addChannelById(exactMatches[0].id.channelId);
        return;
    }
    
    channelSearchResults = searchResults;
    await showChannelSelectionModal(searchResults);
}

// 채널 선택 모달 표시
async function showChannelSelectionModal(searchResults) {
    const modal = document.getElementById('channel-selection-modal');
    const listContainer = document.getElementById('channel-selection-list');
    
    listContainer.innerHTML = `
        <div class="channel-selection-loading">
            <div class="loading-spinner"></div>
            <p>채널 정보를 불러오는 중...</p>
        </div>
    `;
    
    modal.style.display = 'block';
    closeChannelModal();
    
    try {
        const channelDetails = await Promise.all(
            searchResults.map(async (channel) => {
                try {
                    const channelInfo = await fetchChannelInfo(channel.id.channelId);
                    return {
                        ...channel,
                        details: channelInfo
                    };
                } catch (error) {
                    console.error(`채널 ${channel.id.channelId} 정보 가져오기 실패:`, error);
                    return channel;
                }
            })
        );
        
        listContainer.innerHTML = channelDetails.map((channel, index) => {
            const details = channel.details;
            const subscriberCount = details ? parseInt(details.statistics?.subscriberCount || 0) : 0;
            const description = details ? details.snippet?.description || '' : channel.snippet.description || '';
            const thumbnail = details ? getBestThumbnail(details.snippet?.thumbnails) : getBestThumbnail(channel.snippet.thumbnails);
            
            return `
                <div class="channel-selection-item" onclick="selectChannel(${index})">
                    ${thumbnail ? `
                        <img src="${thumbnail}" 
                             alt="${channel.snippet.title}" 
                             class="channel-selection-thumbnail"
                             onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
                             onload="this.nextElementSibling.style.display='none';">
                        <div class="channel-selection-thumbnail-placeholder" style="display: none;">📺</div>
                    ` : `
                        <div class="channel-selection-thumbnail-placeholder">📺</div>
                    `}
                    <div class="channel-selection-info">
                        <div class="channel-selection-name">${channel.snippet.title}</div>
                        <div class="channel-selection-meta">
                            ${subscriberCount > 0 ? `
                                <div class="channel-selection-subscribers">구독자 ${formatNumber(subscriberCount)}명</div>
                            ` : ''}
                            ${description ? `
                                <div class="channel-selection-description">${description.substring(0, 100)}${description.length > 100 ? '...' : ''}</div>
                            ` : ''}
                            <div class="channel-selection-id">${channel.id.channelId}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('채널 상세 정보 로딩 오류:', error);
        listContainer.innerHTML = searchResults.map((channel, index) => `
            <div class="channel-selection-item" onclick="selectChannel(${index})">
                <div class="channel-selection-thumbnail-placeholder">📺</div>
                <div class="channel-selection-info">
                    <div class="channel-selection-name">${channel.snippet.title}</div>
                    <div class="channel-selection-meta">
                        <div class="channel-selection-description">${channel.snippet.description || '설명 없음'}</div>
                        <div class="channel-selection-id">${channel.id.channelId}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// 채널 선택 처리
async function selectChannel(index) {
    const selectedChannel = channelSearchResults[index];
    if (!selectedChannel) return;
    
    document.querySelectorAll('.channel-selection-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    setTimeout(async () => {
        closeChannelSelectionModal();
        showLoading(true);
        
        try {
            await addChannelById(selectedChannel.id.channelId);
            showTemporaryMessage(`채널 "${selectedChannel.snippet.title}"이 추가되었습니다!`);
        } catch (error) {
            console.error('채널 추가 오류:', error);
            alert('채널 추가 중 오류가 발생했습니다: ' + error.message);
        } finally {
            showLoading(false);
        }
    }, 300);
}

// 채널 ID로 직접 추가
async function addChannelById(channelId) {
    const channelType = document.getElementById('channel-modal').dataset.channelType || 'general';
    let targetChannels, storageKey, renderFunction;
    
    switch(channelType) {
        case 'monitoring':
            targetChannels = monitoringChannels;
            storageKey = 'youtube-monitoring-channels';
            renderFunction = renderMonitoringChannelGrid;
            break;
        case 'tracking':
            targetChannels = trackingChannels;
            storageKey = 'youtube-tracking-channels-storage';
            renderFunction = renderTrackingChannelGrid;
            break;
        default:
            targetChannels = channels;
            storageKey = 'youtube-channels';
            renderFunction = renderChannelGrid;
    }
    
    // 중복 체크
    if (targetChannels.find(ch => ch.id === channelId)) {
        alert('이미 추가된 채널입니다.');
        return;
    }
    
    // 모든 채널 목록에서 중복 체크
    const allChannels = [...channels, ...monitoringChannels, ...trackingChannels];
    const existingChannel = allChannels.find(ch => ch.id === channelId);
    
    if (existingChannel && channelType !== 'general') {
        if (confirm(`"${existingChannel.name}" 채널이 다른 목록에 이미 있습니다. 그래도 추가하시겠습니까?`)) {
            // 기존 채널 정보를 복사해서 사용
            const channel = {
                ...existingChannel,
                addedAt: new Date().toISOString()
            };
            
            targetChannels.push(channel);
            
            if (channelType === 'tracking') {
                selectedTrackingChannels.add(channel.id);
                localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
            }
            
            localStorage.setItem(storageKey, JSON.stringify(targetChannels));
            renderFunction();
            renderTrackingChannelSelection();
            updateChannelCounts();
            updateEmptyState();
            return;
        } else {
            return;
        }
    }
    
    const channelInfo = await fetchChannelInfo(channelId);
    const latestVideo = await fetchLatestVideo(channelId);
    
    const channel = {
        id: channelId,
        name: channelInfo.snippet.title,
        subscriberCount: parseInt(channelInfo.statistics.subscriberCount) || 0,
        thumbnail: getBestThumbnail(channelInfo.snippet.thumbnails),
        latestVideo: latestVideo,
        addedAt: new Date().toISOString()
    };
    
    targetChannels.push(channel);

    // 추적 채널인 경우 자동 선택
    if (channelType === 'tracking') {
        selectedTrackingChannels.add(channel.id);
        localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
    }

    localStorage.setItem(storageKey, JSON.stringify(targetChannels));
    
    renderFunction();
    renderTrackingChannelSelection();
    updateChannelCounts();
    updateEmptyState();
}

// 채널 ID나 URL로 직접 추가
async function addChannelDirectly(input) {
    const channelId = await resolveChannelInput(input);
    
    if (!channelId) {
        throw new Error('채널을 찾을 수 없습니다.');
    }
    
    await addChannelById(channelId);
    closeChannelModal();
    
    const channelInfo = await fetchChannelInfo(channelId);
    showTemporaryMessage(`채널 "${channelInfo.snippet.title}"이 추가되었습니다!`);
}

// 채널 그리드 렌더링 함수들
function renderMonitoringChannelGrid() {
    const channelGrid = document.getElementById('monitoring-channel-grid');
    const channelCountSpan = document.getElementById('monitoring-channel-count');
    
    if (channelCountSpan) {
        channelCountSpan.textContent = monitoringChannels.length;
    }
    
    if (monitoringChannels.length === 0) {
        channelGrid.innerHTML = `
            <div class="channel-grid-empty">
                <p>등록된 모니터링 채널이 없습니다</p>
                <button class="btn btn-primary" onclick="openChannelModal('monitoring')">
                    첫 번째 채널 추가하기
                </button>
            </div>
        `;
        return;
    }
    
    // 구독자 수 내림차순 정렬
    const sortedChannels = [...monitoringChannels].sort((a, b) => b.subscriberCount - a.subscriberCount);
    
    channelGrid.innerHTML = sortedChannels.map(channel => generateChannelItemHTML(channel, 'monitoring')).join('');
    renderLatestVideos();
}

function renderTrackingChannelGrid() {
    const channelGrid = document.getElementById('tracking-channel-grid');
    const channelCountSpan = document.getElementById('tracking-channel-count');
    
    if (channelCountSpan) {
        channelCountSpan.textContent = trackingChannels.length;
    }
    
    if (trackingChannels.length === 0) {
        channelGrid.innerHTML = `
            <div class="channel-grid-empty">
                <p>등록된 추적 채널이 없습니다</p>
                <button class="btn btn-primary" onclick="openChannelModal('tracking')">
                    첫 번째 채널 추가하기
                </button>
            </div>
        `;
        return;
    }
    
    // 구독자 수 내림차순 정렬
    const sortedChannels = [...trackingChannels].sort((a, b) => b.subscriberCount - a.subscriberCount);
    
    channelGrid.innerHTML = sortedChannels.map(channel => generateChannelItemHTML(channel, 'tracking')).join('');
}

function renderChannelGrid() {
    const channelGrid = document.getElementById('channel-grid');
    if (!channelGrid) return;
    
    const channelCountSpan = document.getElementById('channel-count');
    if (channelCountSpan) {
        channelCountSpan.textContent = channels.length;
    }

    if (channels.length === 0) {
        channelGrid.innerHTML = `
            <div class="channel-grid-empty">
                <p>등록된 채널이 없습니다</p>
                <button class="btn btn-primary" onclick="openChannelModal('general')">
                    첫 번째 채널 추가하기
                </button>
            </div>
        `;
        return;
    }

    // 구독자 수 내림차순 정렬
    const sortedChannels = [...channels].sort((a, b) => b.subscriberCount - a.subscriberCount);

    channelGrid.innerHTML = sortedChannels.map(channel => generateChannelItemHTML(channel, 'general')).join('');
}

// 채널 아이템 HTML 생성
function generateChannelItemHTML(channel, type) {
    const growthHTML = getSubscriberGrowthHTML(channel.id, channel.subscriberCount);
    const statusInfo = getChannelStatusInfo(channel);
    
    return `
        <div class="channel-item" data-channel-id="${channel.id}">
            <div class="channel-item-header">
                <div class="channel-info-with-logo">
                    ${channel.thumbnail ? `
                        <img src="${channel.thumbnail}" 
                             alt="${channel.name}" 
                             class="channel-logo"
                             onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
                             onload="this.nextElementSibling.style.display='none';">
                        <div class="channel-logo-placeholder" style="display: none;">📺</div>
                    ` : `
                        <div class="channel-logo-placeholder">📺</div>
                    `}
                    <div class="channel-text-info">
                        <h4 class="channel-name" onclick="openChannel('${channel.id}')" title="채널로 이동">${channel.name}</h4>
                        <span class="channel-subscribers">
                            구독자 ${formatNumber(channel.subscriberCount)}명
                            ${growthHTML}
                        </span>
                    </div>
                </div>
                <div class="channel-actions">
                    <button class="btn-icon edit" onclick="editChannel('${channel.id}', '${type}')" title="채널 정보 새로고침">
                        🔄
                    </button>
                    <button class="btn-icon delete" onclick="removeChannelFromGrid('${channel.id}', '${type}')" title="채널 삭제">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="channel-info">
                <span class="channel-added">${getTimeAgo(channel.addedAt || new Date().toISOString())}</span>
                <span class="channel-updated">${channel.updatedAt ? '업데이트: ' + getTimeAgo(channel.updatedAt) : ''}</span>
            </div>
            <div class="channel-id">${channel.id}</div>
            <div class="channel-status">
                <div class="status-indicator ${statusInfo.class}"></div>
                <span>${statusInfo.text}</span>
            </div>
            ${generateLatestVideoHTML(channel.latestVideo)}
        </div>
    `;
}

// 최신 영상 HTML 생성
function generateLatestVideoHTML(latestVideo) {
    if (!latestVideo) {
        return `<div class="channel-latest-video">최신 영상 없음</div>`;
    }
    
    return `
        <div class="channel-latest-video">
            <div class="latest-video-info" onclick="openVideo('${latestVideo.id}')" title="영상 보기">
                <div class="latest-video-title">${latestVideo.title}</div>
                <div class="latest-video-stats">
                    <span>👁️ ${formatNumber(latestVideo.viewCount)}</span>
                    <span>📅 ${formatDate(latestVideo.publishedAt)}</span>
                </div>
            </div>
        </div>
    `;
}

// 채널 상태 정보 가져오기
function getChannelStatusInfo(channel) {
    if (!channel.id || !isValidChannelId(channel.id)) {
        return { class: 'error', text: '잘못된 채널 ID' };
    }
    if (channel.subscriberCount > 0) {
        return { class: '', text: '정상' };
    }
    return { class: 'unknown', text: '확인 필요' };
}

// 채널 삭제
function removeChannelFromGrid(channelId, type = 'general') {
    let targetChannels, storageKey, renderFunction;
    
    switch(type) {
        case 'monitoring':
            targetChannels = monitoringChannels;
            storageKey = 'youtube-monitoring-channels';
            renderFunction = renderMonitoringChannelGrid;
            break;
        case 'tracking':
            targetChannels = trackingChannels;
            storageKey = 'youtube-tracking-channels-storage';
            renderFunction = renderTrackingChannelGrid;
            break;
        default:
            targetChannels = channels;
            storageKey = 'youtube-channels';
            renderFunction = renderChannelGrid;
    }
    
    const channel = targetChannels.find(ch => ch.id === channelId);
    if (channel && confirm(`"${channel.name}" 채널을 삭제하시겠습니까?`)) {
        const index = targetChannels.findIndex(ch => ch.id === channelId);
        targetChannels.splice(index, 1);
        
        // 구독자 수 추적에서도 제거
        selectedTrackingChannels.delete(channelId);
        delete subscriberData[channelId];
        
        localStorage.setItem(storageKey, JSON.stringify(targetChannels));
        localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
        localStorage.setItem('youtube-subscriber-data', JSON.stringify(subscriberData));
        
        renderFunction();
        renderTrackingChannelSelection();
        updateSubscriberChart();
        renderSubscriberDataList();
        updateChannelCounts();
        updateEmptyState();
        
        showTemporaryMessage(`"${channel.name}" 채널이 삭제되었습니다.`);
    }
}

// 채널 정보 새로고침
async function editChannel(channelId, type = 'general') {
    let targetChannels;
    
    switch(type) {
        case 'monitoring':
            targetChannels = monitoringChannels;
            break;
        case 'tracking':
            targetChannels = trackingChannels;
            break;
        default:
            targetChannels = channels;
    }
    
    const channel = targetChannels.find(ch => ch.id === channelId);
    if (!channel) return;
    
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }
    
    showLoading(true);
    
    try {
        const channelInfo = await fetchChannelInfo(channelId);
        const latestVideo = await fetchLatestVideo(channelId);
        
        const channelIndex = targetChannels.findIndex(ch => ch.id === channelId);
        targetChannels[channelIndex] = {
            ...targetChannels[channelIndex],
            name: channelInfo.snippet.title,
            subscriberCount: parseInt(channelInfo.statistics.subscriberCount) || 0,
            thumbnail: getBestThumbnail(channelInfo.snippet.thumbnails),
            latestVideo: latestVideo,
            updatedAt: new Date().toISOString()
        };
        
        let storageKey, renderFunction;
        switch(type) {
            case 'monitoring':
                storageKey = 'youtube-monitoring-channels';
                renderFunction = renderMonitoringChannelGrid;
                break;
            case 'tracking':
                storageKey = 'youtube-tracking-channels-storage';
                renderFunction = renderTrackingChannelGrid;
                break;
            default:
                storageKey = 'youtube-channels';
                renderFunction = renderChannelGrid;
        }
        
        localStorage.setItem(storageKey, JSON.stringify(targetChannels));
        renderFunction();
        renderTrackingChannelSelection();
        
        showTemporaryMessage(`"${channelInfo.snippet.title}" 채널 정보가 업데이트되었습니다.`);
        
    } catch (error) {
        console.error('채널 정보 새로고침 오류:', error);
        alert(`채널 정보를 새로고침할 수 없습니다: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// 최신 영상 렌더링
function renderLatestVideos() {
    const container = document.getElementById('latest-videos-container');
    
    if (monitoringChannels.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>모니터링 채널이 없습니다.</p>
                <button class="btn btn-primary" onclick="openChannelModal('monitoring')">
                    채널 추가하기
                </button>
            </div>
        `;
        return;
    }

    // 조회수 내림차순 정렬
    const sortedChannels = [...monitoringChannels].sort((a, b) => {
        const viewCountA = a.latestVideo ? parseInt(a.latestVideo.viewCount) || 0 : 0;
        const viewCountB = b.latestVideo ? parseInt(b.latestVideo.viewCount) || 0 : 0;
        return viewCountB - viewCountA;
    });

    container.innerHTML = sortedChannels.map(channel => {
        if (!channel.latestVideo) {
            return `
                <div class="video-card no-video">
                    <div class="video-thumbnail-placeholder-large">📺</div>
                    <div class="video-details">
                        <h3 class="video-title-inline">${channel.name}</h3>
                        <p class="video-channel">최신 영상 없음</p>
                        <div class="video-stats">
                            <span>구독자 ${formatNumber(channel.subscriberCount)}명</span>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="video-card" onclick="openVideo('${channel.latestVideo.id}')">
                ${channel.latestVideo.thumbnail ? `
                    <img src="${channel.latestVideo.thumbnail}" alt="${channel.latestVideo.title}" class="video-thumbnail">
                ` : `
                    <div class="video-thumbnail-placeholder-large">🎥</div>
                `}
                <div class="video-details">
                    <h3 class="video-title-inline">${channel.latestVideo.title}</h3>
                    <p class="video-channel">${channel.name}</p>
                    <div class="video-stats">
                        <span>👁️ ${formatNumber(channel.latestVideo.viewCount)}</span>
                        <span>👥 ${formatNumber(channel.subscriberCount)}</span>
                        <span>📅 ${formatDate(channel.latestVideo.publishedAt)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 채널 수 업데이트
function updateChannelCounts() {
    const channelCount = document.getElementById('channel-count');
    const monitoringChannelCount = document.getElementById('monitoring-channel-count');
    const trackingChannelCount = document.getElementById('tracking-channel-count');
    
    if (channelCount) channelCount.textContent = channels.length;
    if (monitoringChannelCount) monitoringChannelCount.textContent = monitoringChannels.length;
    if (trackingChannelCount) trackingChannelCount.textContent = trackingChannels.length;
}

// 접기/펼치기 기능
function toggleChannelManagementSection(type, forceCollapse = false) {
    const grid = document.getElementById(`${type}-channel-grid`);
    const collapseBtn = document.getElementById(`${type}-collapse-btn`);
    const isCurrentlyCollapsed = grid.style.display === 'none';
    
    if (forceCollapse || !isCurrentlyCollapsed) {
        // 접기
        grid.style.display = 'none';
        collapseBtn.textContent = '▶';
        localStorage.setItem(`${type}-channel-management-collapsed`, 'true');
    } else {
        // 펼치기
        grid.style.display = 'grid';
        collapseBtn.textContent = '▼';
        localStorage.setItem(`${type}-channel-management-collapsed`, 'false');
    }
}

// 빈 상태 업데이트
function updateEmptyState() {
    const trackingContainer = document.getElementById('tracking-records');
    if ((monitoringChannels.length > 0 || channels.length > 0) && channelTrackingData.length === 0) {
        trackingContainer.innerHTML = `
            <div class="empty-state">
                <p>채널이 등록되었습니다. 추적을 시작해보세요.</p>
                <button class="btn btn-primary" onclick="document.getElementById('track-channels-btn').click()">
                    첫 번째 추적 시작하기
                </button>
            </div>
        `;
    }
}

// 채널 일괄 새로고침
async function refreshAllChannels(type = 'all') {
    let channelsToRefresh = [];
    
    switch(type) {
        case 'monitoring':
            channelsToRefresh = monitoringChannels;
            break;
        case 'tracking':
            channelsToRefresh = trackingChannels;
            break;
        case 'all':
        default:
            channelsToRefresh = [...channels, ...monitoringChannels, ...trackingChannels];
    }
    
    if (channelsToRefresh.length === 0) {
        alert('새로고침할 채널이 없습니다.');
        return;
    }
    
    if (!confirm(`${channelsToRefresh.length}개 채널의 정보를 모두 새로고침하시겠습니까?`)) {
        return;
    }
    
    showLoading(true);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const channel of channelsToRefresh) {
        try {
            await editChannel(channel.id, determineChannelType(channel.id));
            successCount++;
        } catch (error) {
            console.error(`채널 ${channel.name} 새로고침 실패:`, error);
            errorCount++;
        }
    }
    
    showLoading(false);
    
    if (errorCount > 0) {
        alert(`새로고침 완료: ${successCount}개 성공, ${errorCount}개 실패`);
    } else {
        alert(`${successCount}개 채널의 정보가 모두 새로고침되었습니다.`);
    }
}

// 채널 타입 결정
function determineChannelType(channelId) {
    if (monitoringChannels.find(ch => ch.id === channelId)) return 'monitoring';
    if (trackingChannels.find(ch => ch.id === channelId)) return 'tracking';
    return 'general';
}

// 채널 가져오기/내보내기
function exportChannels(type = 'all') {
    let channelsToExport = [];
    let filename = '';
    
    switch(type) {
        case 'monitoring':
            channelsToExport = monitoringChannels;
            filename = 'monitoring_channels';
            break;
        case 'tracking':
            channelsToExport = trackingChannels;
            filename = 'tracking_channels';
            break;
        case 'all':
        default:
            channelsToExport = {
                general: channels,
                monitoring: monitoringChannels,
                tracking: trackingChannels
            };
            filename = 'all_channels';
    }
    
    if ((Array.isArray(channelsToExport) && channelsToExport.length === 0) || 
        (!Array.isArray(channelsToExport) && Object.values(channelsToExport).every(arr => arr.length === 0))) {
        alert('내보낼 채널이 없습니다.');
        return;
    }
    
    const exportData = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        type: type,
        channels: channelsToExport
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showTemporaryMessage('채널 목록이 내보내기되었습니다.');
}

function importChannels() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importData = JSON.parse(e.target.result);
                
                if (!importData.channels) {
                    throw new Error('올바르지 않은 채널 데이터 형식입니다.');
                }
                
                let importCount = 0;
                
                if (importData.type === 'all') {
                    // 전체 채널 가져오기
                    if (importData.channels.general) {
                        channels.push(...importData.channels.general);
                        localStorage.setItem('youtube-channels', JSON.stringify(channels));
                        importCount += importData.channels.general.length;
                    }
                    if (importData.channels.monitoring) {
                        monitoringChannels.push(...importData.channels.monitoring);
                        localStorage.setItem('youtube-monitoring-channels', JSON.stringify(monitoringChannels));
                        importCount += importData.channels.monitoring.length;
                    }
                    if (importData.channels.tracking) {
                        trackingChannels.push(...importData.channels.tracking);
                        localStorage.setItem('youtube-tracking-channels-storage', JSON.stringify(trackingChannels));
                        importCount += importData.channels.tracking.length;
                    }
                } else {
                    // 특정 타입 채널 가져오기
                    const targetChannels = Array.isArray(importData.channels) ? importData.channels : [];
                    
                    switch(importData.type) {
                        case 'monitoring':
                            monitoringChannels.push(...targetChannels);
                            localStorage.setItem('youtube-monitoring-channels', JSON.stringify(monitoringChannels));
                            break;
                        case 'tracking':
                            trackingChannels.push(...targetChannels);
                            localStorage.setItem('youtube-tracking-channels-storage', JSON.stringify(trackingChannels));
                            break;
                        default:
                            channels.push(...targetChannels);
                            localStorage.setItem('youtube-channels', JSON.stringify(channels));
                    }
                    importCount = targetChannels.length;
                }
                
                // UI 업데이트
                renderChannelGrid();
                renderMonitoringChannelGrid();
                renderTrackingChannelGrid();
                renderTrackingChannelSelection();
                updateChannelCounts();
                
                alert(`${importCount}개의 채널이 가져오기되었습니다.`);
                
            } catch (error) {
                console.error('채널 가져오기 오류:', error);
                alert('채널 파일을 읽을 수 없습니다. 파일이 손상되었거나 올바른 형식이 아닙니다.');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// 채널 검색 및 필터링
function searchChannelsInGrid(searchTerm, type = 'all') {
    const term = searchTerm.toLowerCase();
    let channelsToSearch = [];
    
    switch(type) {
        case 'monitoring':
            channelsToSearch = monitoringChannels;
            break;
        case 'tracking':
            channelsToSearch = trackingChannels;
            break;
        case 'all':
        default:
            channelsToSearch = [...channels, ...monitoringChannels, ...trackingChannels];
    }
    
    return channelsToSearch.filter(channel => 
        channel.name.toLowerCase().includes(term) ||
        channel.id.toLowerCase().includes(term) ||
        (channel.latestVideo && channel.latestVideo.title.toLowerCase().includes(term))
    );
}

// 채널 통계 정보
function getChannelStatistics(type = 'all') {
    let channelsToAnalyze = [];
    
    switch(type) {
        case 'monitoring':
            channelsToAnalyze = monitoringChannels;
            break;
        case 'tracking':
            channelsToAnalyze = trackingChannels;
            break;
        case 'all':
        default:
            channelsToAnalyze = [...channels, ...monitoringChannels, ...trackingChannels];
    }
    
    if (channelsToAnalyze.length === 0) {
        return null;
    }
    
    const subscribers = channelsToAnalyze.map(ch => ch.subscriberCount).filter(count => count > 0);
    const totalSubscribers = subscribers.reduce((sum, count) => sum + count, 0);
    const avgSubscribers = Math.round(totalSubscribers / subscribers.length);
    
    const withLatestVideo = channelsToAnalyze.filter(ch => ch.latestVideo).length;
    const videoPercentage = Math.round((withLatestVideo / channelsToAnalyze.length) * 100);
    
    const categoryDistribution = {};
    channelsToAnalyze.forEach(channel => {
        const range = getSubscriberRange(channel.subscriberCount);
        categoryDistribution[range] = (categoryDistribution[range] || 0) + 1;
    });
    
    return {
        totalChannels: channelsToAnalyze.length,
        totalSubscribers: totalSubscribers,
        averageSubscribers: avgSubscribers,
        channelsWithVideo: withLatestVideo,
        videoPercentage: videoPercentage,
        categoryDistribution: categoryDistribution
    };
}

// 구독자 수 범위 계산
function getSubscriberRange(count) {
    if (count < 1000) return '1천명 미만';
    if (count < 10000) return '1천-1만명';
    if (count < 100000) return '1만-10만명';
    if (count < 1000000) return '10만-100만명';
    if (count < 10000000) return '100만-1천만명';
    return '1천만명 이상';
}

// 중복 채널 제거
function removeDuplicateChannels() {
    const allChannelArrays = [
        { channels: channels, key: 'youtube-channels', name: '일반' },
        { channels: monitoringChannels, key: 'youtube-monitoring-channels', name: '모니터링' },
        { channels: trackingChannels, key: 'youtube-tracking-channels-storage', name: '추적' }
    ];
    
    let totalRemoved = 0;
    const seenIds = new Set();
    
    allChannelArrays.forEach(({ channels, key, name }) => {
        const originalLength = channels.length;
        const uniqueChannels = [];
        
        channels.forEach(channel => {
            if (!seenIds.has(channel.id)) {
                seenIds.add(channel.id);
                uniqueChannels.push(channel);
            }
        });
        
        const removed = originalLength - uniqueChannels.length;
        if (removed > 0) {
            channels.length = 0;
            channels.push(...uniqueChannels);
            localStorage.setItem(key, JSON.stringify(channels));
            totalRemoved += removed;
            console.log(`${name} 채널에서 ${removed}개 중복 제거`);
        }
    });
    
    if (totalRemoved > 0) {
        renderChannelGrid();
        renderMonitoringChannelGrid();
        renderTrackingChannelGrid();
        updateChannelCounts();
        
        showTemporaryMessage(`총 ${totalRemoved}개의 중복 채널이 제거되었습니다.`);
    } else {
        showTemporaryMessage('중복된 채널이 없습니다.');
    }
}

// 채널 추적 관련 함수들
async function startChannelTracking() {
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }

    // 모니터링 채널이 있으면 모니터링 채널 사용, 없으면 기존 채널 사용
    const channelsToTrack = monitoringChannels.length > 0 ? monitoringChannels : channels;

    if (channelsToTrack.length === 0) {
        alert('추적할 채널이 없습니다. 먼저 모니터링 탭에서 채널을 추가해주세요.');
        return;
    }

    if (confirm(`현재 등록된 ${channelsToTrack.length}개 채널의 추적을 시작하시겠습니까?`)) {
        showLoading(true);
        
        try {
            const trackingRecord = {
                timestamp: new Date().toISOString(),
                channels: []
            };

            console.log('추적 시작 - 등록된 채널들:', channelsToTrack);

            for (const channel of channelsToTrack) {
                try {
                    console.log(`${channel.name} (ID: ${channel.id}) 추적 시작...`);
                    
                    if (!channel.id || !isValidChannelId(channel.id)) {
                        console.error(`잘못된 채널 ID: ${channel.id}`);
                        trackingRecord.channels.push({
                            id: channel.id,
                            name: channel.name,
                            subscriberCount: 0,
                            hotVideo: null,
                            error: "잘못된 채널 ID"
                        });
                        continue;
                    }
                    
                    // 정상적인 채널 처리
                    const channelInfo = await fetchChannelInfo(channel.id);
                    const currentSubscribers = parseInt(channelInfo.statistics.subscriberCount) || 0;
                    const hotVideo = await findHotVideo(channel.id, currentSubscribers);
                    
                    trackingRecord.channels.push({
                        id: channel.id,
                        name: channel.name,
                        subscriberCount: currentSubscribers,
                        hotVideo: hotVideo
                    });
                    
                    console.log(`${channel.name} 추적 완료`);
                    
                } catch (error) {
                    console.error('채널 처리 중 오류:', error);
                    trackingRecord.channels.push({
                        id: channel.id,
                        name: channel.name,
                        subscriberCount: 0,
                        hotVideo: null,
                        error: error.message
                    });
                }
            }

            channelTrackingData.unshift(trackingRecord);
            localStorage.setItem('youtube-channel-tracking-data', JSON.stringify(channelTrackingData));
            
            renderChannelTrackingRecords();
            
            const successCount = trackingRecord.channels.filter(ch => !ch.error).length;
            const errorCount = trackingRecord.channels.filter(ch => ch.error).length;
            
            if (errorCount > 0) {
                alert(`추적 완료: ${successCount}개 성공, ${errorCount}개 실패\n실패한 채널은 다시 추가해주세요.`);
            } else {
                alert(`${channelsToTrack.length}개 채널의 추적이 완료되었습니다.`);
            }
            
        } catch (error) {
            console.error('채널 추적 오류:', error);
            alert('채널 추적 중 오류가 발생했습니다: ' + error.message);
        } finally {
            showLoading(false);
        }
    }
}

// 핫 영상 찾기
async function findHotVideo(channelId, subscriberCount) {
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&channelId=${channelId}&type=video&order=date&maxResults=20&key=${getCurrentApiKey()}`;
        
        const searchData = await makeApiRequest(searchUrl);
        
        if (searchData.items.length === 0) {
            return null;
        }

        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
            `part=statistics,snippet,contentDetails&id=${videoIds}&key=${getCurrentApiKey()}`;
        
        const videosData = await makeApiRequest(videosUrl);

        for (const video of videosData.items) {
            const viewCount = parseInt(video.statistics?.viewCount || 0);
            const ratio = subscriberCount > 0 ? viewCount / subscriberCount : 0;
            const requiredRatio = parseFloat(document.getElementById('hot-video-ratio')?.value) || 2.0;
                        
            if (!isShorts(video.contentDetails.duration) && ratio >= requiredRatio) {
                return {
                    id: video.id,
                    title: video.snippet.title,
                    viewCount: viewCount,
                    publishedAt: video.snippet.publishedAt,
                    ratio: ratio,
                    thumbnail: getBestThumbnail(video.snippet.thumbnails)
                };
            }
        }

        return null;
        
    } catch (error) {
        console.error(`채널 ${channelId} 핫 영상 검색 오류:`, error);
        return null;
    }
}

// 추적 결과 정렬
function sortTrackingResults() {
    renderChannelTrackingRecords();
}

// 채널 목록을 정렬하는 함수
function sortChannels(channels, sortOrder) {
    return channels.sort((a, b) => {
        switch (sortOrder) {
            case 'ratio':
                const ratioA = a.hotVideo ? a.hotVideo.ratio : 0;
                const ratioB = b.hotVideo ? b.hotVideo.ratio : 0;
                if (ratioA === 0 && ratioB === 0) return 0;
                if (ratioA === 0) return 1;
                if (ratioB === 0) return -1;
                return ratioB - ratioA;
            case 'publishedAt':
                const dateA = a.hotVideo ? new Date(a.hotVideo.publishedAt) : new Date(0);
                const dateB = b.hotVideo ? new Date(b.hotVideo.publishedAt) : new Date(0);
                return dateB - dateA;
            case 'subscriberCount':
                return b.subscriberCount - a.subscriberCount;
            case 'viewCount':
                const viewA = a.hotVideo ? a.hotVideo.viewCount : 0;
                const viewB = b.hotVideo ? b.hotVideo.viewCount : 0;
                return viewB - viewA;
            default:
                const defaultRatioA = a.hotVideo ? a.hotVideo.ratio : 0;
                const defaultRatioB = b.hotVideo ? b.hotVideo.ratio : 0;
                if (defaultRatioA === 0 && defaultRatioB === 0) return 0;
                if (defaultRatioA === 0) return 1;
                if (defaultRatioB === 0) return -1;
                return defaultRatioB - defaultRatioA;
        }
    });
}

// 추적 결과 렌더링 함수 (전체 채널 보기 기능 포함)
function renderChannelTrackingRecords() {
    const recordsContainer = document.getElementById('tracking-records');
    
    if (channelTrackingData.length === 0) {
        recordsContainer.innerHTML = `
            <div class="empty-state">
                <p>아직 추적 기록이 없습니다.</p>
                <p>상단의 "채널 추적 시작" 버튼을 눌러 첫 번째 추적을 시작해보세요.</p>
            </div>
        `;
        return;
    }

    const sortOrder = document.getElementById('tracking-sort-order').value;
    const showAllChannels = document.getElementById('show-all-channels').checked;

    const renderedRecords = channelTrackingData.map((record, index) => {
        const date = new Date(record.timestamp);
        const formattedDate = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        let sortedChannels = sortChannels([...record.channels], sortOrder);
        
        // 기본적으로 핫 영상이 있는 채널만 표시, 체크 시 전체 표시
        if (!showAllChannels) {
            sortedChannels = sortedChannels.filter(channel => 
                channel.hotVideo && !channel.error
            );
        }
        
        if (!showAllChannels && sortedChannels.length === 0) {
            return '';
        }
        
        const hotVideoCount = record.channels.filter(ch => ch.hotVideo && !ch.error).length;
        const errorCount = record.channels.filter(ch => ch.error).length;
        const totalChannels = record.channels.length;
        
        return `
            <div class="tracking-record">
                <div class="tracking-header">
                    <div>
                        <div class="tracking-timestamp">${formattedDate}</div>
                        <div class="tracking-summary">
                            ${showAllChannels ? 
                                `총 ${totalChannels}개 채널 | 핫 영상 ${hotVideoCount}개 발견${errorCount > 0 ? ` | 오류 ${errorCount}개` : ''}` :
                                `핫 영상 ${hotVideoCount}개 발견`
                            }
                        </div>
                    </div>
                    <button class="delete-btn" onclick="deleteTrackingRecord(${index})">삭제</button>
                </div>
                
                <div class="channel-tracking-list">
                    ${sortedChannels.map(channel => `
                        <div class="channel-tracking-item ${channel.error ? 'error' : ''}" ${channel.hotVideo ? `onclick="openVideo('${channel.hotVideo.id}')"` : ''}>
                            ${channel.error ? `
                                <div class="tracking-video-thumbnail-placeholder">❌</div>
                            ` : channel.hotVideo && channel.hotVideo.thumbnail ? `
                                <img src="${channel.hotVideo.thumbnail}" 
                                     alt="${channel.hotVideo.title}" 
                                     class="tracking-video-thumbnail"
                                     onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
                                     onload="this.nextElementSibling.style.display='none';">
                                <div class="tracking-video-thumbnail-placeholder" style="display: none;">🔥</div>
                            ` : `
                                <div class="tracking-video-thumbnail-placeholder">
                                    ${channel.hotVideo ? '🔥' : '❌'}
                                </div>
                            `}
                            <div class="tracking-video-details">
                                <div class="tracking-channel-header">
                                    <h3 class="tracking-channel-name">${channel.name}</h3>
                                    <button class="btn-icon-small" onclick="event.stopPropagation(); removeChannel('${channel.id}')">🗑️</button>
                                </div>
                                ${channel.error ? `
                                    <p class="tracking-channel-error">
                                        오류: ${channel.error}
                                    </p>
                                ` : `
                                    <p class="tracking-channel-subscribers">구독자 ${formatNumber(channel.subscriberCount)}명</p>
                                `}
                                ${channel.hotVideo ? `
                                    <h4 class="tracking-video-title">${channel.hotVideo.title}</h4>
                                    <div class="tracking-video-stats">
                                        <span>👁️ ${formatNumber(channel.hotVideo.viewCount)} | 📅 ${formatDate(channel.hotVideo.publishedAt)}</span>
                                        <span class="tracking-hot-ratio">${channel.hotVideo.ratio.toFixed(1)}배</span>
                                    </div>
                                ` : channel.error ? `
                                    <p class="tracking-no-video">채널 정보를 가져올 수 없습니다</p>
                                ` : `
                                    <p class="tracking-no-video">조건에 맞는 영상이 없습니다</p>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).filter(html => html !== '');

    recordsContainer.innerHTML = renderedRecords.join('');
    
    if (!showAllChannels && recordsContainer.innerHTML.trim() === '') {
        recordsContainer.innerHTML = `
            <div class="empty-state">
                <p>핫 영상이 있는 채널이 없습니다.</p>
                <p>"전체 채널 보기" 옵션을 체크하면 모든 채널을 볼 수 있습니다.</p>
            </div>
        `;
    }
}

function deleteTrackingRecord(index) {
    if (confirm('이 추적 기록을 삭제하시겠습니까?')) {
        channelTrackingData.splice(index, 1);
        localStorage.setItem('youtube-channel-tracking-data', JSON.stringify(channelTrackingData));
        renderChannelTrackingRecords();
    }
}

// 백업 및 복원 기능
function backupTrackingData() {
    if (channelTrackingData.length === 0) {
        alert('백업할 추적 데이터가 없습니다.');
        return;
    }

    const backupData = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        channelTrackingData: channelTrackingData
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube_channel_tracking_backup_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('추적 데이터가 백업되었습니다.');
}

function restoreTrackingData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            if (!backupData.channelTrackingData || !Array.isArray(backupData.channelTrackingData)) {
                throw new Error('올바르지 않은 백업 파일 형식입니다.');
            }

            if (channelTrackingData.length > 0) {
                if (!confirm('기존 추적 데이터를 덮어쓰시겠습니까? 기존 데이터는 삭제됩니다.')) {
                    return;
                }
            }

            channelTrackingData = backupData.channelTrackingData;
            localStorage.setItem('youtube-channel-tracking-data', JSON.stringify(channelTrackingData));
            renderChannelTrackingRecords();
            
            alert(`${channelTrackingData.length}개의 추적 기록이 복원되었습니다.`);
            
        } catch (error) {
            console.error('데이터 복원 오류:', error);
            alert('백업 파일을 읽을 수 없습니다. 파일이 손상되었거나 올바른 형식이 아닙니다.');
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}


// ========== script-events.js ==========
// ============================================
// script-events.js - 이벤트 리스너 설정
// ============================================

// 이벤트 리스너 설정 (기존 setupEventListeners 함수 교체)
function setupEventListeners() {
    // API 설정 관련
    document.getElementById('api-settings-btn').addEventListener('click', openApiModal);
    document.getElementById('save-api-btn').addEventListener('click', saveApiKeys);
    document.getElementById('cancel-api-btn').addEventListener('click', closeApiModal);
    document.getElementById('reset-api-rotation').addEventListener('click', resetApiRotation);
    
    // 핫 영상 비율 설정
    document.getElementById('hot-video-ratio').addEventListener('change', function() {
        // 비율 변경 시 특별한 처리가 필요하면 여기에 추가
        localStorage.setItem('hot-video-ratio', this.value);
    });
    
    // 구독자 수 범위 선택 이벤트
    document.getElementById('subscriber-range').addEventListener('change', function() {
        const customRange = document.getElementById('custom-subscriber-range');
        if (this.value === 'custom') {
            customRange.style.display = 'flex';
        } else {
            customRange.style.display = 'none';
        }
        
        // 선택된 범위 저장
        localStorage.setItem('selected-subscriber-range', this.value);
    });
    
    // 사용자 정의 구독자 수 입력 이벤트
    document.getElementById('min-subscribers').addEventListener('change', function() {
        localStorage.setItem('custom-min-subscribers', this.value);
    });
    
    document.getElementById('max-subscribers').addEventListener('change', function() {
        localStorage.setItem('custom-max-subscribers', this.value);
    });
    
    // 기존 채널 관리 (호환성을 위해 유지)
    const addChannelBtn = document.getElementById('add-channel-btn');
    if (addChannelBtn) {
        addChannelBtn.addEventListener('click', () => openChannelModal('general'));
    }
    
    // 독립적인 채널 추가 버튼들
    document.getElementById('add-monitoring-channel-btn').addEventListener('click', () => openChannelModal('monitoring'));
    document.getElementById('add-tracking-channel-btn').addEventListener('click', () => openChannelModal('tracking'));
    
    // 채널 모달 관련
    document.getElementById('add-channel-confirm-btn').addEventListener('click', handleChannelInput);
    document.getElementById('cancel-channel-btn').addEventListener('click', closeChannelModal);
    
    // 채널 선택 모달
    document.getElementById('cancel-channel-selection-btn').addEventListener('click', closeChannelSelectionModal);
    
    // 채널 추적 관련
    document.getElementById('track-channels-btn').addEventListener('click', startChannelTracking);
    document.getElementById('backup-tracking-data-btn').addEventListener('click', backupTrackingData);
    document.getElementById('restore-tracking-data-btn').addEventListener('click', () => {
        document.getElementById('restore-tracking-data-input').click();
    });
    document.getElementById('restore-tracking-data-input').addEventListener('change', restoreTrackingData);
    
    // 추적 결과 정렬
    document.getElementById('tracking-sort-order').addEventListener('change', sortTrackingResults);
    
    // 영상 검색 관련
    document.getElementById('search-btn').addEventListener('click', searchVideos);
    document.getElementById('search-keyword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchVideos();
        }
    });
    
    // 전체 채널 보기 토글
    document.getElementById('show-all-channels').addEventListener('change', function() {
        localStorage.setItem('show-all-channels', this.checked);
        renderChannelTrackingRecords();
    });
    
    // 영상 검색 - 날짜 범위 타입 변경
    document.getElementById('date-range-type').addEventListener('change', function() {
        const dateRange = document.getElementById('date-range');
        const customDateRange = document.getElementById('custom-date-range');
        
        if (this.value === 'custom') {
            dateRange.style.display = 'none';
            customDateRange.style.display = 'flex';
        } else {
            dateRange.style.display = 'block';
            customDateRange.style.display = 'none';
        }
    });
    
    // 구독자 수 추적 관련
    document.getElementById('collect-subscriber-data-btn').addEventListener('click', collectTodaySubscriberData);
    document.getElementById('chart-channel-select').addEventListener('change', updateSubscriberChart);

    // 썸네일 테스트 관련
    document.getElementById('start-test-btn').addEventListener('click', startThumbnailTest);
    document.getElementById('view-records-btn').addEventListener('click', showTestRecords);
    document.getElementById('restart-test-btn').addEventListener('click', restartTest);
    document.getElementById('new-test-btn').addEventListener('click', newTest);
    document.getElementById('close-records-btn').addEventListener('click', closeTestRecords);

    // 탭 전환 이벤트
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // 모달 외부 클릭 시 닫기
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });
    
    // 키보드 이벤트 (ESC로 모달 닫기)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
    
    // 썸네일 테스트 키보드 단축키
    document.addEventListener('keydown', function(e) {
        const currentSection = document.querySelector('.test-section:not([style*="display: none"])');
        if (currentSection && currentSection.id === 'test-game') {
            if (e.key === '1' || e.key === 'ArrowLeft') {
                selectThumbnail('a');
            } else if (e.key === '2' || e.key === 'ArrowRight') {
                selectThumbnail('b');
            }
        }
    });
    
    // 윈도우 리사이즈 이벤트
    window.addEventListener('resize', function() {
        // 차트가 있으면 리사이즈
        if (subscriberChart) {
            subscriberChart.resize();
        }
    });
    
    // 페이지 언로드 전 확인 (데이터 손실 방지)
    window.addEventListener('beforeunload', function(e) {
        // 테스트 진행 중이면 확인
        const testGameSection = document.getElementById('test-game');
        if (testGameSection && testGameSection.style.display !== 'none' && currentQuestion > 0) {
            e.preventDefault();
            e.returnValue = '진행 중인 테스트가 있습니다. 정말 나가시겠습니까?';
        }
    });
}

// 썸네일 테스트 관련 추가 이벤트 함수들
function setupThumbnailTestEvents() {
    // 썸네일 옵션 클릭 이벤트 (동적으로 생성되는 요소들)
    document.addEventListener('click', function(e) {
        if (e.target.closest('#option-a')) {
            selectThumbnail('a');
        } else if (e.target.closest('#option-b')) {
            selectThumbnail('b');
        }
    });
    
    // 호버 효과 개선
    document.addEventListener('mouseenter', function(e) {
        if (e.target.closest('.thumbnail-option')) {
            e.target.closest('.thumbnail-option').style.transform = 'translateY(-3px)';
        }
    }, true);
    
    document.addEventListener('mouseleave', function(e) {
        if (e.target.closest('.thumbnail-option')) {
            const option = e.target.closest('.thumbnail-option');
            if (!option.classList.contains('selected')) {
                option.style.transform = 'translateY(0)';
            }
        }
    }, true);
}

// 채널 관리 관련 이벤트 함수들
function setupChannelManagementEvents() {
    // 채널 접기/펼치기 클릭 이벤트
    document.addEventListener('click', function(e) {
        const header = e.target.closest('.management-header');
        if (header) {
            const type = header.closest('.monitoring-channel-management') ? 'monitoring' : 'tracking';
            toggleChannelManagementSection(type);
        }
    });
    
    // 채널 카드 호버 효과
    document.addEventListener('mouseenter', function(e) {
        if (e.target.closest('.channel-item')) {
            e.target.closest('.channel-item').style.transform = 'translateY(-2px)';
        }
    }, true);
    
    document.addEventListener('mouseleave', function(e) {
        if (e.target.closest('.channel-item')) {
            e.target.closest('.channel-item').style.transform = 'translateY(0)';
        }
    }, true);
}

// 검색 관련 이벤트 함수들
function setupSearchEvents() {
    // 검색 필터 변경 시 자동 검색 (디바운스 적용)
    let searchTimeout;
    
    function debounceSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const keyword = document.getElementById('search-keyword').value.trim();
            if (keyword) {
                searchVideos();
            }
        }, 1000); // 1초 후 자동 검색
    }
    
    // 필터 옵션 변경 시 자동 검색
    document.getElementById('sub-filter').addEventListener('change', debounceSearch);
    document.getElementById('view-filter').addEventListener('change', debounceSearch);
    document.getElementById('date-range').addEventListener('change', debounceSearch);
    document.getElementById('sort-order').addEventListener('change', debounceSearch);
}

// 알림 및 툴팁 이벤트
function setupNotificationEvents() {
    // 툴팁 표시
    document.addEventListener('mouseenter', function(e) {
        if (e.target.hasAttribute('title')) {
            showTooltip(e.target, e.target.getAttribute('title'));
        }
    }, true);
    
    document.addEventListener('mouseleave', function(e) {
        if (e.target.hasAttribute('title')) {
            hideTooltip();
        }
    }, true);
}

// 툴팁 관련 함수들
function showTooltip(element, text) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    tooltip.style.cssText = `
        position: absolute;
        background: #333;
        color: white;
        padding: 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
        z-index: 10000;
        pointer-events: none;
        white-space: nowrap;
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
    
    // 화면 밖으로 나가면 위치 조정
    if (tooltip.offsetLeft + tooltip.offsetWidth > window.innerWidth) {
        tooltip.style.left = (window.innerWidth - tooltip.offsetWidth - 10) + 'px';
    }
    
    if (tooltip.offsetTop < 0) {
        tooltip.style.top = (rect.bottom + 5) + 'px';
    }
}

function hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// 저장된 설정 복원
function restoreEventSettings() {
    // 구독자 범위 설정 복원
    const savedRange = localStorage.getItem('selected-subscriber-range');
    if (savedRange) {
        const rangeSelect = document.getElementById('subscriber-range');
        if (rangeSelect) {
            rangeSelect.value = savedRange;
            
            // 사용자 정의인 경우 입력 필드 표시
            if (savedRange === 'custom') {
                document.getElementById('custom-subscriber-range').style.display = 'flex';
                
                const minSubs = localStorage.getItem('custom-min-subscribers');
                const maxSubs = localStorage.getItem('custom-max-subscribers');
                
                if (minSubs) document.getElementById('min-subscribers').value = minSubs;
                if (maxSubs) document.getElementById('max-subscribers').value = maxSubs;
            }
        }
    }
    
    // 핫 영상 비율 설정 복원
    const savedRatio = localStorage.getItem('hot-video-ratio');
    if (savedRatio) {
        const ratioSelect = document.getElementById('hot-video-ratio');
        if (ratioSelect) {
            ratioSelect.value = savedRatio;
        }
    }
    
    // 전체 채널 보기 설정 복원
    const showAllChannels = localStorage.getItem('show-all-channels');
    if (showAllChannels === 'true') {
        const checkbox = document.getElementById('show-all-channels');
        if (checkbox) {
            checkbox.checked = true;
        }
    }
}

// 이벤트 설정 초기화 함수
function initializeAllEvents() {
    setupEventListeners();
    setupThumbnailTestEvents();
    setupChannelManagementEvents();
    setupSearchEvents();
    setupNotificationEvents();
    restoreEventSettings();
    
    console.log('모든 이벤트 리스너가 설정되었습니다.');
}

// script-events.js의 setupEventListeners() 함수에 추가할 내용

// 기존 API 설정 이벤트들
document.getElementById('api-settings-btn').addEventListener('click', openApiModal);
document.getElementById('save-api-btn').addEventListener('click', saveApiKeys);
document.getElementById('cancel-api-btn').addEventListener('click', closeApiModal);
document.getElementById('reset-api-rotation').addEventListener('click', resetApiRotation);

// 새로 추가할 API 파일 관련 이벤트들
document.getElementById('import-api-keys-btn').addEventListener('click', importApiKeysFromFile);
document.getElementById('export-api-keys-btn').addEventListener('click', exportApiKeys);
document.getElementById('test-all-api-keys-btn').addEventListener('click', testAllApiKeys);

// API 모달이 열릴 때 통계 정보 업데이트
document.getElementById('api-settings-btn').addEventListener('click', function() {
    setTimeout(updateApiStatsInfo, 100); // 모달이 열린 후 업데이트
});

// API 통계 정보 업데이트 함수 (script-api.js에 추가)
function updateApiStatsInfo() {
    const statsElement = document.getElementById('api-stats-info');
    if (!statsElement) return;
    
    const stats = getApiKeyStats();
    
    if (stats.total === 0) {
        statsElement.textContent = 'API 키가 없습니다.';
        return;
    }
    
    statsElement.innerHTML = `
        총 ${stats.total}개 키 보유 | 
        일일 할당량: ${stats.estimated_daily_quota.toLocaleString()} 단위 | 
        예상 테스트 횟수: ${stats.estimated_tests_per_day.toLocaleString()}회/일
    `;
}


// ========== script-thumbnail.js ==========
// ============================================
// script-thumbnail.js - 썸네일 테스트 관련 함수들
// ============================================

// 구독자 수 범위 관련 변수 (기존 코드에 추가)
const subscriberRanges = {
    'all': { min: 0, max: Infinity, name: '전체 (제한 없음)' },
    'micro': { min: 1000, max: 10000, name: '1천 ~ 1만명' },
    'small': { min: 10000, max: 100000, name: '1만 ~ 10만명' },
    'medium': { min: 100000, max: 1000000, name: '10만 ~ 100만명' },
    'large': { min: 1000000, max: 10000000, name: '100만 ~ 1000만명' },
    'mega': { min: 10000000, max: Infinity, name: '1000만명 이상' },
    'custom': { min: 0, max: 0, name: '사용자 정의' }
};

// 선택된 구독자 수 범위 가져오기
function getSelectedSubscriberRange() {
    const rangeSelect = document.getElementById('subscriber-range').value;
    
    if (rangeSelect === 'custom') {
        const minSubs = parseInt(document.getElementById('min-subscribers').value) || 0;
        const maxSubs = parseInt(document.getElementById('max-subscribers').value) || Infinity;
        return {
            min: minSubs,
            max: maxSubs,
            name: `${minSubs.toLocaleString()} ~ ${maxSubs === Infinity ? '무제한' : maxSubs.toLocaleString()}명`
        };
    }
    
    return subscriberRanges[rangeSelect];
}

// 개선된 썸네일 테스트 시작 함수 (기존 startThumbnailTest 교체)
async function startThumbnailTest() {
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }
    
    // 구독자 수 범위 설정 가져오기
    const subscriberRange = getSelectedSubscriberRange();
    
    testKeyword = document.getElementById('test-keyword').value.trim();
    currentQuestion = 0;
    currentScore = 0;
    testVideos = [];
    
    showTestSection('test-game');
    
    try {
        showLoading(true);
        await loadHomepage48HourVideos(subscriberRange);
        
        if (testVideos.length < 20) {
            throw new Error(`선택한 구독자 수 범위에서 충분한 영상을 찾을 수 없습니다.\n\n발견된 영상: ${testVideos.length}개\n구독자 범위: ${subscriberRange.name}\n\n해결 방법:\n1. 구독자 수 범위를 넓혀보세요\n2. 다른 시간대에 다시 시도해보세요`);
        }
        
        await loadNextQuestion();
    } catch (error) {
        console.error('테스트 시작 오류:', error);
        alert('테스트를 시작할 수 없습니다: ' + error.message);
        showTestSection('test-intro');
    } finally {
        showLoading(false);
    }
}

// 48시간 기준 홈페이지 영상 수집
async function loadHomepage48HourVideos(subscriberRange) {
    console.log(`구독자 범위: ${subscriberRange.name}로 48시간 기준 영상 수집 시작...`);
    
    // 48-50시간 전 시점 계산
    const now = new Date();
    const hours48Ago = new Date(now.getTime() - (48 * 60 * 60 * 1000));
    const hours50Ago = new Date(now.getTime() - (50 * 60 * 60 * 1000));
    
    let allVideos = [];
    
    try {
        // 1. 인기 급상승 영상에서 48시간 기준 영상 필터링
        console.log('인기 급상승 영상 수집 중...');
        const trendingVideos = await getTrending48HourVideos(subscriberRange, hours48Ago, hours50Ago);
        allVideos.push(...trendingVideos);
        
        // 2. 카테고리별 인기 영상
        console.log('카테고리별 인기 영상 수집 중...');
        const categoryVideos = await getCategory48HourVideos(subscriberRange, hours48Ago, hours50Ago);
        allVideos.push(...categoryVideos);
        
        // 3. 키워드 기반 검색 (키워드가 있는 경우)
        if (testKeyword) {
            console.log(`키워드 "${testKeyword}" 기반 영상 수집 중...`);
            const keywordVideos = await getKeyword48HourVideos(testKeyword, subscriberRange, hours48Ago, hours50Ago);
            allVideos.push(...keywordVideos);
        }
        
        // 4. 중복 제거
        const uniqueVideos = [];
        const seenIds = new Set();
        
        for (const video of allVideos) {
            if (!seenIds.has(video.id)) {
                seenIds.add(video.id);
                uniqueVideos.push(video);
            }
        }
        
        testVideos = uniqueVideos;
        console.log(`48시간 기준 ${testVideos.length}개 영상 수집 완료`);
        
    } catch (error) {
        console.error('48시간 기준 영상 수집 오류:', error);
        throw error;
    }
}

// 인기 급상승에서 48시간 기준 영상 가져오기
async function getTrending48HourVideos(subscriberRange, hours48Ago, hours50Ago) {
    try {
        const trendingUrl = `https://www.googleapis.com/youtube/v3/videos?` +
            `part=snippet,statistics,contentDetails&chart=mostPopular&` +
            `regionCode=KR&maxResults=50&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(trendingUrl);
        
        return await filterAndPrepareVideos(data.items, subscriberRange, hours48Ago, hours50Ago);
        
    } catch (error) {
        console.error('인기 급상승 48시간 영상 가져오기 오류:', error);
        return [];
    }
}

// 카테고리별 48시간 기준 영상 가져오기
async function getCategory48HourVideos(subscriberRange, hours48Ago, hours50Ago) {
    const categories = ['1', '10', '15', '17', '19', '20', '22', '23', '24', '25', '26', '27', '28'];
    let allVideos = [];
    
    for (const categoryId of categories) {
        try {
            const categoryUrl = `https://www.googleapis.com/youtube/v3/videos?` +
                `part=snippet,statistics,contentDetails&chart=mostPopular&` +
                `videoCategoryId=${categoryId}&regionCode=KR&` +
                `maxResults=10&key=${getCurrentApiKey()}`;
            
            const data = await makeApiRequest(categoryUrl);
            const videos = await filterAndPrepareVideos(data.items, subscriberRange, hours48Ago, hours50Ago);
            allVideos.push(...videos);
            
            if (allVideos.length >= 100) break; // 충분한 영상을 모았으면 중단
            
        } catch (error) {
            console.error(`카테고리 ${categoryId} 영상 가져오기 오류:`, error);
        }
    }
    
    return allVideos;
}

// 키워드 기반 48시간 영상 가져오기
async function getKeyword48HourVideos(keyword, subscriberRange, hours48Ago, hours50Ago) {
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=video&q=${encodeURIComponent(keyword)}&` +
            `publishedAfter=${hours50Ago.toISOString()}&` +
            `publishedBefore=${hours48Ago.toISOString()}&` +
            `maxResults=30&key=${getCurrentApiKey()}`;
        
        const searchData = await makeApiRequest(searchUrl);
        
        if (searchData.items.length === 0) return [];
        
        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
            `part=statistics,snippet,contentDetails&id=${videoIds}&key=${getCurrentApiKey()}`;
        
        const videosData = await makeApiRequest(videosUrl);
        
        return await filterAndPrepareVideos(videosData.items, subscriberRange, hours48Ago, hours50Ago);
        
    } catch (error) {
        console.error('키워드 48시간 영상 가져오기 오류:', error);
        return [];
    }
}

// 영상 필터링 및 준비
async function filterAndPrepareVideos(videos, subscriberRange, hours48Ago, hours50Ago) {
    if (!videos || videos.length === 0) return [];
    
    // 48시간 기준으로 업로드된 롱폼 영상 필터링
    const filteredVideos = videos.filter(video => {
        const duration = video.contentDetails?.duration;
        if (!duration) return false;
        
        const totalSeconds = parseYouTubeDuration(duration);
        if (totalSeconds < 60) return false; // 1분 이상만
        
        const publishedAt = new Date(video.snippet.publishedAt);
        return publishedAt >= hours50Ago && publishedAt <= hours48Ago;
    });
    
    if (filteredVideos.length === 0) return [];
    
    // 채널 정보 가져오기
    const channelIds = [...new Set(filteredVideos.map(video => video.snippet.channelId))];
    
    if (channelIds.length === 0) return [];
    
    try {
        const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?` +
            `part=statistics&id=${channelIds.join(',')}&key=${getCurrentApiKey()}`;
        
        const channelsData = await makeApiRequest(channelsUrl);
        
        const channelMap = {};
        channelsData.items.forEach(channel => {
            channelMap[channel.id] = parseInt(channel.statistics.subscriberCount) || 0;
        });
        
        // 구독자 수 범위에 맞는 영상만 선택
        return filteredVideos
            .map(video => {
                const subscriberCount = channelMap[video.snippet.channelId] || 0;
                return {
                    id: video.id,
                    title: video.snippet.title,
                    channelTitle: video.snippet.channelTitle,
                    thumbnail: getBestThumbnail(video.snippet.thumbnails),
                    viewCount: parseInt(video.statistics.viewCount) || 0,
                    subscriberCount: subscriberCount,
                    publishedAt: video.snippet.publishedAt
                };
            })
            .filter(video => 
                video.subscriberCount >= subscriberRange.min && 
                video.subscriberCount <= subscriberRange.max &&
                video.viewCount > 0 // 조회수가 있는 영상만
            );
            
    } catch (error) {
        console.error('채널 정보 가져오기 오류:', error);
        return [];
    }
}

// 개선된 다음 문제 로드 (기존 loadNextQuestion 교체)
async function loadNextQuestion() {
    if (currentQuestion >= 50) {
        showTestResult();
        return;
    }
    
    currentQuestion++;
    updateProgress();
    
    // 조회수 기준으로 상위/하위 그룹 나누기
    const sortedVideos = [...testVideos].sort((a, b) => b.viewCount - a.viewCount);
    const midPoint = Math.floor(sortedVideos.length / 2);
    const highViewVideos = sortedVideos.slice(0, midPoint);
    const lowViewVideos = sortedVideos.slice(midPoint);
    
    console.log(`사용 가능한 고조회수 영상: ${highViewVideos.length}개, 저조회수 영상: ${lowViewVideos.length}개`);
    
    if (highViewVideos.length === 0 || lowViewVideos.length === 0) {
        console.log('영상 부족으로 테스트 종료');
        alert('더 이상 사용 가능한 영상이 없습니다.');
        showTestResult();
        return;
    }
    
    const correctVideo = highViewVideos[Math.floor(Math.random() * highViewVideos.length)];
    const incorrectVideo = lowViewVideos[Math.floor(Math.random() * lowViewVideos.length)];
    
    // 사용된 영상들 제거
    testVideos = testVideos.filter(v => v.id !== correctVideo.id && v.id !== incorrectVideo.id);
    
    currentTestVideos = { correct: correctVideo, incorrect: incorrectVideo };
    
    const positions = Math.random() < 0.5 ? ['correct', 'incorrect'] : ['incorrect', 'correct'];
    
    displayThumbnail('a', positions[0] === 'correct' ? correctVideo : incorrectVideo);
    displayThumbnail('b', positions[1] === 'correct' ? correctVideo : incorrectVideo);
    
    currentTestVideos.correctPosition = positions[0] === 'correct' ? 'a' : 'b';
    
    // 이전 선택 상태 초기화
    document.querySelectorAll('.thumbnail-option').forEach(option => {
        option.classList.remove('selected', 'correct', 'incorrect');
    });
    
    // 문제 텍스트 업데이트
    updateQuestionText(correctVideo, incorrectVideo);
}

// 문제 텍스트 업데이트
function updateQuestionText(correctVideo, incorrectVideo) {
    const questionElement = document.querySelector('.test-question h3');
    if (questionElement) {
        questionElement.textContent = '48시간 후 어떤 썸네일이 더 많은 조회수를 받았을까요?';
    }
}

// 썸네일 표시 (기존 함수 그대로 사용)
function displayThumbnail(position, video) {
    document.getElementById(`thumbnail-${position}`).src = video.thumbnail || '';
    document.getElementById(`title-${position}`).textContent = video.title;
    document.getElementById(`channel-${position}`).textContent = video.channelTitle;
}

// 썸네일 선택 처리 (기존 함수 개선)
function selectThumbnail(position) {
    const isCorrect = position === currentTestVideos.correctPosition;
    
    if (isCorrect) {
        currentScore++;
    }
    
    document.getElementById(`option-${position}`).classList.add('selected');
    
    setTimeout(() => {
        // 정답 표시
        document.getElementById(`option-${currentTestVideos.correctPosition}`).classList.add('correct');
        if (!isCorrect) {
            document.getElementById(`option-${position}`).classList.add('incorrect');
        }
        
        // 조회수 정보 표시
        showViewCountInfo();
        
        updateProgress();
        
        setTimeout(() => {
            loadNextQuestion();
        }, 2000); // 2초간 결과 표시
    }, 500);
}

// 조회수 정보 표시
function showViewCountInfo() {
    const correctVideo = currentTestVideos.correct;
    const incorrectVideo = currentTestVideos.incorrect;
    
    const questionElement = document.querySelector('.test-question h3');
    if (questionElement) {
        questionElement.innerHTML = `
            <div style="font-size: 1rem; color: #666; margin-top: 1rem;">
                정답: ${formatNumber(correctVideo.viewCount)} 조회수<br>
                오답: ${formatNumber(incorrectVideo.viewCount)} 조회수
            </div>
        `;
    }
}

// 진행 상황 업데이트 (기존 함수 그대로 사용)
function updateProgress() {
    document.getElementById('question-counter').textContent = `${currentQuestion} / 50`;
    document.getElementById('score-counter').textContent = `정답: ${currentScore}개`;
}

// 테스트 결과 표시 (기존 함수 그대로 사용)
function showTestResult() {
    const percentage = Math.round((currentScore / 50) * 100);
    
    document.getElementById('final-score-text').textContent = `50문제 중 ${currentScore}문제 정답`;
    document.getElementById('final-percentage').textContent = `(${percentage}%)`;
    
    saveTestResult();
    showTestSection('test-result');
}

// 테스트 결과 저장 (기존 함수 개선)
function saveTestResult() {
    const subscriberRange = getSelectedSubscriberRange();
    
    const testResult = {
        date: new Date().toISOString(),
        keyword: testKeyword || '랜덤',
        subscriberRange: subscriberRange.name,
        score: currentScore,
        total: 50,
        percentage: Math.round((currentScore / 50) * 100)
    };
    
    const savedResults = JSON.parse(localStorage.getItem('thumbnail-test-results') || '[]');
    savedResults.unshift(testResult);
    
    if (savedResults.length > 50) {
        savedResults.splice(50);
    }
    
    localStorage.setItem('thumbnail-test-results', JSON.stringify(savedResults));
}

// YouTube 시간 파싱 함수 (기존 함수 그대로 사용)
function parseYouTubeDuration(durationStr) {
    const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    return hours * 3600 + minutes * 60 + seconds;
}

// ========== script-main.js ==========
// ============================================
// script-main.js - 메인 초기화 및 전역변수
// ============================================

// 전역 변수 선언
let apiKeys = [];
let currentApiIndex = 0;
let channels = [];
let monitoringChannels = [];  // 모니터링 전용 채널
let trackingChannels = [];    // 구독자 추적 전용 채널
let searchResults = [];
let videoList = [];
let subscriberData = {};  // 채널별 구독자 데이터 저장
let subscriberChart = null;
let channelTrackingData = [];
let channelSearchResults = [];
let selectedTrackingChannels = new Set(); // 구독자 수 추적 대상 채널들

// 썸네일 테스트 관련 변수
let thumbnailTestData = [];
let currentQuestion = 0;
let currentScore = 0;
let testKeyword = '';
let testVideos = [];
let currentTestVideos = { correct: null, incorrect: null };

// 앱 설정
const APP_CONFIG = {
    version: '2.0.0',
    maxChannels: 20,
    maxApiKeys: 5,
    defaultHotVideoRatio: 2.0,
    chartColors: [
        '#764ba2', '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
        '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#e91e63'
    ],
    storageKeys: {
        apiKeys: 'youtube-api-keys',
        currentApiIndex: 'youtube-current-api-index',
        channels: 'youtube-channels',
        monitoringChannels: 'youtube-monitoring-channels',
        trackingChannels: 'youtube-tracking-channels-storage',
        subscriberData: 'youtube-subscriber-data',
        trackingData: 'youtube-channel-tracking-data',
        selectedTracking: 'youtube-selected-tracking-channels',
        dailySubscriber: 'daily-subscriber-data',
        testResults: 'thumbnail-test-results',
        showAllChannels: 'show-all-channels',
        hotVideoRatio: 'hot-video-ratio',
        subscriberRange: 'selected-subscriber-range',
        customMinSubs: 'custom-min-subscribers',
        customMaxSubs: 'custom-max-subscribers'
    }
};

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log(`YouTube 채널 모니터 v${APP_CONFIG.version} 시작`);
    
    // 브라우저 호환성 확인
    if (!checkBrowserCompatibility()) {
        alert('이 브라우저는 일부 기능을 지원하지 않을 수 있습니다. 최신 브라우저 사용을 권장합니다.');
    }
    
    // 초기화 순서가 중요함
    initializeApp();
});

// 메인 앱 초기화
async function initializeApp() {
    try {
        showLoading(true);
        
        // 1. 기본 초기화
        console.log('1. 기본 초기화 시작...');
        await initializeBasicFeatures();
        
        // 2. 데이터 로드
        console.log('2. 저장된 데이터 로드...');
        await loadStoredData();
        
        // 3. 이벤트 설정
        console.log('3. 이벤트 리스너 설정...');
        initializeAllEvents();
        
        // 4. UI 초기화
        console.log('4. UI 초기화...');
        await initializeUI();
        
        // 5. 고급 기능 초기화
        console.log('5. 고급 기능 초기화...');
        await initializeAdvancedFeatures();
        
        console.log('앱 초기화 완료!');
        showTemporaryMessage('YouTube 채널 모니터가 준비되었습니다!', 'success');
        
    } catch (error) {
        console.error('앱 초기화 오류:', error);
        showTemporaryMessage('초기화 중 오류가 발생했습니다.', 'error');
    } finally {
        showLoading(false);
    }
}

// 기본 기능 초기화
async function initializeBasicFeatures() {
    // 탭 전환 기능
    initializeTabs();
    
    // 구독자 수 추적 차트
    initializeSubscriberChart();
    
    // 키보드 단축키
    initializeKeyboardShortcuts();
    
    // 지연 로딩
    initializeLazyLoading();
    
    // 접기/펼치기 섹션
    initializeCollapsibleSections();
}

// 구독자 수 차트 초기화
function initializeSubscriberChart() {
    const ctx = document.getElementById('subscriber-chart');
    if (!ctx) return;
    
    subscriberChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// 접기/펼치기 섹션 초기화
function initializeCollapsibleSections() {
    // 저장된 상태 불러오기
    const monitoringCollapsed = localStorage.getItem('monitoring-channel-management-collapsed') === 'true';
    const trackingCollapsed = localStorage.getItem('tracking-channel-management-collapsed') === 'true';
    
    if (monitoringCollapsed) {
        toggleChannelManagementSection('monitoring', true);
    }
    
    if (trackingCollapsed) {
        toggleChannelManagementSection('tracking', true);
    }
}

// 탭 초기화
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // 기본 탭 활성화
    switchTab('channel-monitor');
}

// 탭 전환
function switchTab(tabName) {
    // 모든 탭 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 선택된 탭 활성화
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(tabName);
    
    if (tabButton && tabContent) {
        tabButton.classList.add('active');
        tabContent.classList.add('active');
        
        // 탭별 초기화
        handleTabSwitch(tabName);
    }
}

// 탭 전환 시 처리
function handleTabSwitch(tabName) {
    switch(tabName) {
        case 'channel-monitor':
            renderMonitoringChannelGrid();
            renderLatestVideos();
            break;
        case 'video-search':
            // 검색 탭 - 특별한 초기화 불필요
            break;
        case 'subscriber-tracking':
            renderTrackingChannelGrid();
            renderTrackingChannelSelection();
            updateSubscriberChart();
            renderSubscriberDataList();
            break;
        case 'thumbnail-test':
            loadThumbnailTestRecords();
            break;
    }
}

// 저장된 데이터 로드
async function loadStoredData() {
    const loadTasks = [
        loadApiKeys(),
        loadChannelData(),
        loadSubscriberData(),
        loadTrackingData(),
        loadUserSettings()
    ];
    
    await Promise.all(loadTasks);
}

// API 키 로드
function loadApiKeys() {
    const storedApiKeys = safeGetFromStorage(APP_CONFIG.storageKeys.apiKeys);
    const storedApiIndex = safeGetFromStorage(APP_CONFIG.storageKeys.currentApiIndex);
    
    if (storedApiKeys && Array.isArray(storedApiKeys)) {
        apiKeys = storedApiKeys;
        currentApiIndex = parseInt(storedApiIndex) || 0;
        updateApiStatus();
    }
}

// 채널 데이터 로드
function loadChannelData() {
    // 기존 채널 데이터
    const storedChannels = safeGetFromStorage(APP_CONFIG.storageKeys.channels);
    if (storedChannels && Array.isArray(storedChannels)) {
        channels = storedChannels;
    }
    
    // 모니터링 채널 데이터
    const storedMonitoringChannels = safeGetFromStorage(APP_CONFIG.storageKeys.monitoringChannels);
    if (storedMonitoringChannels && Array.isArray(storedMonitoringChannels)) {
        monitoringChannels = storedMonitoringChannels;
    }
    
    // 추적 채널 데이터
    const storedTrackingChannels = safeGetFromStorage(APP_CONFIG.storageKeys.trackingChannels);
    if (storedTrackingChannels && Array.isArray(storedTrackingChannels)) {
        trackingChannels = storedTrackingChannels;
    }
    
    // 선택된 추적 채널
    const storedSelectedTracking = safeGetFromStorage(APP_CONFIG.storageKeys.selectedTracking);
    if (storedSelectedTracking && Array.isArray(storedSelectedTracking)) {
        selectedTrackingChannels = new Set(storedSelectedTracking);
    } else if (trackingChannels.length > 0) {
        // 선택 내역이 없고, 추적 채널이 있다면 모두 선택
        trackingChannels.forEach(ch => selectedTrackingChannels.add(ch.id));
        safeSetToStorage(APP_CONFIG.storageKeys.selectedTracking, [...selectedTrackingChannels]);
    }
}

// 구독자 데이터 로드
function loadSubscriberData() {
    const storedSubscriberData = safeGetFromStorage(APP_CONFIG.storageKeys.subscriberData);
    if (storedSubscriberData && typeof storedSubscriberData === 'object') {
        subscriberData = storedSubscriberData;
    }
}

// 추적 데이터 로드
function loadTrackingData() {
    const storedTrackingData = safeGetFromStorage(APP_CONFIG.storageKeys.trackingData);
    if (storedTrackingData && Array.isArray(storedTrackingData)) {
        channelTrackingData = storedTrackingData;
    }
}

// 사용자 설정 로드
function loadUserSettings() {
    // 전체 채널 보기 설정
    const showAllChannels = safeGetFromStorage(APP_CONFIG.storageKeys.showAllChannels);
    if (showAllChannels === true) {
        const checkbox = document.getElementById('show-all-channels');
        if (checkbox) checkbox.checked = true;
    }
    
    // 핫 영상 비율 설정
    const hotVideoRatio = safeGetFromStorage(APP_CONFIG.storageKeys.hotVideoRatio);
    if (hotVideoRatio) {
        const select = document.getElementById('hot-video-ratio');
        if (select) select.value = hotVideoRatio;
    }
}

// UI 초기화
async function initializeUI() {
    // 채널 그리드 렌더링
    renderChannelGrid();
    renderMonitoringChannelGrid();
    renderTrackingChannelGrid();
    
    // 추적 채널 선택 렌더링
    renderTrackingChannelSelection();
    
    // 구독자 차트 업데이트
    updateSubscriberChart();
    renderSubscriberDataList();
    updateLastCollectionInfo();
    
    // 추적 결과 렌더링
    renderChannelTrackingRecords();
    
    // 채널 수 업데이트
    updateChannelCounts();
    
    // 빈 상태 업데이트
    updateEmptyState();
    
    // 썸네일 테스트 기록 로드
    loadThumbnailTestRecords();
}

// 고급 기능 초기화
async function initializeAdvancedFeatures() {
    // 자동 백업 (선택사항)
    scheduleAutoBackup();
    
    // 성능 모니터링
    initializePerformanceMonitoring();
    
    // 오류 리포팅
    initializeErrorReporting();
    
    // 업데이트 확인
    checkForUpdates();
}

// 자동 백업 스케줄링
function scheduleAutoBackup() {
    const lastBackup = safeGetFromStorage('last-auto-backup');
    const now = new Date().toISOString().split('T')[0];
    
    if (!lastBackup || lastBackup !== now) {
        // 하루에 한 번 자동 백업
        setTimeout(() => {
            try {
                const backupData = {
                    date: new Date().toISOString(),
                    channels: channels,
                    monitoringChannels: monitoringChannels,
                    trackingChannels: trackingChannels,
                    trackingData: channelTrackingData.slice(0, 10) // 최근 10개만
                };
                
                safeSetToStorage('auto-backup', backupData);
                safeSetToStorage('last-auto-backup', now);
                console.log('자동 백업 완료');
            } catch (error) {
                console.error('자동 백업 실패:', error);
            }
        }, 5000); // 5초 후 실행
    }
}

// 성능 모니터링
function initializePerformanceMonitoring() {
    if (typeof performance !== 'undefined' && performance.mark) {
        performance.mark('app-initialized');
        
        // 메모리 사용량 모니터링 (Chrome only)
        if (performance.memory) {
            setInterval(() => {
                const memoryInfo = {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };
                
                console.log('메모리 사용량:', memoryInfo);
                
                // 메모리 사용량이 높으면 경고
                if (memoryInfo.used > memoryInfo.limit * 0.8) {
                    console.warn('높은 메모리 사용량 감지');
                }
            }, 60000); // 1분마다 체크
        }
    }
}

// 오류 리포팅
function initializeErrorReporting() {
    window.addEventListener('error', function(event) {
        console.error('전역 오류 감지:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
        });
    });
    
    window.addEventListener('unhandledrejection', function(event) {
        console.error('처리되지 않은 Promise 거부:', event.reason);
    });
}

// 업데이트 확인
function checkForUpdates() {
    const lastUpdateCheck = safeGetFromStorage('last-update-check');
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (!lastUpdateCheck || (now - lastUpdateCheck) > oneDay) {
        // 실제 프로덕션에서는 서버에서 버전 정보를 가져올 수 있음
        console.log('업데이트 확인 중...');
        safeSetToStorage('last-update-check', now);
    }
}

// 검색 기능 초기화
async function searchVideos() {
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }
    
    const keyword = document.getElementById('search-keyword').value.trim();
    if (!keyword) {
        alert('검색 키워드를 입력해주세요.');
        return;
    }
    
    showLoading(true);
    
    try {
        const searchParams = getSearchParams();
        searchResults = await performVideoSearch(keyword, searchParams);
        renderSearchResults();
        
    } catch (error) {
        console.error('검색 오류:', error);
        const errorMessage = handleApiError(error);
        showTemporaryMessage(errorMessage, 'error');
    } finally {
        showLoading(false);
    }
}

// 검색 파라미터 가져오기
function getSearchParams() {
    const dateRangeType = document.getElementById('date-range-type').value;
    let dateRange, startDate, endDate;
    
    if (dateRangeType === 'custom') {
        startDate = document.getElementById('start-date').value;
        endDate = document.getElementById('end-date').value;
    } else {
        dateRange = document.getElementById('date-range').value;
    }
    
    return {
        subMin: parseInt(document.getElementById('sub-filter').value) || 0,
        viewMin: parseInt(document.getElementById('view-filter').value) || 0,
        dateRangeType: dateRangeType,
        dateRange: dateRange,
        startDate: startDate,
        endDate: endDate,
        sortOrder: document.getElementById('sort-order').value
    };
}

// 검색 결과 렌더링
function renderSearchResults() {
    const searchResultsContainer = document.getElementById('search-results');
    
    if (searchResults.length === 0) {
        searchResultsContainer.innerHTML = `
            <div class="empty-state">
                <p>검색 결과가 없습니다.</p>
                <p>검색 조건을 조정해보세요.</p>
            </div>
        `;
        return;
    }
    
    searchResultsContainer.innerHTML = searchResults.map(video => `
        <div class="video-card" onclick="openVideo('${video.id}')">
            ${video.thumbnail ? `
                <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail"
                     onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
                     onload="this.nextElementSibling.style.display='none';">
                <div class="video-thumbnail-placeholder-large" style="display: none;">🎥</div>
            ` : `
                <div class="video-thumbnail-placeholder-large">🎥</div>
            `}
            <div class="video-details">
                <h3 class="video-title-inline">${escapeHtml(video.title)}</h3>
                <p class="video-channel">${escapeHtml(video.channelTitle)}</p>
                <div class="video-stats">
                    <span>👁️ ${formatNumber(video.viewCount)}</span>
                    <span>👥 ${formatNumber(video.subscriberCount)}</span>
                    <span>📅 ${formatDate(video.publishedAt)}</span>
                    ${video.ratio > 0 ? `<span class="video-ratio">${video.ratio.toFixed(1)}x</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// 썸네일 테스트 섹션 표시
function showTestSection(sectionId) {
    document.querySelectorAll('.test-section').forEach(section => {
        section.style.display = 'none';
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
}

// 썸네일 테스트 기록 로드
function loadThumbnailTestRecords() {
    const savedResults = safeGetFromStorage(APP_CONFIG.storageKeys.testResults, []);
    const recordsList = document.getElementById('records-list');
    
    if (!recordsList) return;
    
    if (savedResults.length === 0) {
        recordsList.innerHTML = `
            <div class="empty-state">
                <p>아직 테스트 기록이 없습니다.</p>
                <p>썸네일 테스트를 시작해보세요!</p>
            </div>
        `;
        return;
    }
    
    recordsList.innerHTML = savedResults.map(result => `
        <div class="record-item">
            <div class="record-info">
                <div class="record-date">${formatDateForDisplay(result.date.split('T')[0])}</div>
                <div class="record-keyword">키워드: ${result.keyword || '랜덤'}</div>
                ${result.subscriberRange ? `<div class="record-range">범위: ${result.subscriberRange}</div>` : ''}
            </div>
            <div class="record-score">
                <div class="record-score-number">${result.score}/${result.total}</div>
                <div class="record-percentage">${result.percentage}%</div>
            </div>
        </div>
    `).join('');
}

// 테스트 다시 시작
function restartTest() {
    currentQuestion = 0;
    currentScore = 0;
    testVideos = [];
    currentTestVideos = { correct: null, incorrect: null };
    showTestSection('test-intro');
}

// 새 테스트
function newTest() {
    document.getElementById('test-keyword').value = '';
    restartTest();
}

// 테스트 기록 닫기
function closeTestRecords() {
    showTestSection('test-intro');
}

// 테스트 기록 보기
function showTestRecords() {
    loadThumbnailTestRecords();
    showTestSection('test-records');
}

// 앱 종료 시 정리
window.addEventListener('beforeunload', function() {
    // 중요한 데이터 최종 저장
    try {
        if (channels.length > 0) {
            safeSetToStorage(APP_CONFIG.storageKeys.channels, channels);
        }
        if (monitoringChannels.length > 0) {
            safeSetToStorage(APP_CONFIG.storageKeys.monitoringChannels, monitoringChannels);
        }
        if (trackingChannels.length > 0) {
            safeSetToStorage(APP_CONFIG.storageKeys.trackingChannels, trackingChannels);
        }
        if (channelTrackingData.length > 0) {
            safeSetToStorage(APP_CONFIG.storageKeys.trackingData, channelTrackingData);
        }
        
        console.log('앱 종료 시 데이터 저장 완료');
    } catch (error) {
        console.error('앱 종료 시 데이터 저장 실패:', error);
    }
});

// 개발자 도구 (개발 모드에서만)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.YTMonitor = {
        config: APP_CONFIG,
        data: {
            channels: () => channels,
            monitoringChannels: () => monitoringChannels,
            trackingChannels: () => trackingChannels,
            subscriberData: () => subscriberData,
            trackingData: () => channelTrackingData
        },
        utils: {
            clearAllData: () => {
                Object.values(APP_CONFIG.storageKeys).forEach(key => {
                    localStorage.removeItem(key);
                });
                location.reload();
            },
            exportData: () => {
                const data = {
                    channels, monitoringChannels, trackingChannels,
                    subscriberData, channelTrackingData
                };
                console.log('전체 데이터:', data);
                return data;
            }
        }
    };
    
    console.log('개발자 도구가 window.YTMonitor에서 사용 가능합니다.');
}


// ========== script.js ==========
// 전역 변수
apiKeys =  [];
let currentApiIndex = 0;
let channels = [];
let monitoringChannels = [];  // 모니터링 전용 채널
let trackingChannels = [];    // 구독자 추적 전용 채널
let searchResults = [];
let videoList = []; // 또는 const, var도 가능
let subscriberData = {};  // 채널별 구독자 데이터 저장
let subscriberChart = null;
let channelTrackingData = [];
let channelSearchResults = [];
let selectedTrackingChannels = new Set(); // 구독자 수 추적 대상 채널들



// 썸네일 테스트 관련 변수
let thumbnailTestData = [];
let currentQuestion = 0;
let currentScore = 0;
let testKeyword = '';
let testVideos = [];
let currentTestVideos = { correct: null, incorrect: null };

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadStoredData();
    initializeSubscriberTracking();
    initializeCollapsibleSections();
});

// 앱 초기화
function initializeApp() {
    // 탭 전환 이벤트
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // API 설정
    document.getElementById('api-settings-btn').addEventListener('click', openApiModal);
    document.getElementById('save-api-btn').addEventListener('click', saveApiKeys);
    document.getElementById('cancel-api-btn').addEventListener('click', closeApiModal);
    document.getElementById('reset-api-rotation').addEventListener('click', resetApiRotation);
	document.getElementById('hot-video-ratio').addEventListener('change', function() {
    
});
    
    // 기존 채널 관리 (호환성을 위해 유지)
    if (document.getElementById('add-channel-btn')) {
        document.getElementById('add-channel-btn').addEventListener('click', () => openChannelModal('general'));
    }
    
    // 독립적인 채널 추가 버튼들
    document.getElementById('add-monitoring-channel-btn').addEventListener('click', () => openChannelModal('monitoring'));
    document.getElementById('add-tracking-channel-btn').addEventListener('click', () => openChannelModal('tracking'));
    
    document.getElementById('add-channel-confirm-btn').addEventListener('click', handleChannelInput);
    document.getElementById('cancel-channel-btn').addEventListener('click', closeChannelModal);
    
    // 채널 선택 모달
    document.getElementById('cancel-channel-selection-btn').addEventListener('click', closeChannelSelectionModal);
    
    // 채널 추적
    document.getElementById('track-channels-btn').addEventListener('click', startChannelTracking);
    document.getElementById('backup-tracking-data-btn').addEventListener('click', backupTrackingData);
    document.getElementById('restore-tracking-data-btn').addEventListener('click', () => {
        document.getElementById('restore-tracking-data-input').click();
    });
    document.getElementById('restore-tracking-data-input').addEventListener('change', restoreTrackingData);
    
    // 추적 결과 정렬
    document.getElementById('tracking-sort-order').addEventListener('change', sortTrackingResults);
    document.getElementById('search-btn').addEventListener('click', searchVideos);
    document.getElementById('search-keyword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchVideos();
        }
    });
    
    // 전체 채널 보기 토글
    document.getElementById('show-all-channels').addEventListener('change', function() {
        localStorage.setItem('show-all-channels', this.checked);
        renderChannelTrackingRecords();
    });
    
    // 영상 검색 - 날짜 범위 타입 변경
    document.getElementById('date-range-type').addEventListener('change', function() {
        const dateRange = document.getElementById('date-range');
        const customDateRange = document.getElementById('custom-date-range');
        
        if (this.value === 'custom') {
            dateRange.style.display = 'none';
            customDateRange.style.display = 'flex';
        } else {
            dateRange.style.display = 'block';
            customDateRange.style.display = 'none';
        }
    });
    
    // 구독자 수 추적
    document.getElementById('collect-subscriber-data-btn').addEventListener('click', collectTodaySubscriberData);
    document.getElementById('chart-channel-select').addEventListener('change', updateSubscriberChart);

	// 썸네일 테스트
    document.getElementById('start-test-btn').addEventListener('click', startThumbnailTest);
    document.getElementById('view-records-btn').addEventListener('click', showTestRecords);
    document.getElementById('restart-test-btn').addEventListener('click', restartTest);
    document.getElementById('new-test-btn').addEventListener('click', newTest);
    document.getElementById('close-records-btn').addEventListener('click', closeTestRecords);

	
    // 모달 외부 클릭 시 닫기
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });
}

// 구독자 수 추적 초기화
function initializeSubscriberTracking() {
    // Chart.js 차트 초기화
    const ctx = document.getElementById('subscriber-chart').getContext('2d');
    subscriberChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 10
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// 새로 추가
// 접기/펼치기 섹션 초기화
function initializeCollapsibleSections() {
    // 저장된 상태 불러오기
    const monitoringCollapsed = localStorage.getItem('monitoring-channel-management-collapsed') === 'true';
    const trackingCollapsed = localStorage.getItem('tracking-channel-management-collapsed') === 'true';
    
    if (monitoringCollapsed) {
        toggleChannelManagementSection('monitoring', true);
    }
    
    if (trackingCollapsed) {
        toggleChannelManagementSection('tracking', true);
    }
}

// 채널 관리 섹션 접기/펼치기
function toggleChannelManagementSection(type, forceCollapse = false) {
    const grid = document.getElementById(`${type}-channel-grid`);
    const collapseBtn = document.getElementById(`${type}-collapse-btn`);
    const isCurrentlyCollapsed = grid.style.display === 'none';
    
    if (forceCollapse || !isCurrentlyCollapsed) {
        // 접기
        grid.style.display = 'none';
        collapseBtn.textContent = '▶';
        localStorage.setItem(`${type}-channel-management-collapsed`, 'true');
    } else {
        // 펼치기
        grid.style.display = 'grid';
        collapseBtn.textContent = '▼';
        localStorage.setItem(`${type}-channel-management-collapsed`, 'false');
    }
}

// 저장된 데이터 로드
function loadStoredData() {
    const storedApiKeys = localStorage.getItem('youtube-api-keys');
    const storedApiIndex = localStorage.getItem('youtube-current-api-index');
    const storedChannels = localStorage.getItem('youtube-channels');
    const storedMonitoringChannels = localStorage.getItem('youtube-monitoring-channels');
    const storedTrackingChannelsStorage = localStorage.getItem('youtube-tracking-channels-storage');
    const storedSubscriberData = localStorage.getItem('youtube-subscriber-data');
    const storedTrackingData = localStorage.getItem('youtube-channel-tracking-data');
    const storedSelectedTrackingChannels = localStorage.getItem('youtube-selected-tracking-channels');
    
    if (storedApiKeys) {
        apiKeys = JSON.parse(storedApiKeys);
        currentApiIndex = parseInt(storedApiIndex) || 0;
        updateApiStatus();
    }
    
    // 기존 채널 데이터 로드
    if (storedChannels) {
        channels = JSON.parse(storedChannels);
        setTimeout(() => {
            renderChannelGrid();
        }, 100);
    }
    
    // 독립적인 채널 데이터 로드
    if (storedMonitoringChannels) {
        monitoringChannels = JSON.parse(storedMonitoringChannels);
        setTimeout(() => renderMonitoringChannelGrid(), 100);
    }
    
    if (storedTrackingChannelsStorage) {
        trackingChannels = JSON.parse(storedTrackingChannelsStorage);
        setTimeout(() => renderTrackingChannelGrid(), 100);
    }
    
    if (storedSubscriberData) {
        subscriberData = JSON.parse(storedSubscriberData);
        setTimeout(() => {
            updateSubscriberChart();
            renderSubscriberDataList();
            updateLastCollectionInfo();
        }, 100);
    }

    if (storedTrackingData) {
        channelTrackingData = JSON.parse(storedTrackingData);
        renderChannelTrackingRecords();
    }
    
	if (storedSelectedTrackingChannels) {
		// 저장된 선택 내역이 있을 경우, 그걸 사용
		selectedTrackingChannels = new Set(JSON.parse(storedSelectedTrackingChannels));
	} else if (trackingChannels.length > 0) {
		// 선택 내역이 없고, 추적 채널이 있다면 => 모두 선택!
		trackingChannels.forEach(ch => selectedTrackingChannels.add(ch.id));
		localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
	}

    
    // 전체 채널 보기 설정 로드
    const showAllChannels = localStorage.getItem('show-all-channels');
    if (showAllChannels === 'true') {
        document.getElementById('show-all-channels').checked = true;
    }
    
    setTimeout(() => {
        updateChannelCounts();
        renderTrackingChannelSelection();
        updateEmptyState();
    }, 200);
}

// 빈 상태 메시지 업데이트
function updateEmptyState() {
    const trackingContainer = document.getElementById('tracking-records');
    if ((monitoringChannels.length > 0 || channels.length > 0) && channelTrackingData.length === 0) {
        trackingContainer.innerHTML = `
            <div class="empty-state">
                <p>채널이 등록되었습니다. 추적을 시작해보세요.</p>
                <button class="btn btn-primary" onclick="document.getElementById('track-channels-btn').click()">
                    첫 번째 추적 시작하기
                </button>
            </div>
        `;
    }
}

// 탭 전환
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    // 탭별 초기화
    switch(tabName) {
        case 'channel-monitor':
			renderMonitoringChannelGrid();
			renderLatestVideos(); // 이 줄 추가
			break;
        case 'subscriber-tracking':
            renderTrackingChannelGrid();
            renderTrackingChannelSelection();
            updateSubscriberChart();
            break;

    	case 'thumbnail-test':
	    loadThumbnailTestRecords();
	    break;
    }
}

// API 키 관리
function openApiModal() {
    document.getElementById('api-modal').style.display = 'block';
    
    for (let i = 0; i < 5; i++) {
        const input = document.getElementById(`api-key-${i + 1}`);
        input.value = apiKeys[i] || '';
    }
    
    updateCurrentApiDisplay();
}

function closeApiModal() {
    document.getElementById('api-modal').style.display = 'none';
}

function saveApiKeys() {
    const newApiKeys = [];
    
    for (let i = 0; i < 5; i++) {
        const value = document.getElementById(`api-key-${i + 1}`).value.trim();
        if (value) {
            newApiKeys.push(value);
        }
    }
    
    if (newApiKeys.length === 0) {
        alert('최소 하나의 API 키를 입력해주세요.');
        return;
    }
    
    apiKeys = newApiKeys;
    currentApiIndex = 0;
    
    localStorage.setItem('youtube-api-keys', JSON.stringify(apiKeys));
    localStorage.setItem('youtube-current-api-index', currentApiIndex.toString());
    
    updateApiStatus();
    closeApiModal();
}

function updateApiStatus() {
    const statusText = document.getElementById('api-status-text');
    if (apiKeys.length > 0) {
        statusText.textContent = `API 키 ${apiKeys.length}개 설정됨 (현재: #${currentApiIndex + 1})`;
    } else {
        statusText.textContent = 'API 키 설정 필요';
    }
}

function updateCurrentApiDisplay() {
    const currentApiSpan = document.getElementById('current-api-index');
    if (apiKeys.length > 0) {
        currentApiSpan.textContent = `#${currentApiIndex + 1} (총 ${apiKeys.length}개)`;
    } else {
        currentApiSpan.textContent = '-';
    }
}

function resetApiRotation() {
    if (apiKeys.length > 0) {
        currentApiIndex = 0;
        localStorage.setItem('youtube-current-api-index', currentApiIndex.toString());
        updateApiStatus();
        updateCurrentApiDisplay();
        alert('API 순환이 첫 번째 키로 초기화되었습니다.');
    }
}

function getCurrentApiKey() {
    if (apiKeys.length === 0) {
        throw new Error('설정된 API 키가 없습니다.');
    }
    return apiKeys[currentApiIndex];
}

function rotateToNextApiKey() {
    if (apiKeys.length <= 1) {
        throw new Error('사용 가능한 다른 API 키가 없습니다.');
    }
    
    currentApiIndex = (currentApiIndex + 1) % apiKeys.length;
    localStorage.setItem('youtube-current-api-index', currentApiIndex.toString());
    updateApiStatus();
    
    console.log(`API 키 순환: #${currentApiIndex + 1} 사용`);
}

// 채널 ID 유효성 검사 함수
function isValidChannelId(channelId) {
    return channelId && typeof channelId === 'string' && /^UC[a-zA-Z0-9_-]{22}$/.test(channelId);
}

// 기존 채널 그리드 렌더링 (호환성을 위해 유지)
function renderChannelGrid() {
    const channelGrid = document.getElementById('channel-grid');
    if (!channelGrid) return;
    
    const channelCountSpan = document.getElementById('channel-count');
    if (channelCountSpan) {
        channelCountSpan.textContent = channels.length;
    }

    if (channels.length === 0) {
        channelGrid.innerHTML = `
            <div class="channel-grid-empty">
                <p>등록된 채널이 없습니다</p>
                <button class="btn btn-primary" onclick="openChannelModal('general')">
                    첫 번째 채널 추가하기
                </button>
            </div>
        `;
        return;
    }

    channelGrid.innerHTML = channels.map(channel => generateChannelItemHTML(channel, 'general')).join('');
}

// 독립적인 채널 그리드 렌더링 함수들
function renderMonitoringChannelGrid() {
    const channelGrid = document.getElementById('monitoring-channel-grid');
    const channelCountSpan = document.getElementById('monitoring-channel-count');
    
    if (channelCountSpan) {
        channelCountSpan.textContent = monitoringChannels.length;
    }
    
    if (monitoringChannels.length === 0) {
        channelGrid.innerHTML = `
            <div class="channel-grid-empty">
                <p>등록된 모니터링 채널이 없습니다</p>
                <button class="btn btn-primary" onclick="openChannelModal('monitoring')">
                    첫 번째 채널 추가하기
                </button>
            </div>
        `;
        return;
    }
    
    // 구독자 수 내림차순 정렬 추가
    const sortedChannels = [...monitoringChannels].sort((a, b) => b.subscriberCount - a.subscriberCount);
    
    channelGrid.innerHTML = sortedChannels.map(channel => generateChannelItemHTML(channel, 'monitoring')).join('');
    renderLatestVideos();
}

function renderTrackingChannelGrid() {
    const channelGrid = document.getElementById('tracking-channel-grid');
    const channelCountSpan = document.getElementById('tracking-channel-count');
    
    if (channelCountSpan) {
        channelCountSpan.textContent = trackingChannels.length;
    }
    
    if (trackingChannels.length === 0) {
        channelGrid.innerHTML = `
            <div class="channel-grid-empty">
                <p>등록된 추적 채널이 없습니다</p>
                <button class="btn btn-primary" onclick="openChannelModal('tracking')">
                    첫 번째 채널 추가하기
                </button>
            </div>
        `;
        return;
    }
    
    channelGrid.innerHTML = trackingChannels.map(channel => generateChannelItemHTML(channel, 'tracking')).join('');
}

// 채널 아이템 HTML 생성 함수
function generateChannelItemHTML(channel, type) {
    return `
        <div class="channel-item" data-channel-id="${channel.id}">
            <div class="channel-item-header">
                <div class="channel-info-with-logo">
                    ${channel.thumbnail ? `
                        <img src="${channel.thumbnail}" 
                             alt="${channel.name}" 
                             class="channel-logo"
                             onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
                             onload="this.nextElementSibling.style.display='none';">
                        <div class="channel-logo-placeholder" style="display: none;">📺</div>
                    ` : `
                        <div class="channel-logo-placeholder">📺</div>
                    `}
                    <div class="channel-text-info">
                        <h4 class="channel-name" onclick="openChannel('${channel.id}')" title="채널로 이동">${channel.name}</h4>
                        <span class="channel-subscribers">
			    구독자 ${formatNumber(channel.subscriberCount)}명
			    ${getSubscriberGrowthHTML(channel.id, channel.subscriberCount)}
			</span>
                    </div>
                </div>
                <div class="channel-actions">
                    <button class="btn-icon edit" onclick="editChannel('${channel.id}', '${type}')" title="채널 정보 새로고침">
                        🔄
                    </button>
                    <button class="btn-icon delete" onclick="removeChannelFromGrid('${channel.id}', '${type}')" title="채널 삭제">
                        🗑️
                    </button>
                </div>
            </div>
            <div class="channel-info">
                <span class="channel-added">${getTimeAgo(channel.addedAt || new Date().toISOString())}</span>
            </div>
            <div class="channel-id">${channel.id}</div>
            <div class="channel-status">
                <div class="status-indicator ${getChannelStatus(channel)}"></div>
                <span>${getChannelStatusText(channel)}</span>
            </div>
        </div>
    `;
}

// renderTrackingChannelSelection() 함수 교체
	function renderTrackingChannelSelection() {
		const container = document.getElementById('tracking-channels-selection');
		
		// 구독자수 추적 탭의 채널만 표시 (trackingChannels만 사용)
		if (trackingChannels.length === 0) {
			container.innerHTML = `
				<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #666;">
					<p>추적할 채널이 없습니다.</p>
					<p>먼저 위의 "등록된 채널 관리"에서 채널을 추가해주세요.</p>
				</div>
			`;
			return;
		}
		
		container.innerHTML = trackingChannels.map(channel => `
			<div class="tracking-channel-option ${selectedTrackingChannels.has(channel.id) ? 'selected' : ''}" 
				 onclick="toggleTrackingChannel('${channel.id}')">
				<input type="checkbox" 
					   class="tracking-channel-checkbox" 
					   ${selectedTrackingChannels.has(channel.id) ? 'checked' : ''}
					   onchange="toggleTrackingChannel('${channel.id}')">
				<div class="tracking-channel-info">
					${channel.thumbnail ? `
						<img src="${channel.thumbnail}" 
							 alt="${channel.name}" 
							 class="tracking-channel-logo"
							 onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
							 onload="this.nextElementSibling.style.display='none';">
						<div class="tracking-channel-logo-placeholder" style="display: none;">📺</div>
					` : `
						<div class="tracking-channel-logo-placeholder">📺</div>
					`}
					<div class="tracking-channel-text">
						<div class="tracking-channel-name">${channel.name}</div>
						<div class="tracking-channel-subscribers">구독자 ${formatNumber(channel.subscriberCount)}명</div>
					</div>
				</div>
				<button class="btn-icon delete" onclick="event.stopPropagation(); removeChannelFromTracking('${channel.id}')" title="채널 삭제" style="margin-left: auto; margin-right: 0.5rem;">
					🗑️
				</button>
			</div>
		`).join('');
		
		updateChartChannelSelect();
	}

// 추적 채널 토글
function toggleTrackingChannel(channelId) {
    if (selectedTrackingChannels.has(channelId)) {
        selectedTrackingChannels.delete(channelId);
    } else {
        selectedTrackingChannels.add(channelId);
    }
    
    localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
    renderTrackingChannelSelection();
}

// 전체선택/전체해제 함수들
function selectAllTrackingChannels() {
    trackingChannels.forEach(channel => {
        selectedTrackingChannels.add(channel.id);
    });
    localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
    renderTrackingChannelSelection();
}

function deselectAllTrackingChannels() {
    selectedTrackingChannels.clear();
    localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
    renderTrackingChannelSelection();
}

// 추적 대상에서 채널 제거 함수
function removeChannelFromTracking(channelId) {
    const channel = trackingChannels.find(ch => ch.id === channelId);
    if (channel && confirm(`"${channel.name}" 채널을 삭제하시겠습니까?`)) {
        const index = trackingChannels.findIndex(ch => ch.id === channelId);
        trackingChannels.splice(index, 1);
        
        selectedTrackingChannels.delete(channelId);
        delete subscriberData[channelId];
        
        localStorage.setItem('youtube-tracking-channels-storage', JSON.stringify(trackingChannels));
        localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
        localStorage.setItem('youtube-subscriber-data', JSON.stringify(subscriberData));
        
        renderTrackingChannelGrid();
        renderTrackingChannelSelection();
        updateSubscriberChart();
        renderSubscriberDataList();
        updateChannelCounts();
        
        showTemporaryMessage(`"${channel.name}" 채널이 삭제되었습니다.`);
    }
}

// updateChartChannelSelect() 함수 교체
function updateChartChannelSelect() {
    const select = document.getElementById('chart-channel-select');
    const selectedChannels = trackingChannels.filter(ch => selectedTrackingChannels.has(ch.id));
    
    select.innerHTML = `
        <option value="all">전체 채널 비교</option>
        ${selectedChannels.map(channel => 
            `<option value="${channel.id}">${channel.name}</option>`
        ).join('')}
    `;
}

// 채널 카운트 업데이트 함수
function updateChannelCounts() {
    const channelCount = document.getElementById('channel-count');
    const monitoringChannelCount = document.getElementById('monitoring-channel-count');
    const trackingChannelCount = document.getElementById('tracking-channel-count');
    
    if (channelCount) channelCount.textContent = channels.length;
    if (monitoringChannelCount) monitoringChannelCount.textContent = monitoringChannels.length;
    if (trackingChannelCount) trackingChannelCount.textContent = trackingChannels.length;
}

// 오늘 구독자 수 수집
async function collectTodaySubscriberData() {
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }
    
    if (selectedTrackingChannels.size === 0) {
        alert('추적할 채널을 선택해주세요.');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const todayKST = getKoreanDate();
    
    // 오늘 이미 수집했는지 확인
    const existingData = Object.values(subscriberData).some(channelData => 
        channelData.some(record => record.date === todayKST)
    );
    
    if (existingData) {
        if (!confirm('오늘 이미 수집된 데이터가 있습니다. 덮어쓰시겠습니까?')) {
            return;
        }
    }
    
    showLoading(true);
    
    try {
        let successCount = 0;
        let errorCount = 0;
        
        for (const channelId of selectedTrackingChannels) {
            try {
                // 모든 채널 목록에서 채널 찾기
                const allChannels = [...trackingChannels, ...channels];
                const channel = trackingChannels.find(ch => ch.id === channelId);
                if (!channel) continue;
                
                const channelInfo = await fetchChannelInfo(channelId);
                const currentSubscribers = parseInt(channelInfo.statistics.subscriberCount) || 0;
                
                // 채널별 데이터 초기화
                if (!subscriberData[channelId]) {
                    subscriberData[channelId] = [];
                }
                
                // 오늘 데이터가 있으면 업데이트, 없으면 추가
                const existingIndex = subscriberData[channelId].findIndex(record => record.date === todayKST);
                
                if (existingIndex !== -1) {
                    subscriberData[channelId][existingIndex].count = currentSubscribers;
                } else {
                    subscriberData[channelId].push({
                        date: todayKST,
                        count: currentSubscribers
                    });
                }
                
                // 날짜순 정렬
                subscriberData[channelId].sort((a, b) => new Date(a.date) - new Date(b.date));
                
                successCount++;
                
            } catch (error) {
                console.error(`채널 ${channelId} 구독자 수 수집 오류:`, error);
                errorCount++;
            }
        }
        
        localStorage.setItem('youtube-subscriber-data', JSON.stringify(subscriberData));
        
        updateSubscriberChart();
        renderSubscriberDataList();
        updateLastCollectionInfo();
        
        if (errorCount > 0) {
            alert(`구독자 수 수집 완료: ${successCount}개 성공, ${errorCount}개 실패`);
        } else {
            alert(`${successCount}개 채널의 구독자 수가 수집되었습니다.`);
        }
        
    } catch (error) {
        console.error('구독자 수 수집 오류:', error);
        alert('구독자 수 수집 중 오류가 발생했습니다: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// 한국 시간 기준 날짜 반환
function getKoreanDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const koreaTime = new Date(utc + (9 * 3600000));
    return koreaTime.toISOString().split('T')[0];
}

// 마지막 수집 정보 업데이트
function updateLastCollectionInfo() {
    const infoElement = document.getElementById('last-collection-info');
    
    if (Object.keys(subscriberData).length === 0) {
        infoElement.textContent = '마지막 수집: -';
        return;
    }
    
    // 모든 채널의 가장 최신 데이터 찾기
    let latestDate = null;
    
    Object.values(subscriberData).forEach(channelData => {
        if (channelData.length > 0) {
            const channelLatest = channelData[channelData.length - 1].date;
            if (!latestDate || channelLatest > latestDate) {
                latestDate = channelLatest;
            }
        }
    });
    
    if (latestDate) {
        const today = getKoreanDate();
        const daysDiff = Math.floor((new Date(today) - new Date(latestDate)) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 0) {
            infoElement.textContent = '마지막 수집: 오늘';
        } else if (daysDiff === 1) {
            infoElement.textContent = '마지막 수집: 어제';
        } else {
            infoElement.textContent = `마지막 수집: ${daysDiff}일 전`;
        }
    } else {
        infoElement.textContent = '마지막 수집: -';
    }
}

// 구독자 수 차트 업데이트
function updateSubscriberChart() {
    const selectedChannelId = document.getElementById('chart-channel-select').value;
    
    if (selectedChannelId === 'all') {
        // 전체 채널 비교
        updateMultiChannelChart();
    } else {
        // 단일 채널
        updateSingleChannelChart(selectedChannelId);
    }
}

// 단일 채널 차트 업데이트
function updateSingleChannelChart(channelId) {
    const channelData = subscriberData[channelId] || [];
    const allChannels = [...trackingChannels, ...channels];
    const channel = allChannels.find(ch => ch.id === channelId);
    
    const labels = channelData.map(item => formatDateForChart(item.date));
    const data = channelData.map(item => item.count);
    
    subscriberChart.data.labels = labels;
    subscriberChart.data.datasets = [{
        label: channel ? channel.name : '채널',
        data: data,
        borderColor: '#764ba2',
        backgroundColor: 'rgba(118, 75, 162, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#764ba2',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6
    }];
    
    subscriberChart.update();
}

// 다중 채널 차트 업데이트
function updateMultiChannelChart() {
    const colors = [
        '#764ba2', '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
        '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#e91e63'
    ];
    
    // 모든 날짜 수집
    const allDates = new Set();
    Object.values(subscriberData).forEach(channelData => {
        channelData.forEach(record => allDates.add(record.date));
    });
    
    const sortedDates = Array.from(allDates).sort();
    const labels = sortedDates.map(date => formatDateForChart(date));
    
    // 각 채널별 데이터셋 생성
    const datasets = [];
    let colorIndex = 0;
    const allChannels = [...trackingChannels, ...channels];
    
    for (const channelId of selectedTrackingChannels) {
        const channel = allChannels.find(ch => ch.id === channelId);
        const channelData = subscriberData[channelId] || [];
        
        // 날짜별 데이터 매핑
        const data = sortedDates.map(date => {
            const record = channelData.find(r => r.date === date);
            return record ? record.count : null;
        });
        
        if (data.some(d => d !== null)) {
            datasets.push({
                label: channel ? channel.name : `채널 ${colorIndex + 1}`,
                data: data,
                borderColor: colors[colorIndex % colors.length],
                backgroundColor: colors[colorIndex % colors.length] + '20',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: colors[colorIndex % colors.length],
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4
            });
            colorIndex++;
        }
    }
    
    subscriberChart.data.labels = labels;
    subscriberChart.data.datasets = datasets;
    subscriberChart.update();
}

// 구독자 수 데이터 목록 렌더링
function renderSubscriberDataList() {
    const listContainer = document.getElementById('subscriber-data-list');
    
    if (Object.keys(subscriberData).length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state" style="color: #666;">
                <p>아직 기록된 데이터가 없습니다.</p>
                <p>상단의 "오늘 구독자 수 수집" 버튼을 눌러 시작해보세요.</p>
            </div>
        `;
        return;
    }
    
    // 모든 데이터를 날짜별로 그룹화
    const dateGroups = {};
    const allChannels = [...trackingChannels, ...channels];
    
    Object.entries(subscriberData).forEach(([channelId, channelData]) => {
        const channel = allChannels.find(ch => ch.id === channelId);
        
        channelData.forEach(record => {
            if (!dateGroups[record.date]) {
                dateGroups[record.date] = {};
            }
            dateGroups[record.date][channelId] = {
                channel: channel,
                count: record.count
            };
        });
    });
    
    // 날짜순 정렬 (최신순)
    const sortedDates = Object.keys(dateGroups).sort().reverse();
    
    listContainer.innerHTML = sortedDates.map(date => {
        const dateData = dateGroups[date];
        
        return `
            <div class="data-item">
                <div>
                    <div class="data-date">${formatDateForDisplay(date)}</div>
                    <div style="margin-top: 0.5rem;">
                        ${Object.entries(dateData).map(([channelId, data]) => {
                            const prevData = getPreviousDateData(channelId, date);
                            let growthInfo = '';
                            
                            if (prevData) {
                                const growth = data.count - prevData;
                                const growthPercent = ((growth / prevData) * 100).toFixed(1);
                                
                                if (growth > 0) {
                                    growthInfo = `<span class="data-growth growth-positive">+${formatNumber(growth)} (+${growthPercent}%)</span>`;
                                } else if (growth < 0) {
                                    growthInfo = `<span class="data-growth growth-negative">${formatNumber(growth)} (${growthPercent}%)</span>`;
                                } else {
                                    growthInfo = `<span class="data-growth growth-neutral">변화 없음</span>`;
                                }
                            }
                            
                            return `
                                <div style="margin-bottom: 0.25rem;">
                                    <span style="font-weight: 500;">${data.channel?.name || '채널'}</span>: 
                                    <span class="data-subscribers">${formatNumber(data.count)}명</span>
                                    ${growthInfo}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <button class="delete-btn" onclick="deleteSubscriberDataByDate('${date}')">삭제</button>
            </div>
        `;
    }).join('');
}

// 이전 날짜 데이터 찾기
function getPreviousDateData(channelId, currentDate) {
    const channelData = subscriberData[channelId] || [];
    const currentIndex = channelData.findIndex(record => record.date === currentDate);
    
    if (currentIndex > 0) {
        return channelData[currentIndex - 1].count;
    }
    
    return null;
}

// 날짜별 구독자 수 데이터 삭제
function deleteSubscriberDataByDate(date) {
    if (confirm(`${formatDateForDisplay(date)}의 모든 구독자 수 데이터를 삭제하시겠습니까?`)) {
        Object.keys(subscriberData).forEach(channelId => {
            subscriberData[channelId] = subscriberData[channelId].filter(record => record.date !== date);
            
            // 빈 배열이면 채널 데이터 삭제
            if (subscriberData[channelId].length === 0) {
                delete subscriberData[channelId];
            }
        });
        
        localStorage.setItem('youtube-subscriber-data', JSON.stringify(subscriberData));
        
        updateSubscriberChart();
        renderSubscriberDataList();
        updateLastCollectionInfo();
    }
}

// 채널 상태 확인
function getChannelStatus(channel) {
    if (!channel.id || !isValidChannelId(channel.id)) {
        return 'error';
    }
    if (channel.subscriberCount > 0) {
        return '';
    }
    return 'unknown';
}

function getChannelStatusText(channel) {
    if (!channel.id || !isValidChannelId(channel.id)) {
        return '잘못된 채널 ID';
    }
    if (channel.subscriberCount > 0) {
        return '정상';
    }
    return '확인 필요';
}

// 시간 표시 함수
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return '오늘 추가';
    } else if (diffDays < 7) {
        return `${diffDays}일 전`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks}주 전`;
    } else {
        const months = Math.floor(diffDays / 30);
        return `${months}개월 전`;
    }
}

// 수정된 채널 삭제 함수
function removeChannelFromGrid(channelId, type = 'general') {
    let targetChannels, storageKey, renderFunction;
    
    switch(type) {
        case 'monitoring':
            targetChannels = monitoringChannels;
            storageKey = 'youtube-monitoring-channels';
            renderFunction = renderMonitoringChannelGrid;
            break;
        case 'tracking':
            targetChannels = trackingChannels;
            storageKey = 'youtube-tracking-channels-storage';
            renderFunction = renderTrackingChannelGrid;
            break;
        default:
            targetChannels = channels;
            storageKey = 'youtube-channels';
            renderFunction = renderChannelGrid;
    }
    
    const channel = targetChannels.find(ch => ch.id === channelId);
    if (channel && confirm(`"${channel.name}" 채널을 삭제하시겠습니까?`)) {
        const index = targetChannels.findIndex(ch => ch.id === channelId);
        targetChannels.splice(index, 1);
        
        // 구독자 수 추적에서도 제거
        selectedTrackingChannels.delete(channelId);
        delete subscriberData[channelId];
        
        localStorage.setItem(storageKey, JSON.stringify(targetChannels));
        localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
        localStorage.setItem('youtube-subscriber-data', JSON.stringify(subscriberData));
        
        renderFunction();
        renderTrackingChannelSelection();
        updateSubscriberChart();
        renderSubscriberDataList();
        updateChannelCounts();
        updateEmptyState();
        
        showTemporaryMessage(`"${channel.name}" 채널이 삭제되었습니다.`);
    }
}

// 수정된 채널 정보 새로고침
async function editChannel(channelId, type = 'general') {
    let targetChannels;
    
    switch(type) {
        case 'monitoring':
            targetChannels = monitoringChannels;
            break;
        case 'tracking':
            targetChannels = trackingChannels;
            break;
        default:
            targetChannels = channels;
    }
    
    const channel = targetChannels.find(ch => ch.id === channelId);
    if (!channel) return;
    
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }
    
    showLoading(true);
    
    try {
        const channelInfo = await fetchChannelInfo(channelId);
        const latestVideo = await fetchLatestVideo(channelId);
        
        const channelIndex = targetChannels.findIndex(ch => ch.id === channelId);
        targetChannels[channelIndex] = {
            ...targetChannels[channelIndex],
            name: channelInfo.snippet.title,
            subscriberCount: parseInt(channelInfo.statistics.subscriberCount) || 0,
            thumbnail: getBestThumbnail(channelInfo.snippet.thumbnails),
            latestVideo: latestVideo,
            updatedAt: new Date().toISOString()
        };
        
        let storageKey, renderFunction;
        switch(type) {
            case 'monitoring':
                storageKey = 'youtube-monitoring-channels';
                renderFunction = renderMonitoringChannelGrid;
                break;
            case 'tracking':
                storageKey = 'youtube-tracking-channels-storage';
                renderFunction = renderTrackingChannelGrid;
                break;
            default:
                storageKey = 'youtube-channels';
                renderFunction = renderChannelGrid;
        }
        
        localStorage.setItem(storageKey, JSON.stringify(targetChannels));
        renderFunction();
        renderTrackingChannelSelection();
        
        showTemporaryMessage(`"${channelInfo.snippet.title}" 채널 정보가 업데이트되었습니다.`);
        
    } catch (error) {
        console.error('채널 정보 새로고침 오류:', error);
        alert(`채널 정보를 새로고침할 수 없습니다: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// 임시 메시지 표시
function showTemporaryMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-weight: 500;
    `;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// 수정된 채널 모달 함수
function openChannelModal(type = 'general') {
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }
    
    const maxChannels = 20;
    let currentChannels;
    
    switch(type) {
        case 'monitoring':
            currentChannels = monitoringChannels;
            break;
        case 'tracking':
            currentChannels = trackingChannels;
            break;
        default:
            currentChannels = channels;
    }
    
    if (currentChannels.length >= maxChannels) {
        alert(`최대 ${maxChannels}개의 채널만 추가할 수 있습니다.`);
        return;
    }
    
    // 모달에 타입 정보 저장
    document.getElementById('channel-modal').dataset.channelType = type;
    document.getElementById('channel-modal').style.display = 'block';
    document.getElementById('channel-input').value = '';
}

function closeChannelModal() {
    document.getElementById('channel-modal').style.display = 'none';
}

// 채널 입력 처리 함수
async function handleChannelInput() {
    const input = document.getElementById('channel-input').value.trim();
    if (!input) {
        alert('채널명, URL, 또는 ID를 입력해주세요.');
        return;
    }
    
    showLoading(true);
    
    try {
        if (isChannelId(input) || isChannelUrl(input)) {
            await addChannelDirectly(input);
            return;
        }
        
        await searchAndShowChannelSelection(input);
        
    } catch (error) {
        console.error('채널 입력 처리 오류:', error);
        let errorMessage = '채널 정보를 가져올 수 없습니다.';
        
        if (error.message.includes('quotaExceeded') || error.message.includes('quota')) {
            errorMessage = 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('찾을 수 없습니다')) {
            errorMessage = '입력한 채널을 찾을 수 없습니다. 채널명, URL 또는 ID를 다시 확인해주세요.';
        } else if (error.message.includes('keyInvalid')) {
            errorMessage = 'API 키가 올바르지 않습니다. 설정을 확인해주세요.';
        }
        
        alert(errorMessage);
    } finally {
        showLoading(false);
    }
}

// 채널명으로 검색하고 선택 모달 표시
async function searchAndShowChannelSelection(channelName) {
    console.log(`채널 검색 시작: "${channelName}"`);
    
    const searchResults = await searchChannelsByName(channelName);
    
    if (searchResults.length === 0) {
        throw new Error(`"${channelName}" 채널을 찾을 수 없습니다.`);
    }
    
    const exactMatches = searchResults.filter(channel => 
        channel.snippet.title.toLowerCase().trim() === channelName.toLowerCase().trim()
    );
    
    if (exactMatches.length === 1) {
        await addChannelById(exactMatches[0].id.channelId);
        return;
    }
    
    channelSearchResults = searchResults;
    await showChannelSelectionModal(searchResults);
}

// 채널 선택 모달 표시
async function showChannelSelectionModal(searchResults) {
    const modal = document.getElementById('channel-selection-modal');
    const listContainer = document.getElementById('channel-selection-list');
    
    listContainer.innerHTML = `
        <div class="channel-selection-loading">
            <div class="loading-spinner"></div>
            <p>채널 정보를 불러오는 중...</p>
        </div>
    `;
    
    modal.style.display = 'block';
    closeChannelModal();
    
    try {
        const channelDetails = await Promise.all(
            searchResults.map(async (channel) => {
                try {
                    const channelInfo = await fetchChannelInfo(channel.id.channelId);
                    return {
                        ...channel,
                        details: channelInfo
                    };
                } catch (error) {
                    console.error(`채널 ${channel.id.channelId} 정보 가져오기 실패:`, error);
                    return channel;
                }
            })
        );
        
        listContainer.innerHTML = channelDetails.map((channel, index) => {
            const details = channel.details;
            const subscriberCount = details ? parseInt(details.statistics?.subscriberCount || 0) : 0;
            const description = details ? details.snippet?.description || '' : channel.snippet.description || '';
            const thumbnail = details ? getBestThumbnail(details.snippet?.thumbnails) : getBestThumbnail(channel.snippet.thumbnails);
            
            return `
                <div class="channel-selection-item" onclick="selectChannel(${index})">
                    ${thumbnail ? `
                        <img src="${thumbnail}" 
                             alt="${channel.snippet.title}" 
                             class="channel-selection-thumbnail"
                             onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
                             onload="this.nextElementSibling.style.display='none';">
                        <div class="channel-selection-thumbnail-placeholder" style="display: none;">📺</div>
                    ` : `
                        <div class="channel-selection-thumbnail-placeholder">📺</div>
                    `}
                    <div class="channel-selection-info">
                        <div class="channel-selection-name">${channel.snippet.title}</div>
                        <div class="channel-selection-meta">
                            ${subscriberCount > 0 ? `
                                <div class="channel-selection-subscribers">구독자 ${formatNumber(subscriberCount)}명</div>
                            ` : ''}
                            ${description ? `
                                <div class="channel-selection-description">${description.substring(0, 100)}${description.length > 100 ? '...' : ''}</div>
                            ` : ''}
                            <div class="channel-selection-id">${channel.id.channelId}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('채널 상세 정보 로딩 오류:', error);
        listContainer.innerHTML = searchResults.map((channel, index) => `
            <div class="channel-selection-item" onclick="selectChannel(${index})">
                <div class="channel-selection-thumbnail-placeholder">📺</div>
                <div class="channel-selection-info">
                    <div class="channel-selection-name">${channel.snippet.title}</div>
                    <div class="channel-selection-meta">
                        <div class="channel-selection-description">${channel.snippet.description || '설명 없음'}</div>
                        <div class="channel-selection-id">${channel.id.channelId}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// 채널 선택 처리
async function selectChannel(index) {
    const selectedChannel = channelSearchResults[index];
    if (!selectedChannel) return;
    
    document.querySelectorAll('.channel-selection-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    
    setTimeout(async () => {
        closeChannelSelectionModal();
        showLoading(true);
        
        try {
            await addChannelById(selectedChannel.id.channelId);
            showTemporaryMessage(`채널 "${selectedChannel.snippet.title}"이 추가되었습니다!`);
        } catch (error) {
            console.error('채널 추가 오류:', error);
            alert('채널 추가 중 오류가 발생했습니다: ' + error.message);
        } finally {
            showLoading(false);
        }
    }, 300);
}

// 수정된 채널 ID로 직접 추가
async function addChannelById(channelId) {
    const channelType = document.getElementById('channel-modal').dataset.channelType || 'general';
    let targetChannels, storageKey, renderFunction;
    
    switch(channelType) {
        case 'monitoring':
            targetChannels = monitoringChannels;
            storageKey = 'youtube-monitoring-channels';
            renderFunction = renderMonitoringChannelGrid;
            break;
        case 'tracking':
            targetChannels = trackingChannels;
            storageKey = 'youtube-tracking-channels-storage';
            renderFunction = renderTrackingChannelGrid;
            break;
        default:
            targetChannels = channels;
            storageKey = 'youtube-channels';
            renderFunction = renderChannelGrid;
    }
    
    if (targetChannels.find(ch => ch.id === channelId)) {
        alert('이미 추가된 채널입니다.');
        return;
    }
    
    const channelInfo = await fetchChannelInfo(channelId);
    const latestVideo = await fetchLatestVideo(channelId);
    
    const channel = {
        id: channelId,
        name: channelInfo.snippet.title,
        subscriberCount: parseInt(channelInfo.statistics.subscriberCount) || 0,
        thumbnail: getBestThumbnail(channelInfo.snippet.thumbnails),
        latestVideo: latestVideo,
        addedAt: new Date().toISOString()
    };
    
	targetChannels.push(channel);

	if (channelType === 'tracking') {
		selectedTrackingChannels.add(channel.id);
		localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
	}


    localStorage.setItem(storageKey, JSON.stringify(targetChannels));
    
    renderFunction();
    renderTrackingChannelSelection();
    updateChannelCounts();
    updateEmptyState();
}

// 채널 ID나 URL로 직접 추가
async function addChannelDirectly(input) {
    const channelId = await resolveChannelInput(input);
    
    if (!channelId) {
        throw new Error('채널을 찾을 수 없습니다.');
    }
    
    const channelType = document.getElementById('channel-modal').dataset.channelType || 'general';
    let targetChannels;
    
    switch(channelType) {
        case 'monitoring':
            targetChannels = monitoringChannels;
            break;
        case 'tracking':
            targetChannels = trackingChannels;
            break;
        default:
            targetChannels = channels;
    }
    
    if (targetChannels.find(ch => ch.id === channelId)) {
        alert('이미 추가된 채널입니다.');
        closeChannelModal();
        return;
    }
    
    const channelInfo = await fetchChannelInfo(channelId);
    const latestVideo = await fetchLatestVideo(channelId);
    
    const channel = {
        id: channelId,
        name: channelInfo.snippet.title,
        subscriberCount: parseInt(channelInfo.statistics.subscriberCount) || 0,
        thumbnail: getBestThumbnail(channelInfo.snippet.thumbnails),
        latestVideo: latestVideo,
        addedAt: new Date().toISOString()
    };
    
    targetChannels.push(channel);

// === [자동 선택 추가!] ===
if (channelType === 'tracking') {
    selectedTrackingChannels.add(channel.id);
    localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
}

let storageKey, renderFunction;
switch(channelType) {
    case 'monitoring':
        storageKey = 'youtube-monitoring-channels';
        renderFunction = renderMonitoringChannelGrid;
        break;
    case 'tracking':
        storageKey = 'youtube-tracking-channels-storage';
        renderFunction = renderTrackingChannelGrid;
        break;
    default:
        storageKey = 'youtube-channels';
        renderFunction = renderChannelGrid;
}

    
    localStorage.setItem(storageKey, JSON.stringify(targetChannels));
    renderFunction();
    renderTrackingChannelSelection();
    updateChannelCounts();
    updateEmptyState();
    closeChannelModal();
    
    showTemporaryMessage(`채널 "${channel.name}"이 추가되었습니다!`);
}

// 채널 선택 모달 닫기
function closeChannelSelectionModal() {
    document.getElementById('channel-selection-modal').style.display = 'none';
    channelSearchResults = [];
}

function removeChannel(channelId) {
    // 모든 채널 목록에서 제거
    const allChannelLists = [
        { channels: channels, storageKey: 'youtube-channels', renderFunction: renderChannelGrid },
        { channels: monitoringChannels, storageKey: 'youtube-monitoring-channels', renderFunction: renderMonitoringChannelGrid },
        { channels: trackingChannels, storageKey: 'youtube-tracking-channels-storage', renderFunction: renderTrackingChannelGrid }
    ];
    
    let removedFromAny = false;
    let channelName = '';
    
    allChannelLists.forEach(({ channels, storageKey, renderFunction }) => {
        const channelIndex = channels.findIndex(ch => ch.id === channelId);
        if (channelIndex !== -1) {
            channelName = channels[channelIndex].name;
            channels.splice(channelIndex, 1);
            localStorage.setItem(storageKey, JSON.stringify(channels));
            renderFunction();
            removedFromAny = true;
        }
    });
    
    if (removedFromAny) {
        selectedTrackingChannels.delete(channelId);
        delete subscriberData[channelId];
        
        localStorage.setItem('youtube-selected-tracking-channels', JSON.stringify([...selectedTrackingChannels]));
        localStorage.setItem('youtube-subscriber-data', JSON.stringify(subscriberData));
        
        renderTrackingChannelSelection();
        updateSubscriberChart();
        renderSubscriberDataList();
        updateChannelCounts();
        updateEmptyState();
        
        if (confirm(`"${channelName}" 채널이 삭제되었습니다.`)) {
            // 확인창 표시
        }
    }
}

// 최신 영상 표시 함수
// ... (당신의 기존 코드들 – 생략, 그대로 유지) ...

function renderLatestVideos() {
    const container = document.getElementById('latest-videos-container');
    
    if (monitoringChannels.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>모니터링 채널이 없습니다.</p>
                <button class="btn btn-primary" onclick="openChannelModal('monitoring')">
                    채널 추가하기
                </button>
            </div>
        `;
        return;
    }

    // 시청수 내림차순 정렬
    const sortedChannels = [...monitoringChannels].sort((a, b) => {
        const viewCountA = a.latestVideo ? parseInt(a.latestVideo.viewCount) || 0 : 0;
        const viewCountB = b.latestVideo ? parseInt(b.latestVideo.viewCount) || 0 : 0;
        return viewCountB - viewCountA;
    });

    container.innerHTML = sortedChannels.map(channel => {
        if (!channel.latestVideo) {
            return `
                <div class="video-card">
                    <div class="video-thumbnail-placeholder-large">📺</div>
                    <div class="video-details">
                        <h3 class="video-title-inline">${channel.name}</h3>
                        <p class="video-channel">최신 영상 없음</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="video-card" onclick="openVideo('${channel.latestVideo.id}')">
                ${channel.latestVideo.thumbnail ? `
                    <img src="${channel.latestVideo.thumbnail}" alt="${channel.latestVideo.title}" class="video-thumbnail">
                ` : `
                    <div class="video-thumbnail-placeholder-large">🎥</div>
                `}
                <div class="video-details">
                    <h3 class="video-title-inline">${channel.latestVideo.title}</h3>
                    <p class="video-channel">${channel.name}</p>
                    <div class="video-stats">
                        <span>👁️ ${formatNumber(channel.latestVideo.viewCount)}</span>
                        <span>📅 ${formatDate(channel.latestVideo.publishedAt)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
} // ← 이 중괄호가 반드시 필요합니다!

// 여기에 다른 함수나 초기화 코드가 있을 수 있습니다.



// 채널 추적 함수 (모니터링 채널들 대상)
async function startChannelTracking() {
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }

    // 모니터링 채널이 있으면 모니터링 채널 사용, 없으면 기존 채널 사용
    const channelsToTrack = monitoringChannels.length > 0 ? monitoringChannels : channels;

    if (channelsToTrack.length === 0) {
        alert('추적할 채널이 없습니다. 먼저 모니터링 탭에서 채널을 추가해주세요.');
        return;
    }

    if (confirm(`현재 등록된 ${channelsToTrack.length}개 채널의 추적을 시작하시겠습니까?`)) {
        showLoading(true);
        
        try {
            const trackingRecord = {
                timestamp: new Date().toISOString(),
                channels: []
            };

            console.log('추적 시작 - 등록된 채널들:', channelsToTrack);

	for (const channel of channelsToTrack) {
    try {
        console.log(`${channel.name} (ID: ${channel.id}) 추적 시작...`);
        
        if (!channel.id || !isValidChannelId(channel.id)) {
            console.error(`잘못된 채널 ID: ${channel.id}`);
            trackingRecord.channels.push({
                id: channel.id,
                name: channel.name,
                subscriberCount: 0,
                hotVideo: null,
                error: "잘못된 채널 ID"
            });
            continue; // 이 줄 추가
        }
        
        // 정상적인 채널 처리 (이 부분 추가)
        const channelInfo = await fetchChannelInfo(channel.id);
        const currentSubscribers = parseInt(channelInfo.statistics.subscriberCount) || 0;
        const hotVideo = await findHotVideo(channel.id, currentSubscribers);
        
        trackingRecord.channels.push({
            id: channel.id,
            name: channel.name,
            subscriberCount: currentSubscribers,
            hotVideo: hotVideo
        });
        
        console.log(`${channel.name} 추적 완료`);
        
    } catch (error) {
        console.error('채널 처리 중 오류:', error);
        trackingRecord.channels.push({
            id: channel.id,
            name: channel.name,
            subscriberCount: 0,
            hotVideo: null,
            error: error.message
        });
    }
}


            channelTrackingData.unshift(trackingRecord);
            localStorage.setItem('youtube-channel-tracking-data', JSON.stringify(channelTrackingData));
            
            renderChannelTrackingRecords();
            
            const successCount = trackingRecord.channels.filter(ch => !ch.error).length;
            const errorCount = trackingRecord.channels.filter(ch => ch.error).length;
            
            if (errorCount > 0) {
                alert(`추적 완료: ${successCount}개 성공, ${errorCount}개 실패\n실패한 채널은 다시 추가해주세요.`);
            } else {
                alert(`${channelsToTrack.length}개 채널의 추적이 완료되었습니다.`);
            }
            
        } catch (error) {
            console.error('채널 추적 오류:', error);
            alert('채널 추적 중 오류가 발생했습니다: ' + error.message);
        } finally {
            showLoading(false);
        }
    }
}

// 핫 영상 찾기
async function findHotVideo(channelId, subscriberCount) {
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&channelId=${channelId}&type=video&order=date&maxResults=20&key=${getCurrentApiKey()}`;
        
        const searchData = await makeApiRequest(searchUrl);
        
        if (searchData.items.length === 0) {
            return null;
        }

        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
            `part=statistics,snippet,contentDetails&id=${videoIds}&key=${getCurrentApiKey()}`;
        
        const videosData = await makeApiRequest(videosUrl);

        for (const video of videosData.items) {
            const viewCount = parseInt(video.statistics?.viewCount || 0);
            const ratio = subscriberCount > 0 ? viewCount / subscriberCount : 0;
            const requiredRatio = parseFloat(document.getElementById('hot-video-ratio').value) || 2.0;
						
			if (!isShorts(video.contentDetails.duration) && ratio >= requiredRatio) {
                return {
                    id: video.id,
                    title: video.snippet.title,
                    viewCount: viewCount,
                    publishedAt: video.snippet.publishedAt,
                    ratio: ratio,
                    thumbnail: getBestThumbnail(video.snippet.thumbnails)
                };
            }
        }

        return null;
        
    } catch (error) {
        console.error(`채널 ${channelId} 핫 영상 검색 오류:`, error);
        return null;
    }
}

// 추적 결과 정렬
function sortTrackingResults() {
    renderChannelTrackingRecords();
}

// 채널 목록을 정렬하는 함수
function sortChannels(channels, sortOrder) {
    return channels.sort((a, b) => {
        switch (sortOrder) {
            case 'ratio':
                const ratioA = a.hotVideo ? a.hotVideo.ratio : 0;
                const ratioB = b.hotVideo ? b.hotVideo.ratio : 0;
                if (ratioA === 0 && ratioB === 0) return 0;
                if (ratioA === 0) return 1;
                if (ratioB === 0) return -1;
                return ratioB - ratioA;
            case 'publishedAt':
                const dateA = a.hotVideo ? new Date(a.hotVideo.publishedAt) : new Date(0);
                const dateB = b.hotVideo ? new Date(b.hotVideo.publishedAt) : new Date(0);
                return dateB - dateA;
            case 'subscriberCount':
                return b.subscriberCount - a.subscriberCount;
            case 'viewCount':
                const viewA = a.hotVideo ? a.hotVideo.viewCount : 0;
                const viewB = b.hotVideo ? b.hotVideo.viewCount : 0;
                return viewB - viewA;
            default:
                const defaultRatioA = a.hotVideo ? a.hotVideo.ratio : 0;
                const defaultRatioB = b.hotVideo ? b.hotVideo.ratio : 0;
                if (defaultRatioA === 0 && defaultRatioB === 0) return 0;
                if (defaultRatioA === 0) return 1;
                if (defaultRatioB === 0) return -1;
                return defaultRatioB - defaultRatioA;
        }
    });
}

// 추적 결과 렌더링 함수 (전체 채널 보기 기능 포함)
function renderChannelTrackingRecords() {
    const recordsContainer = document.getElementById('tracking-records');
    
    if (channelTrackingData.length === 0) {
        recordsContainer.innerHTML = `
            <div class="empty-state">
                <p>아직 추적 기록이 없습니다.</p>
                <p>상단의 "채널 추적 시작" 버튼을 눌러 첫 번째 추적을 시작해보세요.</p>
            </div>
        `;
        return;
    }

    const sortOrder = document.getElementById('tracking-sort-order').value;
    const showAllChannels = document.getElementById('show-all-channels').checked;

    const renderedRecords = channelTrackingData.map((record, index) => {
        const date = new Date(record.timestamp);
        const formattedDate = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        let sortedChannels = sortChannels([...record.channels], sortOrder);
        
        // 기본적으로 핫 영상이 있는 채널만 표시, 체크 시 전체 표시
        if (!showAllChannels) {
            sortedChannels = sortedChannels.filter(channel => 
                channel.hotVideo && !channel.error
            );
        }
        
        if (!showAllChannels && sortedChannels.length === 0) {
            return '';
        }
        
        const hotVideoCount = record.channels.filter(ch => ch.hotVideo && !ch.error).length;
        const errorCount = record.channels.filter(ch => ch.error).length;
        const totalChannels = record.channels.length;
        
        return `
            <div class="tracking-record">
                <div class="tracking-header">
                    <div>
                        <div class="tracking-timestamp">${formattedDate}</div>
                        <div class="tracking-summary">
                            ${showAllChannels ? 
                                `총 ${totalChannels}개 채널 | 핫 영상 ${hotVideoCount}개 발견${errorCount > 0 ? ` | 오류 ${errorCount}개` : ''}` :
                                `핫 영상 ${hotVideoCount}개 발견`
                            }
                        </div>
                    </div>
                    <button class="delete-btn" onclick="deleteTrackingRecord(${index})">삭제</button>
                </div>
                
                <div class="channel-tracking-list">
                    ${sortedChannels.map(channel => `
                        <div class="channel-tracking-item ${channel.error ? 'error' : ''}" ${channel.hotVideo ? `onclick="openVideo('${channel.hotVideo.id}')"` : ''}>
                            ${channel.error ? `
                                <div class="tracking-video-thumbnail-placeholder">❌</div>
                            ` : channel.hotVideo && channel.hotVideo.thumbnail ? `
                                <img src="${channel.hotVideo.thumbnail}" 
                                     alt="${channel.hotVideo.title}" 
                                     class="tracking-video-thumbnail"
                                     onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
                                     onload="this.nextElementSibling.style.display='none';">
                                <div class="tracking-video-thumbnail-placeholder" style="display: none;">🔥</div>
                            ` : `
                                <div class="tracking-video-thumbnail-placeholder">
                                    ${channel.hotVideo ? '🔥' : '❌'}
                                </div>
                            `}
                            <div class="tracking-video-details">
                                <div class="tracking-channel-header">
                                    <h3 class="tracking-channel-name">${channel.name}</h3>
                                    <button class="btn-icon-small" onclick="event.stopPropagation(); removeChannel('${channel.id}')">🗑️</button>
                                </div>
                                ${channel.error ? `
                                    <p class="tracking-channel-error">
                                        오류: ${channel.error}
                                    </p>
                                ` : `
                                    <p class="tracking-channel-subscribers">구독자 ${formatNumber(channel.subscriberCount)}명</p>
                                `}
                                ${channel.hotVideo ? `
                                    <h4 class="tracking-video-title">${channel.hotVideo.title}</h4>
                                    <div class="tracking-video-stats">
                                        <span>👁️ ${formatNumber(channel.hotVideo.viewCount)} | 📅 ${formatDate(channel.hotVideo.publishedAt)}</span>
                                        <span class="tracking-hot-ratio">${channel.hotVideo.ratio.toFixed(1)}배</span>
                                    </div>
                                ` : channel.error ? `
                                    <p class="tracking-no-video">채널 정보를 가져올 수 없습니다</p>
                                ` : `
                                    <p class="tracking-no-video">조건에 맞는 영상이 없습니다</p>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).filter(html => html !== '');

    recordsContainer.innerHTML = renderedRecords.join('');
    
    if (!showAllChannels && recordsContainer.innerHTML.trim() === '') {
        recordsContainer.innerHTML = `
            <div class="empty-state">
                <p>핫 영상이 있는 채널이 없습니다.</p>
                <p>"전체 채널 보기" 옵션을 체크하면 모든 채널을 볼 수 있습니다.</p>
            </div>
        `;
    }
}

function deleteTrackingRecord(index) {
    if (confirm('이 추적 기록을 삭제하시겠습니까?')) {
        channelTrackingData.splice(index, 1);
        localStorage.setItem('youtube-channel-tracking-data', JSON.stringify(channelTrackingData));
        renderChannelTrackingRecords();
    }
}

// 백업 및 복원 기능
function backupTrackingData() {
    if (channelTrackingData.length === 0) {
        alert('백업할 추적 데이터가 없습니다.');
        return;
    }

    const backupData = {
        exportDate: new Date().toISOString(),
        version: "1.0",
        channelTrackingData: channelTrackingData
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube_channel_tracking_backup_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('추적 데이터가 백업되었습니다.');
}

function restoreTrackingData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            
            if (!backupData.channelTrackingData || !Array.isArray(backupData.channelTrackingData)) {
                throw new Error('올바르지 않은 백업 파일 형식입니다.');
            }

            if (channelTrackingData.length > 0) {
                if (!confirm('기존 추적 데이터를 덮어쓰시겠습니까? 기존 데이터는 삭제됩니다.')) {
                    return;
                }
            }

            channelTrackingData = backupData.channelTrackingData;
            localStorage.setItem('youtube-channel-tracking-data', JSON.stringify(channelTrackingData));
            renderChannelTrackingRecords();
            
            alert(`${channelTrackingData.length}개의 추적 기록이 복원되었습니다.`);
            
        } catch (error) {
            console.error('데이터 복원 오류:', error);
            alert('백업 파일을 읽을 수 없습니다. 파일이 손상되었거나 올바른 형식이 아닙니다.');
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

// 영상 검색 기능 (개선된 날짜 범위 지원)
async function searchVideos() {
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }
    
    const keyword = document.getElementById('search-keyword').value.trim();
    if (!keyword) {
        alert('검색 키워드를 입력해주세요.');
        return;
    }
    
    showLoading(true);
    
    try {
        const searchParams = getSearchParams();
        searchResults = await performSearch(keyword, searchParams);
        renderSearchResults();
        
    } catch (error) {
        console.error('검색 오류:', error);
        alert('검색 중 오류가 발생했습니다.');
    } finally {
        showLoading(false);
    }
}

function getSearchParams() {
    const dateRangeType = document.getElementById('date-range-type').value;
    let dateRange, startDate, endDate;
    
    if (dateRangeType === 'custom') {
        startDate = document.getElementById('start-date').value;
        endDate = document.getElementById('end-date').value;
    } else {
        dateRange = document.getElementById('date-range').value;
    }
    
    return {
        subMin: parseInt(document.getElementById('sub-filter').value) || 0,
        viewMin: parseInt(document.getElementById('view-filter').value) || 0,
        dateRangeType: dateRangeType,
        dateRange: dateRange,
        startDate: startDate,
        endDate: endDate,
        sortOrder: document.getElementById('sort-order').value
    };
}

async function performSearch(keyword, params) {
    let publishedAfter, publishedBefore;
    
    if (params.dateRangeType === 'custom') {
        if (params.startDate) {
            publishedAfter = new Date(params.startDate).toISOString();
        }
        if (params.endDate) {
            const endDateObj = new Date(params.endDate);
            endDateObj.setHours(23, 59, 59, 999);
            publishedBefore = endDateObj.toISOString();
        }
    } else {
        publishedAfter = getDateFilter(params.dateRange);
    }
    
    let searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&type=video&q=${encodeURIComponent(keyword)}&` +
        `maxResults=50&key=${getCurrentApiKey()}`;
    
    if (publishedAfter) {
        searchUrl += `&publishedAfter=${publishedAfter}`;
    }
    if (publishedBefore) {
        searchUrl += `&publishedBefore=${publishedBefore}`;
    }
    
    const searchData = await makeApiRequest(searchUrl);
    
    if (searchData.items.length === 0) {
        return [];
    }
    
    const videoIds = searchData.items.map(item => item.id.videoId).join(',');
    const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
        `part=statistics,snippet,contentDetails&id=${videoIds}&key=${getCurrentApiKey()}`;
    
    const videosData = await makeApiRequest(videosUrl);
    
    const filteredVideos = [];
    for (const video of videosData.items) {
        const duration = video.contentDetails?.duration;
        if (!isShorts(duration)) {
            filteredVideos.push(video);
        }
    }
    
    if (filteredVideos.length === 0) {
        return [];
    }
    
    const channelIds = [...new Set(filteredVideos.map(item => item.snippet.channelId))];
    const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?` +
        `part=statistics&id=${channelIds.join(',')}&key=${getCurrentApiKey()}`;
    
    const channelsData = await makeApiRequest(channelsUrl);
    
    const channelMap = {};
    channelsData.items.forEach(channel => {
        channelMap[channel.id] = channel.statistics;
    });
    
    let results = filteredVideos.map(video => {
        const channelStats = channelMap[video.snippet.channelId];
        const subscriberCount = parseInt(channelStats?.subscriberCount || 0);
        const viewCount = parseInt(video.statistics?.viewCount || 0);
        
        return {
            id: video.id,
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            publishedAt: video.snippet.publishedAt,
            viewCount: viewCount,
            subscriberCount: subscriberCount,
            thumbnail: getBestThumbnail(video.snippet.thumbnails),
            ratio: subscriberCount > 0 ? viewCount / subscriberCount : 0
        };
    });
    
    results = results.filter(video => {
        return video.subscriberCount >= params.subMin && 
               video.viewCount >= params.viewMin;
    });
    
    results.sort((a, b) => {
        switch (params.sortOrder) {
            case 'ratio':
                return b.ratio - a.ratio;
            case 'viewCount':
                return b.viewCount - a.viewCount;
            case 'subscriberCount':
                return b.subscriberCount - a.subscriberCount;
            case 'publishedAt':
                return new Date(b.publishedAt) - new Date(a.publishedAt);
            default:
                return b.ratio - a.ratio;
        }
    });
    
    return results;
}

function renderSearchResults() {
    const searchResultsContainer = document.getElementById('search-results');
    
    if (searchResults.length === 0) {
        searchResultsContainer.innerHTML = `
            <div class="empty-state">
                <p>검색 결과가 없습니다.</p>
            </div>
        `;
        return;
    }
    
    searchResultsContainer.innerHTML = searchResults.map(video => `
        <div class="video-card" onclick="openVideo('${video.id}')">
            ${video.thumbnail ? `
                <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail"
                     onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';"
                     onload="this.nextElementSibling.style.display='none';">
                <div class="video-thumbnail-placeholder-large" style="display: none;">🎥</div>
            ` : `
                <div class="video-thumbnail-placeholder-large">🎥</div>
            `}
            <div class="video-details">
                <h3 class="video-title-inline">${video.title}</h3>
                <p class="video-channel">${video.channelTitle}</p>
                <div class="video-stats">
                    <span>👁️ ${formatNumber(video.viewCount)}</span>
                    <span>👥 ${formatNumber(video.subscriberCount)}</span>
                    <span>📅 ${formatDate(video.publishedAt)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// API 호출 함수들
async function makeApiRequest(url, retryCount = 0) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error && data.error.code === 403 && 
            (data.error.message.includes('quotaExceeded') || 
             data.error.message.includes('quota'))) {
            
            console.log(`API 키 #${currentApiIndex + 1} 할당량 초과`);
            
            if (retryCount < apiKeys.length - 1) {
                rotateToNextApiKey();
                const newUrl = url.replace(/key=[^&]+/, `key=${getCurrentApiKey()}`);
                return await makeApiRequest(newUrl, retryCount + 1);
            } else {
                throw new Error('모든 API 키의 할당량이 초과되었습니다. 내일 다시 시도해주세요.');
            }
        }
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        return data;
        
    } catch (error) {
        if (error.message.includes('할당량')) {
            throw error;
        }
        
        if (retryCount < apiKeys.length - 1) {
            console.log(`API 키 #${currentApiIndex + 1}에서 오류 발생, 다음 키로 시도`);
            rotateToNextApiKey();
            const newUrl = url.replace(/key=[^&]+/, `key=${getCurrentApiKey()}`);
            return await makeApiRequest(newUrl, retryCount + 1);
        }
        
        throw error;
    }
}

async function fetchChannelInfo(channelId) {
    try {
        console.log(`채널 정보 요청: ${channelId}`);
        
        if (!isValidChannelId(channelId)) {
            throw new Error(`잘못된 채널 ID 형식: ${channelId}`);
        }
        
        const url = `https://www.googleapis.com/youtube/v3/channels?` +
            `part=snippet,statistics&id=${channelId}&key=${getCurrentApiKey()}`;
        
        console.log('API URL:', url.replace(/key=[^&]+/, 'key=***'));
        
        const data = await makeApiRequest(url);
        
        console.log('API 응답:', data);
        
        if (!data.items || data.items.length === 0) {
            throw new Error(`채널 ID "${channelId}"를 찾을 수 없습니다. API에서 데이터를 반환하지 않았습니다.`);
        }
        
        const channelInfo = data.items[0];
        console.log(`채널 정보 획득 성공: ${channelInfo.snippet.title}`);
        
        return channelInfo;
        
    } catch (error) {
        console.error('채널 정보 가져오기 오류:', error);
        
        if (error.message.includes('quotaExceeded')) {
            throw new Error('API 할당량이 초과되었습니다.');
        } else if (error.message.includes('keyInvalid')) {
            throw new Error('API 키가 올바르지 않습니다.');
        } else if (error.message.includes('찾을 수 없습니다')) {
            throw error;
        }
        
        throw new Error(`채널 정보를 가져올 수 없습니다: ${error.message}`);
    }
}

async function fetchLatestVideo(channelId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&channelId=${channelId}&type=video&order=date&maxResults=10&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(url);
        
        if (!data.items || data.items.length === 0) {
            return null;
        }
        
        for (const video of data.items) {
            try {
                const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
                    `part=statistics,snippet,contentDetails&id=${video.id.videoId}&key=${getCurrentApiKey()}`;
                
                const detailsData = await makeApiRequest(detailsUrl);
                
                if (detailsData.items && detailsData.items.length > 0) {
                    const videoDetails = detailsData.items[0];
                    const duration = videoDetails.contentDetails.duration;
                    
                    if (!isShorts(duration)) {
                        return {
                            id: video.id.videoId,
                            title: video.snippet.title,
                            publishedAt: video.snippet.publishedAt,
                            viewCount: videoDetails.statistics.viewCount || 0,
                            thumbnail: getBestThumbnail(videoDetails.snippet.thumbnails) || getBestThumbnail(video.snippet.thumbnails)
                        };
                    }
                }
            } catch (error) {
                console.log(`영상 ${video.id.videoId} 처리 중 오류:`, error);
                continue;
            }
        }
        
        return null;
        
    } catch (error) {
        console.error(`채널 ${channelId} 최신 영상 검색 오류:`, error);
        return null;
    }
}

async function resolveChannelInput(input) {
    try {
        if (isChannelId(input)) {
            await fetchChannelInfo(input);
            return input;
        }
        
        if (isChannelUrl(input)) {
            return await extractChannelIdFromUrl(input);
        }
        
        console.log(`채널명으로 검색: "${input}"`);
        const searchResults = await searchChannelsByName(input);
        
        if (searchResults.length === 0) {
            throw new Error(`"${input}" 채널을 찾을 수 없습니다.`);
        }
        
        const exactMatch = searchResults.find(channel => 
            channel.snippet.title.toLowerCase().trim() === input.toLowerCase().trim()
        );
        
        if (exactMatch) {
            console.log(`정확한 매치 발견: ${exactMatch.snippet.title}`);
            return exactMatch.id.channelId;
        }
        
        const partialMatch = searchResults.find(channel => 
            channel.snippet.title.toLowerCase().includes(input.toLowerCase()) ||
            input.toLowerCase().includes(channel.snippet.title.toLowerCase())
        );
        
        if (partialMatch) {
            console.log(`부분 매치 발견: ${partialMatch.snippet.title}`);
            return partialMatch.id.channelId;
        }
        
        console.log(`첫 번째 결과 사용: ${searchResults[0].snippet.title}`);
        return searchResults[0].id.channelId;
        
    } catch (error) {
        console.error('채널 입력 해석 오류:', error);
        throw new Error(`채널을 찾을 수 없습니다: ${error.message}`);
    }
}

function isChannelId(input) {
    return /^UC[a-zA-Z0-9_-]{22}$/.test(input);
}

function isChannelUrl(input) {
    const urlPatterns = [
        /youtube\.com\/channel\/([^\/\?&]+)/,
        /youtube\.com\/c\/([^\/\?&]+)/,
        /youtube\.com\/user\/([^\/\?&]+)/,
        /youtube\.com\/@([^\/\?&]+)/,
        /youtu\.be\/channel\/([^\/\?&]+)/
    ];
    
    return urlPatterns.some(pattern => pattern.test(input));
}

async function extractChannelIdFromUrl(url) {
    const handleMatch = url.match(/youtube\.com\/@([^\/\?&]+)/);
    if (handleMatch) {
        const handle = handleMatch[1];
        return await getChannelIdByHandle(handle);
    }
    
    const channelIdMatch = url.match(/youtube\.com\/channel\/([^\/\?&]+)/);
    if (channelIdMatch) {
        return channelIdMatch[1];
    }
    
    const customMatch = url.match(/youtube\.com\/c\/([^\/\?&]+)/);
    if (customMatch) {
        const customName = customMatch[1];
        return await getChannelIdByCustomName(customName);
    }
    
    const userMatch = url.match(/youtube\.com\/user\/([^\/\?&]+)/);
    if (userMatch) {
        const username = userMatch[1];
        return await getChannelIdByUsername(username);
    }
    
    throw new Error('지원하지 않는 URL 형식입니다.');
}

async function getChannelIdByHandle(handle) {
    try {
        const cleanHandle = decodeURIComponent(handle.replace('@', ''));
        console.log(`핸들 검색: "${cleanHandle}"`);
        
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=channel&q=${encodeURIComponent(cleanHandle)}&maxResults=10&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(searchUrl);
        
        if (!data.items || data.items.length === 0) {
            throw new Error(`핸들 "${cleanHandle}"에 해당하는 채널을 찾을 수 없습니다.`);
        }
        
        for (const item of data.items) {
            const channelTitle = item.snippet.title.toLowerCase();
            const searchTerm = cleanHandle.toLowerCase();
            
            if (channelTitle === searchTerm || 
                channelTitle.includes(searchTerm) || 
                searchTerm.includes(channelTitle)) {
                console.log(`핸들 매치 발견: ${item.snippet.title}`);
                return item.id.channelId;
            }
        }
        
        console.log(`첫 번째 핸들 결과 사용: ${data.items[0].snippet.title}`);
        return data.items[0].id.channelId;
        
    } catch (error) {
        console.error('Handle 검색 오류:', error);
        throw new Error(`핸들 "${handle}"에 해당하는 채널을 찾을 수 없습니다: ${error.message}`);
    }
}

async function getChannelIdByCustomName(customName) {
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=channel&q=${encodeURIComponent(customName)}&maxResults=10&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(searchUrl);
        
        if (!data.items || data.items.length === 0) {
            throw new Error(`채널 "${customName}"을 찾을 수 없습니다.`);
        }
        
        const exactMatch = data.items.find(item => 
            item.snippet.customUrl && item.snippet.customUrl.toLowerCase().includes(customName.toLowerCase())
        );
        
        return exactMatch ? exactMatch.id.channelId : data.items[0].id.channelId;
        
    } catch (error) {
        console.error('커스텀명 검색 오류:', error);
        throw new Error(`채널 "${customName}"을 찾을 수 없습니다.`);
    }
}

async function getChannelIdByUsername(username) {
    try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=channel&q=${encodeURIComponent(username)}&maxResults=10&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(searchUrl);
        
        if (!data.items || data.items.length === 0) {
            throw new Error(`사용자 "${username}"을 찾을 수 없습니다.`);
        }
        
        return data.items[0].id.channelId;
        
    } catch (error) {
        console.error('사용자명 검색 오류:', error);
        throw new Error(`사용자 "${username}"을 찾을 수 없습니다.`);
    }
}

async function searchChannelsByName(channelName) {
    try {
        console.log(`채널 검색 시작: "${channelName}"`);
        
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&type=channel&q=${encodeURIComponent(channelName)}&maxResults=10&key=${getCurrentApiKey()}`;
        
        const data = await makeApiRequest(searchUrl);
        
        console.log(`검색 결과: ${data.items?.length || 0}개 채널 발견`);
        
        if (data.items && data.items.length > 0) {
            data.items.forEach((item, index) => {
                console.log(`${index + 1}. ${item.snippet.title} (ID: ${item.id.channelId})`);
            });
        }
        
        return data.items || [];
        
    } catch (error) {
        console.error('채널명 검색 오류:', error);
        
        if (error.message.includes('quotaExceeded')) {
            throw new Error('API 할당량이 초과되었습니다.');
        }
        
        throw new Error(`채널 검색 중 오류가 발생했습니다: ${error.message}`);
    }
}

// 유틸리티 함수들
function getBestThumbnail(thumbnails) {
    if (!thumbnails) return null;
    
    if (thumbnails.high?.url) return thumbnails.high.url;
    if (thumbnails.medium?.url) return thumbnails.medium.url;
    if (thumbnails.default?.url) return thumbnails.default.url;
    if (thumbnails.standard?.url) return thumbnails.standard.url;
    if (thumbnails.maxres?.url) return thumbnails.maxres.url;
    
    return null;
}

function isShorts(duration) {
    if (!duration) {
        return true;
    }
    
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) {
        return true;
    }
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds <= 185;
}

function getDateFilter(range) {
    const now = new Date();
    const date = new Date(now);
    
    switch (range) {
        case 'hour':
            date.setHours(date.getHours() - 1);
            break;
        case 'hour3':
            date.setHours(date.getHours() - 3);
            break;
        case 'hour12':
            date.setHours(date.getHours() - 12);
            break;
        case 'day':
            date.setDate(date.getDate() - 1);
            break;
        case 'day3':
            date.setDate(date.getDate() - 3);
            break;
        case 'week':
            date.setDate(date.getDate() - 7);
            break;
        case 'week2':
            date.setDate(date.getDate() - 14);
            break;
        case 'month':
            date.setMonth(date.getMonth() - 1);
            break;
        case 'month3':
            date.setMonth(date.getMonth() - 3);
            break;
        case 'month6':
            date.setMonth(date.getMonth() - 6);
            break;
        case 'year':
            date.setFullYear(date.getFullYear() - 1);
            break;
        default:
            date.setDate(date.getDate() - 7);
    }
    
    return date.toISOString();
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return '1일 전';
    } else if (diffDays < 7) {
        return `${diffDays}일 전`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks}주 전`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months}개월 전`;
    } else {
        const years = Math.floor(diffDays / 365);
        return `${years}년 전`;
    }
}

function formatDateForChart(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function openVideo(videoId) {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
}

function openChannel(channelId) {
    window.open(`https://www.youtube.com/channel/${channelId}`, '_blank');
}

function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    channelSearchResults = [];
}

// 구독자 증감 HTML 생성
function getSubscriberGrowthHTML(channelId, currentCount) {
    const growth = getSubscriberGrowth(channelId, currentCount);
    if (growth === null) return '';
    
    if (growth > 0) {
        return `<span class="subscriber-growth positive">+${formatNumber(growth)}</span>`;
    } else if (growth < 0) {
        return `<span class="subscriber-growth negative">${formatNumber(growth)}</span>`;
    } else {
        return `<span class="subscriber-growth neutral">±0</span>`;
    }
}

// 전날 대비 구독자 증감 계산
function getSubscriberGrowth(channelId, currentCount) {
    const dailyData = JSON.parse(localStorage.getItem('daily-subscriber-data') || '{}');
    const today = getKoreanDate();
    const yesterday = getYesterday();
    
    if (!dailyData[channelId] || !dailyData[channelId][yesterday]) {
        // 어제 데이터가 없으면 오늘 데이터 저장
        saveDailySubscriberCount(channelId, currentCount);
        return null;
    }
    
    const yesterdayCount = dailyData[channelId][yesterday];
    const growth = currentCount - yesterdayCount;
    
    // 오늘 데이터 저장
    saveDailySubscriberCount(channelId, currentCount);
    
    return growth;
}

// 일일 구독자 수 저장
function saveDailySubscriberCount(channelId, count) {
    const dailyData = JSON.parse(localStorage.getItem('daily-subscriber-data') || '{}');
    const today = getKoreanDate();
    
    if (!dailyData[channelId]) {
        dailyData[channelId] = {};
    }
    
    dailyData[channelId][today] = count;
    
    // 30일 이전 데이터 삭제 (용량 절약)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    Object.keys(dailyData[channelId]).forEach(date => {
        if (date < cutoffDate) {
            delete dailyData[channelId][date];
        }
    });
    
    localStorage.setItem('daily-subscriber-data', JSON.stringify(dailyData));
}

// 어제 날짜 구하기
function getYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const utc = yesterday.getTime() + (yesterday.getTimezoneOffset() * 60000);
    const koreaTime = new Date(utc + (9 * 3600000));
    return koreaTime.toISOString().split('T')[0];
}

// 썸네일 테스트 관련 함수들
async function startThumbnailTest() {
    if (apiKeys.length === 0) {
        alert('먼저 YouTube API 키를 설정해주세요.');
        openApiModal();
        return;
    }
    
    testKeyword = document.getElementById('test-keyword').value.trim();
    currentQuestion = 0;
    currentScore = 0;
    testVideos = [];
    
    showTestSection('test-game');
    
    try {
        showLoading(true);
        await loadTestVideos();
        
        if (testVideos.length < 50) {
            throw new Error(`충분한 롱폼 영상을 찾을 수 없습니다. (발견된 영상: ${testVideos.length}개)\n다른 키워드를 시도하거나 키워드를 비워두고 다시 시도해보세요.`);
        }
        
        await loadNextQuestion();
    } catch (error) {
        console.error('테스트 시작 오류:', error);
        alert('테스트를 시작할 수 없습니다: ' + error.message);
        showTestSection('test-intro');
    } finally {
        showLoading(false);
    }
}
async function loadTestVideos() {
    const keywords = testKeyword ? [testKeyword] : 
        ['게임', '요리', '여행', '음악', '운동', '영화', '기술', '뷰티', '패션', '동물', 
         '리뷰', '언박싱', '튜토리얼', '브이로그', 'ASMR', '먹방', 'K-POP', '드라마'];
    
    console.log('테스트 영상 수집 시작...');
    
    for (const keyword of keywords) {
        try {
            console.log(`"${keyword}" 키워드로 검색 중...`);
            const videos = await searchTestVideos(keyword);
            console.log(`"${keyword}"에서 ${videos.length}개 영상 발견`);
            
            testVideos.push(...videos);
            
            if (testVideos.length >= 300) break; // 더 많은 영상 수집
        } catch (error) {
            console.error(`키워드 "${keyword}" 검색 오류:`, error);
        }
    }
    
    console.log(`총 ${testVideos.length}개 영상 수집 완료`);
    
    // 중복 제거
    const uniqueVideos = [];
    const seenIds = new Set();
    
    for (const video of testVideos) {
        if (!seenIds.has(video.id)) {
            seenIds.add(video.id);
            uniqueVideos.push(video);
        }
    }
    
    testVideos = uniqueVideos;
    console.log(`중복 제거 후 ${testVideos.length}개 영상`);
    
    if (testVideos.length < 100) {
        throw new Error(`충분한 테스트 영상을 찾을 수 없습니다. (발견된 영상: ${testVideos.length}개)\n다른 키워드를 시도하거나 키워드를 비워두고 다시 시도해보세요.`);
    }
}

async function searchTestVideos(keyword) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // 더 많은 영상을 가져오기 위해 여러 번 검색
    let allVideos = [];
    const searchQueries = [keyword];
    
    // 키워드가 있으면 관련 검색어도 추가
    if (keyword) {
        searchQueries.push(`${keyword} 리뷰`, `${keyword} 추천`, `${keyword} 하는법`);
    }
    
    for (const query of searchQueries) {
        try {
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
                `part=snippet&type=video&q=${encodeURIComponent(query)}&` +
                `publishedAfter=${oneWeekAgo.toISOString()}&` +
                `maxResults=50&key=${getCurrentApiKey()}`;
            
            const searchData = await makeApiRequest(searchUrl);
            
            if (searchData.items.length === 0) continue;
            
            const videoIds = searchData.items.map(item => item.id.videoId).join(',');
            const videosUrl = `https://www.googleapis.com/youtube/v3/videos?` +
                `part=statistics,snippet,contentDetails&id=${videoIds}&key=${getCurrentApiKey()}`;
            
            const videosData = await makeApiRequest(videosUrl);
            
            // 롱폼 영상만 필터링 (60초 이상)
            const longFormVideos = videosData.items.filter(video => {
                const duration = video.contentDetails?.duration;
                if (!duration) return false;
                
                const totalSeconds = parseYouTubeDuration(duration);
                return totalSeconds >= 30; // 60초 이상만 롱폼으로 간주
            });
            
            allVideos.push(...longFormVideos);
            
            if (allVideos.length >= 200) break; // 충분한 영상을 모았으면 중단
            
        } catch (error) {
            console.error(`검색어 "${query}" 처리 중 오류:`, error);
        }
    }
    
    if (allVideos.length === 0) return [];
    
    // 채널 정보 가져오기
    const channelIds = [...new Set(allVideos.map(item => item.snippet.channelId))];
    const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?` +
        `part=statistics&id=${channelIds.join(',')}&key=${getCurrentApiKey()}`;
    
    const channelsData = await makeApiRequest(channelsUrl);
    
    const channelMap = {};
    channelsData.items.forEach(channel => {
        channelMap[channel.id] = parseInt(channel.statistics.subscriberCount) || 0;
    });
    
    return allVideos.map(video => {
        const subscriberCount = channelMap[video.snippet.channelId] || 0;
        const viewCount = parseInt(video.statistics.viewCount) || 0;
        const ratio = subscriberCount > 0 ? viewCount / subscriberCount : 0;
        
        return {
            id: video.id,
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            thumbnail: getBestThumbnail(video.snippet.thumbnails),
            viewCount: viewCount,
            subscriberCount: subscriberCount,
            ratio: ratio,
            isHot: ratio >= 2.0 && subscriberCount >= 1000, // 최소 구독자 수 조건 추가
            isCold: viewCount < subscriberCount * 0.5 && subscriberCount >= 1000 // 조건 완화
        };
    }).filter(video => 
        video.subscriberCount >= 1000 && // 최소 구독자 수 필터
        (video.isHot || video.isCold) // 핫하거나 콜드한 영상만
    );
}

async function loadNextQuestion() {
    if (currentQuestion >= 50) {
        showTestResult();
        return;
    }
    
    currentQuestion++;
    updateProgress();
    
    const hotVideos = testVideos.filter(v => v.isHot);
	const coldVideos = testVideos.filter(v => v.isCold);
	
	console.log(`사용 가능한 핫 영상: ${hotVideos.length}개, 콜드 영상: ${coldVideos.length}개`);
	
	if (hotVideos.length === 0 || coldVideos.length === 0) {
	    console.log('영상 부족으로 테스트 종료');
	    alert('더 이상 사용 가능한 영상이 없습니다.');
	    showTestResult();
	    return;
	}
    
    const correctVideo = hotVideos[Math.floor(Math.random() * hotVideos.length)];
    const incorrectVideo = coldVideos[Math.floor(Math.random() * coldVideos.length)];
    
    testVideos = testVideos.filter(v => v.id !== correctVideo.id && v.id !== incorrectVideo.id);
    
    currentTestVideos = { correct: correctVideo, incorrect: incorrectVideo };
    
    const positions = Math.random() < 0.5 ? ['correct', 'incorrect'] : ['incorrect', 'correct'];
    
    displayThumbnail('a', positions[0] === 'correct' ? correctVideo : incorrectVideo);
    displayThumbnail('b', positions[1] === 'correct' ? correctVideo : incorrectVideo);
    
    currentTestVideos.correctPosition = positions[0] === 'correct' ? 'a' : 'b';
    
    document.querySelectorAll('.thumbnail-option').forEach(option => {
        option.classList.remove('selected', 'correct', 'incorrect');
    });
}

function displayThumbnail(position, video) {
    document.getElementById(`thumbnail-${position}`).src = video.thumbnail || '';
    document.getElementById(`title-${position}`).textContent = video.title;
    document.getElementById(`channel-${position}`).textContent = video.channelTitle;
}

function selectThumbnail(position) {
    const isCorrect = position === currentTestVideos.correctPosition;
    
    if (isCorrect) {
        currentScore++;
    }
    
    document.getElementById(`option-${position}`).classList.add('selected');
    
    setTimeout(() => {
        document.getElementById(`option-${currentTestVideos.correctPosition}`).classList.add('correct');
        if (!isCorrect) {
            document.getElementById(`option-${position}`).classList.add('incorrect');
        }
        
        updateProgress();
        
        setTimeout(() => {
            loadNextQuestion();
        }, 1500);
    }, 500);
}

function updateProgress() {
    document.getElementById('question-counter').textContent = `${currentQuestion} / 50`;
    document.getElementById('score-counter').textContent = `정답: ${currentScore}개`;
}

function showTestResult() {
    const percentage = Math.round((currentScore / 50) * 100);
    
    document.getElementById('final-score-text').textContent = `50문제 중 ${currentScore}문제 정답`;
    document.getElementById('final-percentage').textContent = `(${percentage}%)`;
    
    saveTestResult();
    showTestSection('test-result');
}

function saveTestResult() {
    const testResult = {
        date: new Date().toISOString(),
        keyword: testKeyword || '랜덤',
        score: currentScore,
        total: 50,
        percentage: Math.round((currentScore / 50) * 100)
    };
    
    const savedResults = JSON.parse(localStorage.getItem('thumbnail-test-results') || '[]');
    savedResults.unshift(testResult);
    
    if (savedResults.length > 50) {
        savedResults.splice(50);
    }
    
    localStorage.setItem('thumbnail-test-results', JSON.stringify(savedResults));
}

function showTestRecords() {
    loadThumbnailTestRecords();
    showTestSection('test-records');
}

function loadThumbnailTestRecords() {
    const savedResults = JSON.parse(localStorage.getItem('thumbnail-test-results') || '[]');
    const recordsList = document.getElementById('records-list');
    
    if (savedResults.length === 0) {
        recordsList.innerHTML = `
            <div class="empty-state">
                <p>아직 테스트 기록이 없습니다.</p>
                <p>썸네일 테스트를 시작해보세요!</p>
            </div>
        `;
        return;
    }
    
    recordsList.innerHTML = savedResults.map(result => `
        <div class="record-item">
            <div class="record-info">
                <div class="record-date">${formatDateForDisplay(result.date.split('T')[0])}</div>
                <div class="record-keyword">키워드: ${result.keyword}</div>
            </div>
            <div class="record-score">
                <div class="record-score-number">${result.score}/${result.total}</div>
                <div class="record-percentage">${result.percentage}%</div>
            </div>
        </div>
    `).join('');
}

function restartTest() {
    showTestSection('test-intro');
}

function newTest() {
    document.getElementById('test-keyword').value = '';
    showTestSection('test-intro');
}

function closeTestRecords() {
    showTestSection('test-intro');
}

function showTestSection(sectionId) {
    document.querySelectorAll('.test-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';
}

// 썸네일 가로 비율 기준으로 롱폼 필터링
function isLongForm(video) {
    return video.thumbnail && video.thumbnail.width >= video.thumbnail.height;
}

function parseYouTubeDuration(durationStr) {
    const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);
    return hours * 3600 + minutes * 60 + seconds;
}


