// 설정 및 상수
moment.tz.setDefault('Asia/Seoul');

const CONFIG = {
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
let state = {
  currentMutantPeriod: '6m',
  currentView: 'home',
  currentPage: {
    channels: 1,
    mutant: 1,
    latest: 1
  }
};

// API 키 관리
let apiKeys = JSON.parse(localStorage.getItem('youtubeApiKeys') || localStorage.getItem('apiKeys') || '[]');
if (!localStorage.getItem('youtubeApiKeys') && localStorage.getItem('apiKeys')) {
  localStorage.setItem('youtubeApiKeys', localStorage.getItem('apiKeys'));
}
let keyIdx = 0;

function setApiKeys(keys) {
  apiKeys = keys.filter(Boolean);
  keyIdx = 0;
  localStorage.setItem('youtubeApiKeys', JSON.stringify(apiKeys));
  localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
}

function nextKey() { 
  if (apiKeys.length > 1) keyIdx = (keyIdx + 1) % apiKeys.length; 
}

function hasKeys() { 
  return apiKeys.length > 0; 
}
