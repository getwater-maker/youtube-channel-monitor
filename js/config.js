// YouTube 채널 모니터 - 설정 및 상수
console.log('config.js 로딩 시작');

// moment.js 설정
if (typeof moment !== 'undefined') {
  moment.tz.setDefault('Asia/Seoul');
  moment.locale('ko');
  console.log('Moment.js 설정 완료');
}

// 전역 설정
window.CONFIG = {
  API_BASE: 'https://www.googleapis.com/youtube/v3/',
  PAGINATION: {
    CHANNELS: 8,
    VIDEOS: 5,
    SEARCH_CHANNELS: 4,
    SEARCH_VIDEOS: 4
  },
  TIMEOUT: 30000,
  MUTANT_THRESHOLD: 2.0
};

// 전역 상태
window.state = {
  currentMutantPeriod: '6m',
  currentView: 'home',
  currentPage: {
    channels: 1,
    mutant: 1,
    latest: 1
  }
};

// API 키 관리
window.apiKeys = JSON.parse(localStorage.getItem('youtubeApiKeys') || '[]');
window.keyIdx = 0;

// API 키 관리 함수
function setApiKeys(keys) {
  window.apiKeys = keys.filter(Boolean);
  window.keyIdx = 0;
  localStorage.setItem('youtubeApiKeys', JSON.stringify(window.apiKeys));
  console.log('API 키 저장됨:', window.apiKeys.length + '개');
}

function nextKey() { 
  if (window.apiKeys.length > 1) {
    window.keyIdx = (window.keyIdx + 1) % window.apiKeys.length;
    console.log('다음 API 키로 전환:', window.keyIdx);
  }
}

function hasKeys() { 
  return window.apiKeys.length > 0; 
}

// 전역으로 노출
window.setApiKeys = setApiKeys;
window.nextKey = nextKey;
window.hasKeys = hasKeys;

console.log('config.js 로딩 완료');
console.log('설정된 API 키 수:', window.apiKeys.length);