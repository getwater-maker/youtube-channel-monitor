// 설정 및 상수
if (typeof moment !== 'undefined') {
  moment.tz.setDefault('Asia/Seoul');
}

// 전역 객체 중복 선언 방지
window.CONFIG = window.CONFIG || {
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
window.state = window.state || {
  currentMutantPeriod: '6m',
  currentView: 'home',
  currentPage: {
    channels: 1,
    mutant: 1,
    latest: 1
  }
};

// API 키 관리 - 중복 선언 방지
if (!window.apiKeys) {
  window.apiKeys = JSON.parse(localStorage.getItem('youtubeApiKeys') || localStorage.getItem('apiKeys') || '[]');
  if (!localStorage.getItem('youtubeApiKeys') && localStorage.getItem('apiKeys')) {
    localStorage.setItem('youtubeApiKeys', localStorage.getItem('apiKeys'));
  }
}

window.keyIdx = window.keyIdx || 0;

function setApiKeys(keys) {
  window.apiKeys = keys.filter(Boolean);
  window.keyIdx = 0;
  localStorage.setItem('youtubeApiKeys', JSON.stringify(window.apiKeys));
  localStorage.setItem('apiKeys', JSON.stringify(window.apiKeys));
}

function nextKey() { 
  if (window.apiKeys.length > 1) window.keyIdx = (window.keyIdx + 1) % window.apiKeys.length; 
}

function hasKeys() { 
  return window.apiKeys.length > 0; 
}

// 전역으로 노출
window.setApiKeys = setApiKeys;
window.nextKey = nextKey;
window.hasKeys = hasKeys;
