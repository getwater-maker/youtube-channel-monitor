// YouTube 채널 모니터 - 메인 스크립트
console.log('main.js 로딩 시작');

// 이벤트 바인딩
function bindEvents() {
  console.log('이벤트 바인딩 시작');
  
  // API 키 버튼
  const btnApi = qs('#btn-api');
  console.log('API 버튼 찾음:', !!btnApi);
  if (btnApi) {
    btnApi.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('API 버튼 클릭됨');
      window.openApiModal();
    });
  }

  // 테마 토글 버튼
  const btnToggleTheme = qs('#btn-toggle-theme');
  console.log('테마 버튼 찾음:', !!btnToggleTheme);
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('테마 버튼 클릭됨');
      window.toggleTheme();
    });
  }

  // 채널 추가 버튼
  const btnAddChannel = qs('#btn-add-channel');
  console.log('채널 추가 버튼 찾음:', !!btnAddChannel);
  if (btnAddChannel) {
    btnAddChannel.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('채널 추가 버튼 클릭됨');
      if (!window.hasKeys()) {
        window.toast('먼저 API 키를 설정해주세요.\n우상단의 🔑 API 키 버튼을 클릭하세요.', 'warning');
        return;
      }
      window.openModal('modal-add');
    });
  }

  // 분석 버튼
  const btnAnalyze = qs('#btn-analyze');
  console.log('분석 버튼 찾음:', !!btnAnalyze);
  if (btnAnalyze) {
    btnAnalyze.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('분석 버튼 클릭됨');
      if (!window.hasKeys()) {
        window.toast('먼저 API 키를 설정해주세요.\n우상단의 🔑 API 키 버튼을 클릭하세요.', 'warning');
        return;
      }
      openAnalyzeModal();
    });
  }

  // 채널 내보내기
  const btnExportChannels = qs('#btn-export-channels');
  if (btnExportChannels) {
    btnExportChannels.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('채널 내보내기 클릭됨');
      window.exportChannels();
    });
  }

  // 채널 가져오기
  const btnImportChannels = qs('#btn-import-channels');
  const fileImportChannels = qs('#file-import-channels');
  if (btnImportChannels && fileImportChannels) {
    btnImportChannels.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('채널 가져오기 클릭됨');
      fileImportChannels.click();
    });
    
    fileImportChannels.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('가져오기 파일 선택됨:', file.name);
        window.importChannelsFromFile(file);
      }
      e.target.value = '';
    });
  }

  // 모달 닫기 버튼들
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('모달 닫기 버튼 클릭됨');
      const modal = e.target.closest('.modal');
      if (modal) {
        modal.style.display = 'none';
      }
    });
  });

  // 모달 외부 클릭시 닫기
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        console.log('모달 외부 클릭으로 닫기');
        modal.style.display = 'none';
      }
    });
  });

  // 정렬 변경 이벤트
  const sortChannels = qs('#sort-channels');
  if (sortChannels) {
    sortChannels.addEventListener('change', () => {
      console.log('채널 정렬 변경됨');
      window.refreshChannels();
    });
  }

  const sortMutant = qs('#sort-mutant');
  if (sortMutant) {
    sortMutant.addEventListener('change', () => {
      console.log('돌연변이 정렬 변경됨');
      if (typeof window.refreshMutant === 'function') {
        window.refreshMutant();
      }
    });
  }

  const sortLatest = qs('#sort-latest');
  if (sortLatest) {
    sortLatest.addEventListener('change', () => {
      console.log('최신 영상 정렬 변경됨');
      if (typeof window.refreshLatest === 'function') {
        window.refreshLatest();
      }
    });
  }

  // API 키 모달 이벤트
  bindApiEvents();

  // 채널 추가 모달 이벤트
  bindChannelAddEvents();

  // 전역 클릭 이벤트 (기간 선택, 탭 전환 등)
  bindGlobalEvents();

  console.log('이벤트 바인딩 완료');
}

// API 키 모달 이벤트
function bindApiEvents() {
  console.log('API 이벤트 바인딩 시작');
  
  const apiSave = qs('#api-save');
  if (apiSave) {
    apiSave.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('API 저장 버튼 클릭됨');
      
      const keys = [...document.querySelectorAll('.api-inp')]
        .map(input => input.value.trim())
        .filter(Boolean);
      
      console.log('입력된 키 개수:', keys.length);
      
      window.setApiKeys(keys);
      window.toast('API 키가 저장되었습니다.', 'success');
      
      const testResult = qs('#api-test-result');
      if (testResult) testResult.innerHTML = '';
      
      window.closeModal('modal-api');
      
      // 데이터 새로고침
      setTimeout(() => {
        window.refreshChannels();
        if (typeof window.refreshMutant === 'function') {
          window.refreshMutant();
        }
        if (typeof window.refreshLatest === 'function') {
          window.refreshLatest();
        }
      }, 500);
    });
  }

  const apiTest = qs('#api-test');
  if (apiTest) {
    apiTest.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('API 테스트 버튼 클릭됨');
      
      const keys = [...document.querySelectorAll('.api-inp')]
        .map(input => input.value.trim())
        .filter(Boolean);
      
      const testKeys = keys.length ? keys : (window.apiKeys || []);
      const testResult = qs('#api-test-result');

      if (!testKeys.length) {
        if (testResult) {
          testResult.innerHTML = '<span style="color: var(--brand);">저장된 키가 없습니다.</span>';
        }
        return;
      }

      if (testResult) {
        testResult.innerHTML = 'API 키 테스트 중...';
        testResult.style.background = 'var(--glass-bg)';
        testResult.style.border = '1px solid var(--border)';
        testResult.style.padding = '12px';
        testResult.style.borderRadius = '8px';
        testResult.style.marginTop = '16px';
      }

      let success = false;
      let lastError = '';

      for (const key of testKeys) {
        try {
          const testUrl = `${window.CONFIG.API_BASE}channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${encodeURIComponent(key)}`;
          const response = await fetch(testUrl);
          const data = await response.json();
          
          if (!data.error) {
            success = true;
            break;
          }
          lastError = data.error.message || JSON.stringify(data.error);
        } catch (e) {
          lastError = e.message || String(e);
        }
      }

      if (testResult) {
        testResult.innerHTML = success ?
          '<span style="color: #1db954;">✓ API 키가 정상적으로 작동합니다!</span>' :
          `<span style="color: var(--brand);">✗ API 키 테스트 실패: ${lastError}<br><small>Google Cloud Console에서 YouTube Data API v3 활성화 및 할당량을 확인해주세요.</small></span>`;
      }
    });
  }

  // API 키 내보내기
  const apiExport = qs('#api-export');
  if (apiExport) {
    apiExport.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('API 키 내보내기 클릭됨');
      exportApiKeys();
    });
  }

  // API 키 가져오기
  const apiImportBtn = qs('#api-import-btn');
  const apiImportFile = qs('#api-import-file');
  if (apiImportBtn && apiImportFile) {
    apiImportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('API 키 가져오기 클릭됨');
      apiImportFile.click();
    });
    
    apiImportFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('API 키 파일 선택됨:', file.name);
        importApiKeys(file);
      }
      e.target.value = '';
    });
  }
  
  console.log('API 이벤트 바인딩 완료');
}

// API 키 내보내기
function exportApiKeys() {
  try {
    if (!window.apiKeys || window.apiKeys.length === 0) {
      window.toast('내보낼 API 키가 없습니다.', 'warning');
      return;
    }

    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      apiKeys: window.apiKeys
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtube-api-keys.json';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
    
    window.toast('API 키를 내보냈습니다.', 'success');
    console.log('API 키 내보내기 완료');
  } catch (e) {
    console.error('API 키 내보내기 실패:', e);
    window.toast('API 키 내보내기 중 오류가 발생했습니다.', 'error');
  }
}

// API 키 가져오기
async function importApiKeys(file) {
  try {
    console.log('API 키 가져오기 시작');
    const text = await file.text();
    
    let keys = [];
    
    // JSON 형식 시도
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        keys = parsed.filter(k => typeof k === 'string' && k.trim());
      } else if (parsed.apiKeys && Array.isArray(parsed.apiKeys)) {
        keys = parsed.apiKeys.filter(k => typeof k === 'string' && k.trim());
      } else if (typeof parsed === 'object') {
        keys = Object.values(parsed).filter(k => typeof k === 'string' && k.trim());
      }
    } catch (e) {
      // 텍스트 형식으로 시도 (한 줄에 하나씩)
      keys = text.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    }

    if (!keys.length) {
      window.toast('유효한 API 키를 찾을 수 없습니다.', 'warning');
      return;
    }

    // 기존 키와 병합
    const existingKeys = new Set(window.apiKeys || []);
    const newKeys = keys.filter(k => !existingKeys.has(k));
    const allKeys = [...(window.apiKeys || []), ...newKeys];

    if (newKeys.length === 0) {
      window.toast('모든 키가 이미 등록되어 있습니다.', 'info');
      return;
    }

    window.setApiKeys(allKeys);
    
    // API 모달 다시 열어서 키 표시
    setTimeout(() => {
      window.openApiModal();
    }, 100);
    
    window.toast(`${newKeys.length}개의 새로운 API 키를 가져왔습니다.`, 'success');
    
  } catch (e) {
    console.error('API 키 가져오기 실패:', e);
    window.toast('API 키 파일을 읽는 중 오류가 발생했습니다.', 'error');
  }
}

// 채널 추가 모달 이벤트 - 개선된 버전
function bindChannelAddEvents() {
  console.log('채널 추가 이벤트 바인딩 시작');
  
  const btnUrlAdd = qs('#btn-url-add');
  const urlInput = qs('#url-input');
  
  if (btnUrlAdd && urlInput) {
    const handleUrlAdd = async () => {
      console.log('URL 추가 핸들러 실행');
      const input = urlInput.value.trim();
      
      if (!input) {
        window.toast('채널명, URL 또는 ID를 입력해주세요.\n\n예시:\n• "봉준호"\n• "Google Developers"\n• "@GoogleDevelopers"\n• "UC_x5XG1OV2P6uZZ5FSM9Ttw"', 'warning');
        return;
      }

      if (!window.hasKeys()) {
        window.toast('먼저 API 키를 설정해주세요.', 'warning');
        return;
      }

      const resultDiv = qs('#url-result');
      if (resultDiv) {
        resultDiv.innerHTML = `
          <div class="loading-state" style="text-align: center; padding: 20px; background: var(--glass-bg); border-radius: 8px; margin-top: 16px;">
            <div class="loading-spinner"></div>
            <div style="margin-top: 12px; color: var(--text);">
              "${input}" 채널을 검색하는 중...
            </div>
          </div>
        `;
      }

      try {
        let channelId = await window.extractChannelId(input);
        
        if (!channelId) {
          window.toast(`"${input}" 채널을 찾을 수 없습니다.\n\n다른 검색어를 시도해보세요:\n• 정확한 채널명\n• 영어 채널명\n• @핸들명`, 'error');
          if (resultDiv) resultDiv.innerHTML = '';
          return;
        }

        const success = await window.addChannelById(channelId);
        if (success) {
          window.closeModal('modal-add');
          urlInput.value = '';
          if (resultDiv) resultDiv.innerHTML = '';
          
          // 영상 데이터도 새로고침
          setTimeout(() => {
            if (typeof window.refreshMutant === 'function') {
              window.refreshMutant();
            }
            if (typeof window.refreshLatest === 'function') {
              window.refreshLatest();
            }
          }, 1000);
        } else {
          if (resultDiv) resultDiv.innerHTML = '';
        }
      } catch (e) {
        console.error('채널 추가 오류:', e);
        
        let errorMessage = e.message;
        if (e.message.includes('API 키')) {
          errorMessage = 'API 키 오류입니다. API 키를 확인해주세요.';
        } else if (e.message.includes('할당량')) {
          errorMessage = 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.';
        }
        
        window.toast(`채널 추가 실패: ${errorMessage}`, 'error');
        if (resultDiv) resultDiv.innerHTML = '';
      }
    };

    btnUrlAdd.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('URL 추가 버튼 클릭됨');
      handleUrlAdd();
    });
    
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        console.log('Enter 키로 URL 추가');
        handleUrlAdd();
      }
    });

    // 입력 필드 포커스시 플레이스홀더 개선
    urlInput.addEventListener('focus', () => {
      if (!urlInput.value) {
        urlInput.placeholder = '예: "봉준호", "@GoogleDevelopers", 채널 URL...';
      }
    });

    urlInput.addEventListener('blur', () => {
      urlInput.placeholder = '채널 URL, ID, @핸들, 영상 URL 등을 입력하세요';
    });
  }
  
  console.log('채널 추가 이벤트 바인딩 완료');
}

// 전역 클릭 이벤트
function bindGlobalEvents() {
  console.log('전역 이벤트 바인딩 시작');
  
  document.addEventListener('click', (e) => {
    // 기간 선택 버튼 처리
    const periodBtn = e.target.closest('[data-period]');
    if (periodBtn) {
      console.log('기간 버튼 클릭됨:', periodBtn.dataset.period);
      document.querySelectorAll('[data-period]').forEach(btn => btn.classList.remove('active'));
      periodBtn.classList.add('active');

      if (window.state) {
        window.state.currentMutantPeriod = periodBtn.dataset.period;
        window.state.currentPage.mutant = 1;
      }

      // 돌연변이 영상 새로고침
      if (window.refreshMutant) {
        window.refreshMutant();
      }
    }

    // 탭 전환 처리
    const tab = e.target.closest('.add-tab');
    if (tab) {
      console.log('탭 클릭됨:', tab.dataset.addTab);
      const tabId = tab.dataset.addTab;
      
      // 모든 탭 비활성화
      document.querySelectorAll('.add-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.add-tab-content').forEach(c => c.classList.remove('active'));
      
      // 선택한 탭 활성화
      tab.classList.add('active');
      const content = qs('#add-tab-' + tabId);
      if (content) content.classList.add('active');
    }
  });
  
  console.log('전역 이벤트 바인딩 완료');
}

// 채널 분석 모달 열기
async function openAnalyzeModal() {
  console.log('채널 분석 모달 열기');
  
  try {
    const channels = await window.getAllChannels();
    
    if (!channels.length) {
      window.toast('분석할 채널이 없습니다.\n먼저 채널을 추가해주세요.', 'warning');
      return;
    }
    
    window.openModal('modal-analyze');
    
    const analyzeList = qs('#analyze-channel-list');
    if (!analyzeList) {
      console.error('analyze-channel-list 요소를 찾을 수 없음');
      return;
    }
    
    analyzeList.innerHTML = '';
    
    channels.forEach(channel => {
      const channelItem = document.createElement('div');
      channelItem.className = 'analyze-channel-item';
      channelItem.style.cssText = `
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border: 2px solid var(--border);
        border-radius: 12px;
        margin-bottom: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
        background: var(--card);
      `;
      
      channelItem.innerHTML = `
        <img src="${channel.thumbnail || ''}" alt="${channel.title}" style="
          width: 60px;
          height: 60px;
          border-radius: 12px;
          object-fit: cover;
          border: 2px solid var(--border);
        ">
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px;">${channel.title}</div>
          <div style="font-size: 12px; color: var(--muted);">구독자: ${window.fmt(channel.subscriberCount)} · 영상: ${window.fmt(channel.videoCount)}</div>
        </div>
        <button class="btn btn-primary analyze-btn" data-channel-id="${channel.id}">분석 시작</button>
      `;
      
      // 호버 효과
      channelItem.addEventListener('mouseenter', () => {
        channelItem.style.borderColor = 'var(--brand)';
        channelItem.style.background = 'var(--glass-bg)';
      });
      
      channelItem.addEventListener('mouseleave', () => {
        channelItem.style.borderColor = 'var(--border)';
        channelItem.style.background = 'var(--card)';
      });
      
      // 분석 버튼 클릭
      const analyzeBtn = channelItem.querySelector('.analyze-btn');
      analyzeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startChannelAnalysis(channel);
      });
      
      // 전체 아이템 클릭
      channelItem.addEventListener('click', () => {
        startChannelAnalysis(channel);
      });
      
      analyzeList.appendChild(channelItem);
    });
    
  } catch (e) {
    console.error('분석 모달 열기 실패:', e);
    window.toast('분석 모달을 여는 중 오류가 발생했습니다.', 'error');
  }
}

// 채널 분석 시작
async function startChannelAnalysis(channel) {
  console.log('채널 분석 시작:', channel.title);
  
  window.closeModal('modal-analyze');
  window.toast(`${channel.title} 채널 분석을 시작합니다...`, 'info');
  
  try {
    // 간단한 분석 결과 표시
    setTimeout(() => {
      const analysisResults = `📊 ${channel.title} 분석 결과:
• 구독자: ${window.fmt(channel.subscriberCount)}명
• 총 영상: ${window.fmt(channel.videoCount)}개
• 최신 업로드: ${channel.latestUploadDate ? moment(channel.latestUploadDate).format('YYYY-MM-DD') : '정보 없음'}
• 국가: ${channel.country || '정보 없음'}`;
      
      window.toast(analysisResults, 'success', 8000);
      
      // 돌연변이 영상과 최신 영상 새로고침
      setTimeout(() => {
        if (typeof window.refreshMutant === 'function') {
          window.refreshMutant();
        }
        if (typeof window.refreshLatest === 'function') {
          window.refreshLatest();
        }
      }, 1000);
      
    }, 1000);
    
  } catch (e) {
    console.error('채널 분석 실패:', e);
    window.toast('채널 분석 중 오류가 발생했습니다.', 'error');
  }
}

// 초기 데이터 로드
function initialDataLoad() {
  console.log('초기 데이터 로드 시작');
  
  if (window.hasKeys()) {
    console.log('API 키 있음, 데이터 로드 시작');
    
    // 먼저 채널 데이터 로드
    setTimeout(() => {
      if (typeof window.refreshChannels === 'function') {
        window.refreshChannels();
      }
    }, 500);
    
    // 채널 로드 후 영상 데이터 로드
    setTimeout(() => {
      if (typeof window.refreshMutant === 'function') {
        console.log('돌연변이 영상 새로고침 시작');
        window.refreshMutant();
      } else {
        console.error('refreshMutant 함수가 정의되지 않음');
      }
      
      if (typeof window.refreshLatest === 'function') {
        console.log('최신 영상 새로고침 시작');
        window.refreshLatest();
      } else {
        console.error('refreshLatest 함수가 정의되지 않음');
      }
    }, 2000);
    
  } else {
    console.log('API 키 없음, 설정 안내');
    window.toast('🔑 API 키를 설정해주세요!\n\n1. 우상단 "🔑 API 키" 버튼 클릭\n2. YouTube Data API v3 키 입력\n3. 저장 후 채널 추가', 'info', 8000);
  }
}

// 메인 초기화 함수
function initializeApp() {
  console.log('앱 초기화 시작...');

  try {
    // moment.js 설정 (이미 config.js에서 설정되었지만 확인)
    if (typeof moment !== 'undefined') {
      moment.tz.setDefault('Asia/Seoul');
      moment.locale('ko');
      console.log('Moment.js 설정 확인 완료');
    } else {
      console.warn('Moment.js가 로드되지 않았습니다');
    }

    // Chart.js 전역 설정
    if (typeof Chart !== 'undefined') {
      Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
      Chart.defaults.plugins.legend.display = true;
      Chart.defaults.animation.duration = 800;
      console.log('Chart.js 설정 완료');
    }

    // 테마 로드
    window.loadTheme();

    // 드래그 앤 드롭 초기화
    window.initDrag();

    // 이벤트 바인딩
    bindEvents();

    // 초기 데이터 로드
    initialDataLoad();

    console.log('앱 초기화 완료');
    
  } catch (error) {
    console.error('앱 초기화 오류:', error);
    window.toast('앱 초기화 중 오류가 발생했습니다: ' + error.message, 'error');
  }
}

// 함수 로딩 상태 확인
function checkRequiredFunctions() {
  const requiredFunctions = [
    'qs', 'fmt', 'toast', 'hasKeys', 'openModal', 'closeModal',
    'loadTheme', 'toggleTheme', 'initDrag', 'getAllChannels',
    'addChannelById', 'refreshChannels', 'extractChannelId'
  ];
  
  const missingFunctions = [];
  
  for (const funcName of requiredFunctions) {
    if (typeof window[funcName] !== 'function') {
      missingFunctions.push(funcName);
    }
  }
  
  if (missingFunctions.length > 0) {
    console.error('누락된 필수 함수들:', missingFunctions);
    return false;
  }
  
  console.log('모든 필수 함수 로딩 확인 완료');
  return true;
}

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 로드 완료');
  
  // 라이브러리 로딩 확인
  const libraryStatus = {
    moment: typeof moment !== 'undefined',
    Chart: typeof Chart !== 'undefined',
    Sortable: typeof Sortable !== 'undefined'
  };
  
  console.log('라이브러리 로딩 상태:', libraryStatus);
  
  // 필수 함수들이 로드될 때까지 대기
  let retryCount = 0;
  const maxRetries = 10;
  
  function waitForFunctions() {
    retryCount++;
    
    if (checkRequiredFunctions()) {
      console.log('모든 함수가 로드됨, 앱 초기화 시작');
      setTimeout(initializeApp, 100);
    } else if (retryCount < maxRetries) {
      console.log(`함수 로딩 대기 중... (${retryCount}/${maxRetries})`);
      setTimeout(waitForFunctions, 500);
    } else {
      console.error('필수 함수 로드 실패, 강제 초기화 시도');
      
      // 기본적인 함수들이라도 있으면 초기화 시도
      if (typeof window.qs === 'function' && typeof window.toast === 'function') {
        window.toast('일부 기능이 로드되지 않았을 수 있습니다.\n페이지를 새로고침해주세요.', 'warning', 10000);
        setTimeout(initializeApp, 1000);
      } else {
        alert('앱 로딩 중 오류가 발생했습니다.\n페이지를 새로고침해주세요.');
      }
    }
  }
  
  // 즉시 확인하고 필요시 대기
  waitForFunctions();
});

console.log('main.js 로딩 완료');