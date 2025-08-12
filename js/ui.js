// YouTube 채널 모니터 - UI 관리
console.log('ui.js 로딩 시작');

// 모달 열기
function openModal(id) { 
  console.log('모달 열기:', id);
  const modal = qs('#' + id);
  if (modal) {
    modal.style.display = 'flex';
    console.log('모달 열림 성공');
  } else {
    console.error('모달을 찾을 수 없음:', id);
  }
}

// 모달 닫기
function closeModal(id) { 
  console.log('모달 닫기:', id);
  const modal = qs('#' + id);
  if (modal) {
    modal.style.display = 'none';
    console.log('모달 닫힘 성공');
  } else {
    console.error('모달을 찾을 수 없음:', id);
  }
}

// 드래그 앤 드롭 초기화
function initDrag() { 
  console.log('드래그 앤 드롭 초기화 시작');
  const el = qs('#main-content');
  if (!el) {
    console.warn('main-content 요소를 찾을 수 없어 드래그 초기화를 건너뜀');
    return;
  }
  
  const saved = localStorage.getItem('colOrder'); 
  
  if (saved) { 
    console.log('저장된 컬럼 순서 복원:', saved);
    saved.split(',').forEach(k => { 
      const sec = el.querySelector(`[data-col="${k}"]`); 
      if (sec) el.appendChild(sec); 
    }); 
  } 
  
  if (typeof Sortable !== 'undefined') {
    Sortable.create(el, {
      animation: 150,
      handle: '.col-head',
      onSort: () => {
        const keys = [...el.children].map(n => n.getAttribute('data-col')); 
        localStorage.setItem('colOrder', keys.join(','));
        console.log('컬럼 순서 저장:', keys.join(','));
      }
    }); 
    console.log('드래그 앤 드롭 초기화 완료');
  } else {
    console.warn('Sortable 라이브러리가 로드되지 않음');
  }
}

// 테마 로드
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  const body = document.body;
  const btn = qs('#btn-toggle-theme');
  
  console.log('테마 로드:', savedTheme);
  
  // 기존 테마 클래스 제거
  body.classList.remove('dark', 'light');
  
  // 저장된 테마 적용
  body.classList.add(savedTheme);
  
  if (btn) {
    btn.textContent = savedTheme === 'dark' ? '라이트 모드' : '다크 모드';
  }
  
  console.log('테마 로드 완료:', savedTheme);
}

// 테마 토글
function toggleTheme() {
  const body = document.body;
  const btn = qs('#btn-toggle-theme');
  
  console.log('테마 토글 시작');
  
  if (body.classList.contains('dark')) {
    body.classList.remove('dark');
    body.classList.add('light');
    if (btn) btn.textContent = '다크 모드';
    localStorage.setItem('theme', 'light');
    console.log('라이트 모드로 변경');
  } else {
    body.classList.remove('light');
    body.classList.add('dark');
    if (btn) btn.textContent = '라이트 모드';
    localStorage.setItem('theme', 'dark');
    console.log('다크 모드로 변경');
  }
}

// API 모달 열기
function openApiModal() {
  console.log('API 모달 열기 시작');
  const apiInputsContainer = qs('#api-inputs');
  
  if (!apiInputsContainer) {
    console.error('API 입력 컨테이너를 찾을 수 없음');
    return;
  }
  
  apiInputsContainer.innerHTML = '';
  
  for (let i = 0; i < 5; i++) {
    const apiKey = (window.apiKeys && window.apiKeys[i]) || '';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'api-inp';
    input.placeholder = `API Key ${i + 1}`;
    input.value = apiKey;
    input.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      margin-bottom: 12px;
      border: 2px solid var(--border);
      border-radius: 8px;
      background: var(--card);
      color: var(--text);
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
    `;
    apiInputsContainer.appendChild(input);
  }

  const testResult = qs('#api-test-result');
  if (testResult) testResult.innerHTML = '';

  openModal('modal-api');
}

// 홈 화면으로 이동
function showHome() {
  console.log('홈 화면으로 이동');
  
  const analysisSection = qs('#analysis-section');
  if (analysisSection) {
    analysisSection.remove();
    console.log('분석 섹션 제거됨');
  }
  
  const mainContent = qs('#main-content');
  if (mainContent) {
    mainContent.style.display = '';
  }
  
  if (window.state) {
    window.state.currentView = 'home';
  }
  
  console.log('홈 화면 이동 완료');
}

// 전역으로 노출
window.openModal = openModal;
window.closeModal = closeModal;
window.initDrag = initDrag;
window.loadTheme = loadTheme;
window.toggleTheme = toggleTheme;
window.openApiModal = openApiModal;
window.showHome = showHome;

console.log('ui.js 로딩 완료');