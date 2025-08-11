// utils.js 파일 끝에 다음 코드를 추가하여 누락된 전역 변수들을 확보해주세요

// 전역 변수 안전 확보
if (!window.apiKeys) {
  window.apiKeys = JSON.parse(localStorage.getItem('youtubeApiKeys') || '[]');
}

if (!window.keyIdx) {
  window.keyIdx = 0;
}

// moment.js 안전성 확보
if (typeof moment !== 'undefined') {
  moment.tz.setDefault('Asia/Seoul');
  moment.locale('ko');
}

// Chart.js 전역 설정 (Chart.js가 로드된 경우)
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  Chart.defaults.plugins.legend.display = true;
  Chart.defaults.animation.duration = 800;
  Chart.defaults.elements.arc.borderWidth = 0;
  Chart.defaults.elements.bar.borderRadius = 4;
  Chart.defaults.elements.line.borderWidth = 3;
  Chart.defaults.elements.point.radius = 6;
  Chart.defaults.elements.point.hoverRadius = 8;
}

// 에러 핸들링 함수
function handleAnalysisError(error, context = '') {
  console.error(`분석 오류 ${context}:`, error);
  
  if (error.message && error.message.includes('quota')) {
    toast('API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.');
  } else if (error.message && error.message.includes('API')) {
    toast('API 키 오류입니다. API 키를 확인해주세요.');
  } else {
    toast(`분석 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`);
  }
}

// 안전한 DOM 요소 접근
function safeQs(id) {
  try {
    return document.getElementById(id);
  } catch (e) {
    console.warn(`Element with id '${id}' not found:`, e);
    return null;
  }
}

// 숫자 안전 파싱
function safeParseInt(value, defaultValue = 0) {
  const parsed = parseInt(value || defaultValue, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// 안전한 배열 접근
function safeArrayAccess(array, index, defaultValue = null) {
  if (!Array.isArray(array) || index < 0 || index >= array.length) {
    return defaultValue;
  }
  return array[index];
}

// 로컬 스토리지 안전 접근
function safeLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.warn(`로컬스토리지 접근 오류 (${key}):`, e);
    return defaultValue;
  }
}

// 전역으로 노출
window.handleAnalysisError = handleAnalysisError;
window.safeQs = safeQs;
window.safeParseInt = safeParseInt;
window.safeArrayAccess = safeArrayAccess;
window.safeLocalStorage = safeLocalStorage;
