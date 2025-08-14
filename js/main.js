// YouTube 채널 모니터 - 메인 엔트리 포인트
console.log('main.js 로딩 시작');

// ============================================================================
// 유틸: 안전 호출
// ============================================================================
function safeCall(fnName, ...args) {
  try {
    const fn = window[fnName];
    if (typeof fn === 'function') {
      return fn(...args);
    }
  } catch (e) {
    console.warn(`${fnName} 호출 중 예외:`, e);
  }
  return undefined;
}

// 간단 유틸
function isUrlLike(s) {
  return /^https?:\/\//i.test(s) || /^@/.test(s) || /^UC[A-Za-z0-9_-]{22}$/.test(s);
}
function fmtNum(n) {
  const v = parseInt(n || 0, 10);
  if (v >= 100000000) return `${Math.floor(v / 100000000)}억`;
  if (v >= 10000) return `${Math.floor(v / 10000)}만`;
  if (v >= 1000) return `${Math.floor(v / 1000)}천`;
  return `${v}`;
}

// ============================================================================
// 검색 상태 (모달 내부 전용)
// ============================================================================
window.__searchState = {
  query: '',
  prevPageToken: null,
  nextPageToken: null,
  pageSize: 5,
};

// 검색 결과 렌더링 (구독자수 내림차순 정렬 반영)
async function renderSearchResults(query, items, prevToken, nextToken) {
  const wrap = document.getElementById('url-result');
  if (!wrap) return;
  window.__searchState.query = query;
  window.__searchState.prevPageToken = prevToken || null;
  window.__searchState.nextPageToken = nextToken || null;

  if (!items || !items.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="margin-top:12px;">
        <div class="empty-icon">🔍</div>
        <p class="muted">검색 결과가 없습니다.</p>
      </div>`;
    return;
  }

  try {
    // 1) 채널 상세(썸네일/구독자/업로드플레이리스트 등)
    const ids = items.map(i => i.id.channelId).filter(Boolean);
    const chRes = await window.yt('channels', {
      part: 'snippet,statistics,contentDetails',
      id: ids.join(',')
    });
    const infoMap = {};
    (chRes.items || []).forEach(ch => {
      infoMap[ch.id] = ch;
    });

    // 2) 최근 업로드 날짜: 채널의 업로드 플레이리스트에서 최근 롱폼 영상 찾기
    const latestDates = {};
    for (const id of ids) {
      try {
        // 채널의 업로드 플레이리스트에서 최근 롱폼 영상 찾기
        const channelInfo = infoMap[id];
        const uploadsPlaylistId = channelInfo?.contentDetails?.relatedPlaylists?.uploads;
        
        if (uploadsPlaylistId) {
          const playlistResponse = await window.yt('playlistItems', {
            part: 'snippet,contentDetails',
            playlistId: uploadsPlaylistId,
            maxResults: 10
          });
          
          // 롱폼 영상 중 가장 최근 것 찾기
          const videoIds = playlistResponse.items?.map(item => item.contentDetails.videoId).slice(0, 5);
          if (videoIds?.length) {
            const videosResponse = await window.yt('videos', {
              part: 'contentDetails,snippet',
              id: videoIds.join(',')
            });
            
            const longformVideo = videosResponse.items?.find(video => {
              const duration = moment.duration(video.contentDetails.duration).asSeconds();
              return duration >= 181;
            });
            
            latestDates[id] = longformVideo?.snippet?.publishedAt || channelInfo?.snippet?.publishedAt || '';
          } else {
            latestDates[id] = channelInfo?.snippet?.publishedAt || '';
          }
        } else {
          latestDates[id] = channelInfo?.snippet?.publishedAt || '';
        }
      } catch (e) {
        console.error(`채널 ${id} 최근 업로드 조회 실패:`, e);
        latestDates[id] = infoMap[id]?.snippet?.publishedAt || '';
      }
    }

    // 3) 구독자수 기준 내림차순 정렬
    const itemsWithSubs = items.map(it => {
      const cid = it.id.channelId;
      const ch = infoMap[cid];
      const subs = parseInt(ch?.statistics?.subscriberCount || '0', 10);
      return { it, ch, subs };
    }).sort((a, b) => b.subs - a.subs);

    // 4) 리스트 HTML
    const rows = itemsWithSubs.map(({ it, ch, subs }) => {
      const cid = it.id.channelId;
      const thumb =
        ch?.snippet?.thumbnails?.high?.url ||
        ch?.snippet?.thumbnails?.medium?.url ||
        ch?.snippet?.thumbnails?.default?.url ||
        `https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj`;
      const title = ch?.snippet?.title || it.snippet?.channelTitle || '(제목 없음)';
      const latest = latestDates[cid] ? moment(latestDates[cid]).format('YYYY-MM-DD') : '-';

      return `
        <div class="result-row" style="
          display:flex; align-items:center; gap:12px; padding:12px 8px;
          border-bottom:1px solid var(--border);">
          <img src="${thumb}" alt="${title}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;" onerror="this.src='https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj';">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
            <div style="font-size:13px; color:var(--muted);">
              구독자 ${fmtNum(subs)} · 최근업로드 ${latest}
            </div>
          </div>
          <button class="btn btn-primary" data-add-channel-id="${cid}">추가</button>
        </div>`;
    }).join('');

    // 5) 페이지네이션
    const nav = `
      <div style="display:flex; gap:8px; justify-content:center; padding:12px 0;">
        <button id="search-prev" class="btn btn-secondary" ${prevToken ? '' : 'disabled'}>이전</button>
        <button id="search-next" class="btn btn-secondary" ${nextToken ? '' : 'disabled'}>다음</button>
      </div>`;

    wrap.innerHTML = rows + nav;

  } catch (e) {
    console.error('검색 결과 렌더링 오류:', e);
    wrap.innerHTML = `
      <div class="empty-state" style="margin-top:12px;">
        <div class="empty-icon">❌</div>
        <p class="muted">검색 결과를 불러오는 중 오류가 발생했습니다.</p>
      </div>`;
  }
}

// 채널명 검색
async function searchChannelsByName(query, pageToken = '') {
  const wrap = document.getElementById('url-result');
  if (wrap) {
    wrap.innerHTML = `
      <div class="empty-state" style="margin-top:12px;">
        <div class="empty-icon">⏳</div>
        <p class="muted">검색 중...</p>
      </div>`;
  }

  try {
    const res = await window.yt('search', {
      part: 'snippet',
      type: 'channel',
      q: query,
      maxResults: window.__searchState.pageSize || 5,
      pageToken: pageToken || ''
    });

    const items = res.items || [];
    await renderSearchResults(query, items, res.prevPageToken, res.nextPageToken);
  } catch (e) {
    console.error('채널 검색 실패:', e);
    if (wrap) {
      wrap.innerHTML = `
        <div class="empty-state" style="margin-top:12px;">
          <div class="empty-icon">❌</div>
          <p class="muted">검색 실패: ${e?.message || e}</p>
        </div>`;
    }
  }
}

// 페이지 이동 핸들러
function bindSearchListEvents() {
  const wrap = document.getElementById('url-result');
  if (!wrap || wrap.dataset.bound === '1') return;
  wrap.dataset.bound = '1';

  wrap.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-add-channel-id]');
    if (addBtn) {
      e.preventDefault();
      const cid = addBtn.getAttribute('data-add-channel-id');
      if (!cid) return;
      try {
        const ok = await safeCall('addChannelById', cid);
        if (ok) {
          safeCall('refreshChannels');
          window.toast && window.toast('✅ 채널이 추가되었습니다.', 'success');
        }
      } catch (err) {
        window.toast && window.toast('채널 추가 실패: ' + (err?.message || err), 'error');
      }
      return;
    }

    if (e.target.id === 'search-prev') {
      e.preventDefault();
      const t = window.__searchState.prevPageToken;
      if (t) searchChannelsByName(window.__searchState.query, t);
      return;
    }
    if (e.target.id === 'search-next') {
      e.preventDefault();
      const t = window.__searchState.nextPageToken;
      if (t) searchChannelsByName(window.__searchState.query, t);
      return;
    }
  });
}

// ============================================================================
// 채널 추가 모달: 검색 버튼/Enter 키 바인딩 (중복 방지)
// ============================================================================
function bindChannelAddEvents() {
  const btn = document.getElementById('btn-url-add');
  const input = document.getElementById('url-input');

  if (!btn || !input) return;
  if (btn.dataset.bound === '1' && input.dataset.bound === '1') return;

  const handleAdd = async (e) => {
    if (e) e.preventDefault();
    const raw = (input.value || '').trim();
    if (!raw) {
      window.toast && window.toast('채널명/URL을 입력하세요.', 'warning');
      return;
    }
    if (!window.hasKeys || !window.hasKeys()) {
      window.toast && window.toast('먼저 API 키를 설정해주세요.\n우상단의 🔑 API 키 버튼을 클릭하세요.', 'warning');
      return;
    }

    try {
      if (isUrlLike(raw)) {
        // URL/ID/핸들이면 기존 플로우 사용
        const channelId = await safeCall('extractChannelId', raw);
        if (!channelId) {
          window.toast && window.toast('채널을 찾을 수 없습니다. 입력을 확인해주세요.', 'error');
          return;
        }
        const ok = await safeCall('addChannelById', channelId);
        if (ok) {
          input.value = '';
          safeCall('refreshChannels');
        }
      } else {
        // 채널명 검색
        await searchChannelsByName(raw, '');
        bindSearchListEvents();
      }
    } catch (err) {
      console.error('채널 추가 처리 오류:', err);
      window.toast && window.toast('처리 중 오류가 발생했습니다: ' + (err?.message || err), 'error');
    }
  };

  btn.addEventListener('click', handleAdd, { passive: false });
  btn.dataset.bound = '1';

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd(e);
    }
  }, { passive: false });
  input.dataset.bound = '1';
}

// ============================================================================
// API 키 관리 이벤트
// ============================================================================
function bindApiKeyEvents() {
  // API 키 저장
  const apiSaveBtn = document.querySelector('#api-save');
  if (apiSaveBtn && !apiSaveBtn.dataset.bound) {
    apiSaveBtn.addEventListener('click', async () => {
      const inputs = document.querySelectorAll('.api-inp');
      const keys = Array.from(inputs).map(inp => (inp.value || '').trim()).filter(Boolean);
      
      if (!keys.length) {
        window.toast && window.toast('최소 1개의 API 키를 입력하세요.', 'warning');
        return;
      }
      
      window.setApiKeys && window.setApiKeys(keys);
      window.toast && window.toast(`${keys.length}개 API 키가 저장되었습니다.`, 'success');
      window.closeModal && window.closeModal('modal-api');
    });
    apiSaveBtn.dataset.bound = '1';
  }

  // API 키 테스트
  const apiTestBtn = document.querySelector('#api-test');
  if (apiTestBtn && !apiTestBtn.dataset.bound) {
    apiTestBtn.addEventListener('click', async () => {
      const inputs = document.querySelectorAll('.api-inp');
      const keys = Array.from(inputs).map(inp => (inp.value || '').trim()).filter(Boolean);
      
      if (!keys.length) {
        window.toast && window.toast('테스트할 API 키를 입력하세요.', 'warning');
        return;
      }
      
      const result = document.querySelector('#api-test-result');
      if (result) result.innerHTML = '<p>테스트 중...</p>';
      
      // 임시로 키 설정하여 테스트
      const originalKeys = [...(window.apiKeys || [])];
      window.setApiKeys && window.setApiKeys(keys);
      
      try {
        const testResult = await window.yt('channels', {
          part: 'snippet',
          id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw'  // Google 공식 채널 ID로 테스트
        });
        
        if (result) {
          result.innerHTML = '<p style="color: var(--brand);">✅ API 키가 유효합니다!</p>';
        }
      } catch (e) {
        if (result) {
          result.innerHTML = `<p style="color: #c4302b;">❌ API 키 테스트 실패: ${e.message}</p>`;
        }
        // 원래 키로 복원
        window.setApiKeys && window.setApiKeys(originalKeys);
      }
    });
    apiTestBtn.dataset.bound = '1';
  }

  // API 키 내보내기
  const apiExportBtn = document.querySelector('#api-export');
  if (apiExportBtn && !apiExportBtn.dataset.bound) {
    apiExportBtn.addEventListener('click', () => {
      if (!window.apiKeys || !window.apiKeys.length) {
        window.toast && window.toast('내보낼 API 키가 없습니다.', 'warning');
        return;
      }
      
      const dataStr = JSON.stringify(window.apiKeys, null, 2);
      const dataBlob = new Blob([dataStr], {type:'application/json'});
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `youtube-api-keys-${moment().format('YYYY-MM-DD')}.json`;
      link.click();
      
      window.toast && window.toast('API 키를 내보냈습니다.', 'success');
    });
    apiExportBtn.dataset.bound = '1';
  }

  // API 키 가져오기
  const apiImportBtn = document.querySelector('#api-import-btn');
  const apiImportFile = document.querySelector('#api-import-file');
  
  if (apiImportBtn && !apiImportBtn.dataset.bound) {
    apiImportBtn.addEventListener('click', () => {
      apiImportFile && apiImportFile.click();
    });
    apiImportBtn.dataset.bound = '1';
  }
  
  if (apiImportFile && !apiImportFile.dataset.bound) {
    apiImportFile.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const keys = JSON.parse(text);
        
        if (!Array.isArray(keys)) {
          throw new Error('올바른 API 키 데이터가 아닙니다.');
        }
        
        window.setApiKeys && window.setApiKeys(keys);
        window.toast && window.toast(`${keys.length}개 API 키를 가져왔습니다.`, 'success');
        
        // API 모달 다시 열어서 가져온 키들 표시
        window.openApiModal && window.openApiModal();
        
      } catch (err) {
        console.error('API 키 가져오기 실패:', err);
        window.toast && window.toast('가져오기 실패: ' + err.message, 'error');
      }
      
      e.target.value = '';
    });
    apiImportFile.dataset.bound = '1';
  }
}

// ============================================================================
// 내채널 이벤트 바인딩 (새로 추가)
// ============================================================================
function bindMyChannelsEvents() {
  console.log('내채널 이벤트 바인딩 시작');

  // 내채널 섹션 헤더의 버튼들
  const addOAuthChannelBtn = document.querySelector('#btn-add-oauth-channel');
  if (addOAuthChannelBtn && !addOAuthChannelBtn.dataset.bound) {
    addOAuthChannelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('OAuth 채널 연동 버튼 클릭');
      
      // OAuth 인증 시작
      if (typeof window.startOAuthFlow === 'function') {
        window.startOAuthFlow();
      } else if (typeof window.addNewChannel === 'function') {
        // OAuth 매니저가 없으면 데모 채널 추가
        window.addNewChannel();
      } else {
        window.toast && window.toast('OAuth 인증 기능을 준비 중입니다.', 'info');
      }
    });
    addOAuthChannelBtn.dataset.bound = '1';
  }

  // 데모 채널 버튼
  const demoChannelsBtn = document.querySelector('#btn-demo-channels');
  if (demoChannelsBtn && !demoChannelsBtn.dataset.bound) {
    demoChannelsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('데모 채널 버튼 클릭');
      
      if (typeof window.loadDemoChannels === 'function') {
        window.loadDemoChannels();
      } else {
        window.toast && window.toast('데모 채널 로드 기능을 찾을 수 없습니다.', 'error');
      }
    });
    demoChannelsBtn.dataset.bound = '1';
  }

  // 전체 내보내기 버튼
  const exportAllChannelsBtn = document.querySelector('#btn-export-all-channels');
  if (exportAllChannelsBtn && !exportAllChannelsBtn.dataset.bound) {
    exportAllChannelsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('전체 채널 내보내기 버튼 클릭');
      
      if (typeof window.exportAllChannelsData === 'function') {
        window.exportAllChannelsData();
      } else {
        window.toast && window.toast('내보내기 기능을 찾을 수 없습니다.', 'error');
      }
    });
    exportAllChannelsBtn.dataset.bound = '1';
  }

  console.log('내채널 이벤트 바인딩 완료');
}

// ============================================================================
// 이벤트 바인딩
// ============================================================================
function bindEvents() {
  console.log('이벤트 바인딩 시작');

  // API 키 버튼
  const btnApi = document.querySelector('#btn-api');
  if (btnApi) {
    btnApi.addEventListener('click', (e) => {
      e.preventDefault();
      safeCall('openApiModal');
      setTimeout(() => bindApiKeyEvents(), 100);
    });
  }

  // 테마 토글 버튼
  const btnToggleTheme = document.querySelector('#btn-toggle-theme');
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', (e) => {
      e.preventDefault();
      safeCall('toggleTheme');
    });
  }

  // 채널 추가 버튼 (모달 열기)
  const btnAddChannel = document.querySelector('#btn-add-channel');
  if (btnAddChannel) {
    btnAddChannel.addEventListener('click', (e) => {
      e.preventDefault();
      if (!window.hasKeys || !window.hasKeys()) {
        window.toast && window.toast('먼저 API 키를 설정해주세요.\n우상단의 🔑 API 키 버튼을 클릭하세요.', 'warning');
        return;
      }
      window.openModal && window.openModal('modal-add');
      setTimeout(() => { bindChannelAddEvents(); bindSearchListEvents(); }, 0);
    });
  }

  // 분석 버튼 - 수정된 부분
  const btnAnalyze = document.querySelector('#btn-analyze');
  if (btnAnalyze && !btnAnalyze.dataset.bound) {
    btnAnalyze.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // 이벤트 전파 중단
      
      console.log('분석 버튼 클릭됨');
      
      if (!window.hasKeys || !window.hasKeys()) {
        window.toast && window.toast('먼저 API 키를 설정해주세요.\n우상단의 🔑 API 키 버튼을 클릭하세요.', 'warning');
        return;
      }
      
      // 분석 모달을 열기 전에 현재 섹션 저장
      if (window.analysisState) {
        window.analysisState.previousSection = window.navigationState?.currentSection || 'channels';
      }
      
      safeCall('openAnalyzeModal');
    });
    btnAnalyze.dataset.bound = '1';
  }

  // 채널 내보내기
  const btnExportChannels = document.querySelector('#btn-export-channels');
  if (btnExportChannels) {
    btnExportChannels.addEventListener('click', (e) => {
      e.preventDefault();
      safeCall('exportChannels');
    });
  }

  // 채널 가져오기
  const btnImportChannels = document.querySelector('#btn-import-channels');
  const fileImportChannels = document.querySelector('#file-import-channels');
  if (btnImportChannels && fileImportChannels) {
    btnImportChannels.addEventListener('click', (e) => {
      e.preventDefault();
      fileImportChannels.click();
    });
    fileImportChannels.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        safeCall('importChannelsFromFile', file);
      }
      e.target.value = '';
    });
  }

  // 모달 닫기 버튼들
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = e.target.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });

  // 모달 외부 클릭시 닫기
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  // 정렬 변경 이벤트 (섹션별로 자기 것만 새로고침)
  const sortChannels = document.querySelector('#sort-channels');
  if (sortChannels) {
    sortChannels.addEventListener('change', () => safeCall('refreshChannels'));
  }

  const sortMutant = document.querySelector('#sort-mutant');
  if (sortMutant) {
    sortMutant.addEventListener('change', () => safeCall('refreshMutant'));
  }

  const sortLatest = document.querySelector('#sort-latest');
  if (sortLatest) {
    sortLatest.addEventListener('change', () => safeCall('refreshLatest'));
  }

  // 채널 추가 모달 입력/버튼 바인딩(초기 1회 보장)
  bindChannelAddEvents();
  bindSearchListEvents();

  // 내채널 이벤트 바인딩 (새로 추가)
  bindMyChannelsEvents();

  console.log('이벤트 바인딩 완료');
}

// ============================================================================
// 필수 함수 로딩 대기
// ============================================================================
const REQUIRED_FUNCTIONS = [
  'initializeNavigation', // navigation.js에서 제공
  'refreshChannels',      // channels.js
  'refreshMutant',        // mutant-videos.js
  'refreshLatest',        // latest-videos.js
  'initializeMyChannels', // my-channels.js (새로 추가)
  'initializeVideosSection' // videos.js (새로 추가)
];

function checkRequiredFunctions() {
  const missing = REQUIRED_FUNCTIONS.filter(n => typeof window[n] !== 'function');
  if (missing.length) {
    console.warn('누락된 필수 함수들:', missing);
  }
  return missing;
}

function waitForFunctions(maxWaitMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function loop() {
      const missing = checkRequiredFunctions();
      if (missing.length === 0) return resolve(true);
      if (Date.now() - start > maxWaitMs) {
        console.error('필수 함수 로드 실패, 강제 초기화 시도');
        return resolve(false);
      }
      setTimeout(loop, 150);
    })();
  });
}

// ============================================================================
// 초기 데이터 로드
// ============================================================================
async function initialDataLoad() {
  try {
    // 네비게이션 초기화 (내채널 섹션부터 시작)
    safeCall('initializeNavigation');
    
    // OAuth 자동 로그인 시도 (백그라운드)
    setTimeout(() => {
      if (typeof window.autoLogin === 'function') {
        window.autoLogin().catch(e => {
          console.log('OAuth 자동 로그인 실패 또는 토큰 없음:', e.message);
        });
      }
    }, 2000);
    
  } catch (e) {
    console.error('초기 데이터 로드 오류:', e);
  }
}

// ============================================================================
// 앱 초기화
// ============================================================================
async function initializeApp() {
  try {
    // 테마 로드
    safeCall('loadTheme');

    bindEvents();

    const ok = await waitForFunctions(7000);
    if (!ok) {
      // 필수 함수가 일부 없더라도 가능한 부분부터 로드
      console.warn('일부 함수가 준비되지 않았지만 진행합니다.');
    }

    await initialDataLoad();
    console.log('앱 초기화 완료');
    
    // 전역 디버그 정보 노출
    window.appDebug = {
      safeCall,
      checkRequiredFunctions,
      state: {
        hasKeys: typeof window.hasKeys === 'function' ? window.hasKeys() : false,
        isOAuthReady: typeof window.startOAuthFlow === 'function',
        isMyChannelsReady: typeof window.initializeMyChannels === 'function',
        isVideosReady: typeof window.initializeVideosSection === 'function'
      }
    };
    
  } catch (e) {
    console.error('앱 초기화 오류:', e);
  }
}

// ============================================================================
// 전역 함수 노출
// ============================================================================
window.safeCall = safeCall;
window.bindMyChannelsEvents = bindMyChannelsEvents;
window.searchChannelsByName = searchChannelsByName;
window.renderSearchResults = renderSearchResults;

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializeApp);

console.log('main.js 로딩 완료');