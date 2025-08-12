// YouTube 채널 모니터 - 유틸리티 함수들
console.log('utils.js 로딩 시작');

// DOM 선택 함수
window.qs = function(selector, scope = document) {
  try {
    if (selector.startsWith('#')) {
      return scope.getElementById ? scope.getElementById(selector.slice(1)) : scope.querySelector(selector);
    }
    return scope.querySelector(selector);
  } catch (e) {
    console.warn(`Element '${selector}' not found:`, e);
    return null;
  }
};

window.qsa = function(selector, scope = document) {
  try {
    return Array.from(scope.querySelectorAll(selector));
  } catch (e) {
    console.warn(`Elements '${selector}' not found:`, e);
    return [];
  }
};

// 숫자 포맷팅
window.fmt = function(n) {
  if (!n && n !== 0) return '0';
  const num = parseInt(n.toString().replace(/,/g, ''), 10);
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
};

// 토스트 알림 - 왼쪽에서 나타나는 버전
window.toast = function(msg, type = 'info', duration = 3000) {
  console.log(`[TOAST ${type.toUpperCase()}]`, msg);
  
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  
  const typeConfig = {
    success: { icon: '✅', color: '#1db954' },
    error: { icon: '❌', color: '#c4302b' },
    warning: { icon: '⚠️', color: '#ffa502' },
    info: { icon: 'ℹ️', color: '#667eea' }
  };
  
  const config = typeConfig[type] || typeConfig.info;
  
  const toastEl = document.createElement('div');
  toastEl.className = 'toast-message';
  toastEl.style.borderLeftColor = config.color;
  
  toastEl.innerHTML = `
    <span style="font-size: 14px; flex-shrink: 0;">${config.icon}</span>
    <span style="line-height: 1.4; white-space: pre-line;">${msg}</span>
  `;
  
  container.appendChild(toastEl);
  
  // 애니메이션 시작 (왼쪽에서 나타남)
  setTimeout(() => {
    toastEl.style.transform = 'translateX(0)';
  }, 10);
  
  const remove = () => {
    toastEl.style.transform = 'translateX(-100%)';
    toastEl.style.opacity = '0';
    setTimeout(() => {
      if (toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
      }
    }, 300);
  };
  
  setTimeout(remove, duration);
  toastEl.onclick = remove;
};

// 텍스트 자르기
// ISO 8601 duration을 초로 변환
window.seconds = function(iso) {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
};

window.truncateText = function(text, maxLength = 30) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

// 키워드 추출
window.extractKeywords = function(text) {
  if (!text) return [];
  
  const stopWords = new Set([
    '그리고', '하지만', '그러나', '또한', '이제', '그때', '이것', '저것', '여기', '거기',
    '이런', '저런', '같은', '다른', '새로운', '오래된', '큰', '작은', '좋은', '나쁜',
    '많은', '적은', '빠른', '느린', '쉬운', '어려운', '중요한', '필요한', '가능한',
    '불가능한', '모든', '각각', '서로', '함께', '혼자', '이미', '아직', '벌써', '곧',
    '자주', '가끔', '항상', '절대', '정말', '아주', '매우', '너무', '조금', '많이',
    '에서', '에게', '으로', '에서', '부터', '까지', '보다', '처럼', '같이', '마다'
  ]);

  const words = text
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.has(w) && !/^\d+$/.test(w))
    .map(w => w.toLowerCase());

  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);

  // 1회만 등장하는 키워드 제거
  return Object.entries(freq)
    .filter(([word, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
};

// ISO 8601 duration을 초로 변환
window.seconds = function(iso) {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || '0', 10);
  const m = parseInt(match[2] || '0', 10);
  const s = parseInt(match[3] || '0', 10);
  return h * 3600 + m * 60 + s;
};

// 페이지네이션 렌더링
window.renderPagination = function(containerId, currentPage, totalItems, itemsPerPage, onPageChange) {
  const container = window.qs('#' + containerId) || window.qs(containerId);
  if (!container) {
    console.warn('페이지네이션 컨테이너를 찾을 수 없음:', containerId);
    return;
  }

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  
  // 이전 버튼
  if (currentPage > 1) {
    html += `<button class="page-btn" data-page="${currentPage - 1}">‹</button>`;
  }

  // 페이지 번호들
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === currentPage ? 'active' : '';
    html += `<button class="page-btn ${activeClass}" data-page="${i}">${i}</button>`;
  }

  // 다음 버튼
  if (currentPage < totalPages) {
    html += `<button class="page-btn" data-page="${currentPage + 1}">›</button>`;
  }

  container.innerHTML = html;
  
  // 페이지 버튼 이벤트 바인딩
  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const page = parseInt(e.target.dataset.page);
      if (page && onPageChange) {
        onPageChange(page);
      }
    });
  });
};

// 에러 표시
window.showError = function(containerId, message) {
  const container = window.qs('#' + containerId) || window.qs(containerId);
  if (container) {
    container.innerHTML = `<div class="error-message" style="color: var(--brand); text-align: center; padding: 20px; background: var(--glass-bg); border-radius: 8px; border: 1px solid var(--border);">${message}</div>`;
  }
};

// 성공 표시
window.showSuccess = function(containerId, message) {
  const container = window.qs('#' + containerId) || window.qs(containerId);
  if (container) {
    container.innerHTML = `<div class="success-message" style="color: #1db954; text-align: center; padding: 20px; background: var(--glass-bg); border-radius: 8px; border: 1px solid var(--border);">${message}</div>`;
  }
};

// 에러 핸들링
window.handleError = function(error, context = '') {
  console.error(`오류 ${context}:`, error);
  
  if (error.message && error.message.includes('quota')) {
    window.toast('API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.', 'error');
  } else if (error.message && error.message.includes('API')) {
    window.toast('API 키 오류입니다. API 키를 확인해주세요.', 'error');
  } else {
    window.toast(`${context} 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`, 'error');
  }
};

// 안전한 파싱
window.safeParseInt = function(value, defaultValue = 0) {
  const parsed = parseInt(value || defaultValue, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

console.log('utils.js 로딩 완료');

// 로딩 확인
console.log('유틸리티 함수 확인:', {
  qs: typeof window.qs,
  fmt: typeof window.fmt,
  toast: typeof window.toast,
  extractKeywords: typeof window.extractKeywords,
  renderPagination: typeof window.renderPagination
});