// ui.js의 showHome 함수를 다음과 같이 수정해주세요

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
  } else {
    mainContent.style.display = '';
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  refreshAll();
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
  
  if (btnExportChannels) {
    btnExportChannels.onclick = exportChannels;
  }
  
  if (btnImportChannels) {
    btnImportChannels.onclick = () => fileImportChannels.click();
  }
  
  if (fileImportChannels) {
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
  
  if (sortChannels) {
    sortChannels.onchange = () => {
      state.currentPage.channels = 1;
      refreshAll('channels');
    };
  }
  
  if (sortMutant) {
    sortMutant.onchange = () => {
      state.currentPage.mutant = 1;
      refreshAll('mutant');
    };
  }
  
  if (sortLatest) {
    sortLatest.onchange = () => {
      state.currentPage.latest = 1;
      refreshAll('latest');
    };
  }
}
