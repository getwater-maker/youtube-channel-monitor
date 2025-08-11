// UI 관련 함수들 - 완전한 버전

function openModal(id) { 
  const modal = qs(id);
  if (modal) modal.style.display = 'flex'; 
}

function closeModal(id) { 
  const modal = qs(id);
  if (modal) modal.style.display = 'none'; 
}

function initDrag() { 
  const el = qs('main-content'); 
  if (!el) return;
  
  const saved = localStorage.getItem('colOrder'); 
  
  if (saved) { 
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
      }
    }); 
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark'; // 기본값을 dark로 변경
  const body = document.body;
  const btn = qs('btn-toggle-theme');
  
  // 기존 테마 클래스 제거
  body.classList.remove('dark', 'light');
  
  // 저장된 테마 적용
  body.classList.add(savedTheme);
  
  if (btn) {
    btn.textContent = savedTheme === 'dark' ? '라이트 모드' : '다크 모드';
  }
}

function toggleTheme() {
  const body = document.body;
  const btn = qs('btn-toggle-theme');
  
  if (body.classList.contains('dark')) {
    body.classList.remove('dark');
    body.classList.add('light');
    if (btn) btn.textContent = '다크 모드';
    localStorage.setItem('theme', 'light');
  } else {
    body.classList.remove('light');
    body.classList.add('dark');
    if (btn) btn.textContent = '라이트 모드';
    localStorage.setItem('theme', 'dark');
  }
}

function showHome(forceReload = false) {
  if (forceReload) { 
    location.reload(); 
    return; 
  }
  
  const container = document.body.querySelector('.container');
  const analysisSection = qs('analysis-section');
  if (analysisSection) analysisSection.remove();
  
  let mainContent = qs('main-content');
  state.currentView = 'home';
  
  if (!mainContent) {
    // main-content가 없는 경우 완전히 새로 생성
    mainContent = document.createElement('div');
    mainContent.id = 'main-content';
    mainContent.className = 'three-col';
    
    // 기본 섹션들 추가
    mainContent.innerHTML = `
      <section class="col" data-col="channels">
        <div class="col-head" draggable="true">
          <h2>채널 추가</h2>
          <div class="col-actions">
            <button id="btn-add-channel" class="btn">+ 채널 추가</button> 
            <button id="btn-export-channels" class="btn">내보내기</button> 
            <button id="btn-import-channels" class="btn">가져오기</button> 
            <input type="file" id="file-import-channels" accept="application/json" style="display:none" />
            <span>등록: <span id="channel-count">0</span></span>
          </div>
        </div>
        <div class="sort-row">
          <label>정렬:
            <select id="sort-channels">
              <option value="subscribers" selected>구독자수</option>
              <option value="videos">영상갯수</option>
              <option value="latest">최근업로드</option>
            </select>
          </label>
        </div>
        <div id="channel-list" class="channel-list">
          <p class="muted">채널을 추가하세요.</p>
        </div>
        <div id="channel-pagination" class="pagination"></div>
      </section>

      <section class="col" data-col="mutant">
        <div class="col-head" draggable="true">
          <h2>돌연변이 영상</h2>
          <div class="col-actions">
            <div class="date-range">
              <button data-period="1m">1개월</button>
              <button data-period="3m">3개월</button>
              <button class="active" data-period="6m">6개월</button>
              <button data-period="all">전체</button>
            </div>
          </div>
        </div>
        <div class="sort-row">
          <label>정렬:
            <select id="sort-mutant">
              <option value="mutantIndex" selected>돌연변이지수</option>
              <option value="views">조회수</option>
              <option value="subscribers">구독자수</option>
              <option value="latest">최근업로드</option>
            </select>
          </label>
        </div>
        <div id="mutant-keywords" class="keywords"></div>
        <div id="mutant-list" class="video-list">
          <p class="muted">채널을 추가하여 영상을 분석해주세요.</p>
        </div>
        <div id="mutant-pagination" class="pagination"></div>
      </section>

      <section class="col" data-col="latest">
        <div class="col-head" draggable="true">
          <h2>최신 영상</h2>
        </div>
        <div class="sort-row">
          <label>정렬:
            <select id="sort-latest">
              <option value="views" selected>조회수</option>
              <option value="subscribers">구독자수</option>
              <option value="latest">최근업로드</option>
              <option value="mutantIndex">돌연변이지수</option>
            </select>
          </label>
        </div>
        <div id="latest-keywords" class="keywords"></div>
        <div id="latest-list" class="video-list">
          <p class="muted">채널을 추가하여 영상을 분석해주세요.</p>
        </div>
        <div id="latest-pagination" class="pagination"></div>
      </section>
    `;
    
    container.appendChild(mainContent);
    
    // 이벤트 리스너 재연결
    rebindMainContentEvents();
    
    // 드래그 앤 드롭 초기화
    initDrag();
  } else {
    mainContent.style.display = '';
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // 데이터 새로고침
  if (typeof refreshAll === 'function') {
    refreshAll();
  }
}

// 메인 콘텐츠 이벤트 리스너 재연결 함수
function rebindMainContentEvents() {
  // 채널 관련 이벤트 재연결
  const btnAddChannel = qs('btn-add-channel');
  const btnExportChannels = qs('btn-export-channels');
  const btnImportChannels = qs('btn-import-channels');
  const fileImportChannels = qs('file-import-channels');
  
  if (btnAddChannel) {
    btnAddChannel.onclick = () => { 
      if (!hasKeys()) { 
        toast('먼저 API 키를 설정해주세요.'); 
        return; 
      } 
      openModal('modal-add'); 
    };
  }
  
  if (btnExportChannels && typeof exportChannels === 'function') {
    btnExportChannels.onclick = exportChannels;
  }
  
  if (btnImportChannels && fileImportChannels) {
    btnImportChannels.onclick = () => fileImportChannels.click();
  }
  
  if (fileImportChannels && typeof importChannelsFromFile === 'function') {
    fileImportChannels.onchange = (e) => { 
      const f = e.target.files[0]; 
      if (f) importChannelsFromFile(f); 
      e.target.value = ''; 
    };
  }

  // 정렬 변경 이벤트 재연결
  const sortChannels = qs('sort-channels');
  const sortMutant = qs('sort-mutant');
  const sortLatest = qs('sort-latest');
  
  if (sortChannels && typeof refreshAll === 'function') {
    sortChannels.onchange = () => {
      if (state && state.currentPage) {
        state.currentPage.channels = 1;
      }
      refreshAll('channels');
    };
  }
  
  if (sortMutant && typeof refreshAll === 'function') {
    sortMutant.onchange = () => {
      if (state && state.currentPage) {
        state.currentPage.mutant = 1;
      }
      refreshAll('mutant');
    };
  }
  
  if (sortLatest && typeof refreshAll === 'function') {
    sortLatest.onchange = () => {
      if (state && state.currentPage) {
        state.currentPage.latest = 1;
      }
      refreshAll('latest');
    };
  }
}

// 전체 갱신 함수
async function refreshAll(which) {
  if (!hasKeys()) { 
    toast('API 키를 설정해주세요.'); 
    return; 
  }
  
  if (!state || state.currentView === 'home') {
    try {
      if (!which || which === 'channels') {
        if (typeof refreshChannels === 'function') {
          await refreshChannels();
        }
      }
      if (!which || which === 'mutant') {
        if (typeof refreshMutant === 'function') {
          await refreshMutant();
        }
      }
      if (!which || which === 'latest') {
        if (typeof refreshLatest === 'function') {
          await refreshLatest();
        }
      }
    } catch (error) {
      console.error('데이터 새로고침 오류:', error);
      if (typeof handleAnalysisError === 'function') {
        handleAnalysisError(error, '데이터 새로고침 중');
      } else {
        toast('데이터 새로고침 중 오류가 발생했습니다.');
      }
    }
  }
}

// 안전한 초기화 함수
function safeInit() {
  try {
    loadTheme();
    initDrag();
    
    // 기본 상태 확인
    if (!window.state) {
      window.state = {
        currentMutantPeriod: '6m',
        currentView: 'home',
        currentPage: {
          channels: 1,
          mutant: 1,
          latest: 1
        }
      };
    }
    
    console.log('UI 초기화 완료');
  } catch (error) {
    console.error('UI 초기화 오류:', error);
  }
}

// 전역으로 노출
window.openModal = openModal;
window.closeModal = closeModal;
window.initDrag = initDrag;
window.loadTheme = loadTheme;
window.toggleTheme = toggleTheme;
window.showHome = showHome;
window.rebindMainContentEvents = rebindMainContentEvents;
window.refreshAll = refreshAll;
window.safeInit = safeInit;
