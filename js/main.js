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
    // 1) 채널 상세(썸네일/구독자/업로드플리 등)
    const ids = items.map(i => i.id.channelId).filter(Boolean);
    const chRes = await window.yt('channels', {
      part: 'snippet,statistics,contentDetails',
      id: ids.join(',')
    });
    const infoMap = {};
    (chRes.items || []).forEach(ch => {
      infoMap[ch.id] = ch;
    });

    // 2) 최근 업로드 날짜: playlistItems 대신 Search API 로 안전하게 조회
    //    order=date 로 채널 최근 영상 1개만 가져옴 (일부 채널의 비공개 업로드플리 404 회피)
    const latestDates = {};
    for (const id of ids) {
      try {
        const v = await window.yt('search', {
          part: 'snippet',
          channelId: id,
          type: 'video',
          order: 'date',
          maxResults: 1
        });
        latestDates[id] = v.items?.[0]?.snippet?.publishedAt
          || infoMap[id]?.snippet?.publishedAt
          || '';
      } catch {
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
        ch?.snippet?.thumbnails?.default?.url ||
        it.snippet?.thumbnails?.default?.url ||
        '';
      const title = ch?.snippet?.title || it.snippet?.channelTitle || '(제목 없음)';
      const latest = latestDates[cid] ? moment(latestDates[cid]).format('YYYY-MM-DD') : '-';

      return `
        <div class="result-row" style="
          display:flex; align-items:center; gap:12px; padding:12px 8px;
          border-bottom:1px solid var(--border);">
          <img src="${thumb}" alt="${title}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;">
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
        // URL/ID/핸들이면 기존 흐름 사용
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
// 이벤트 바인딩
// ============================================================================
function bindEvents() {
  console.log('이벤트 바인딩 시작');

  // API 키 버튼
  const btnApi = qs('#btn-api');
  if (btnApi) {
    btnApi.addEventListener('click', (e) => {
      e.preventDefault();
      safeCall('openApiModal');
    });
  }

  // 테마 토글 버튼
  const btnToggleTheme = qs('#btn-toggle-theme');
  if (btnToggleTheme) {
    btnToggleTheme.addEventListener('click', (e) => {
      e.preventDefault();
      safeCall('toggleTheme');
    });
  }

  // 채널 추가 버튼 (모달 열기)
  const btnAddChannel = qs('#btn-add-channel');
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

  // 분석 버튼
  const btnAnalyze = qs('#btn-analyze');
  if (btnAnalyze) {
    btnAnalyze.addEventListener('click', (e) => {
      e.preventDefault();
      if (!window.hasKeys || !window.hasKeys()) {
        window.toast && window.toast('먼저 API 키를 설정해주세요.\n우상단의 🔑 API 키 버튼을 클릭하세요.', 'warning');
        return;
      }
      safeCall('openAnalyzeModal');
    });
  }

  // 채널 내보내기
  const btnExportChannels = qs('#btn-export-channels');
  if (btnExportChannels) {
    btnExportChannels.addEventListener('click', (e) => {
      e.preventDefault();
      safeCall('exportChannels');
    });
  }

  // 채널 가져오기
  const btnImportChannels = qs('#btn-import-channels');
  const fileImportChannels = qs('#file-import-channels');
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
  const sortChannels = qs('#sort-channels');
  if (sortChannels) {
    sortChannels.addEventListener('change', () => safeCall('refreshChannels'));
  }

  const sortMutant = qs('#sort-mutant');
  if (sortMutant) {
    sortMutant.addEventListener('change', () => safeCall('refreshMutant'));
  }

  const sortLatest = qs('#sort-latest');
  if (sortLatest) {
    sortLatest.addEventListener('change', () => safeCall('refreshLatest'));
  }

  // 채널 추가 모달 입력/버튼 바인딩(초기 1회 보장)
  bindChannelAddEvents();
  bindSearchListEvents();

  console.log('이벤트 바인딩 완료');
}

// ============================================================================
// 필수 함수 로딩 대기
// ============================================================================
const REQUIRED_FUNCTIONS = [
  'initDrag',        // common.js에서 제공
  'refreshChannels', // channels.js
  'refreshMutant',   // mutant-videos.js
  'refreshLatest'    // latest-videos.js
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
    // 각 섹션은 자신의 함수만 호출
    safeCall('refreshChannels');
    safeCall('refreshMutant');
    safeCall('refreshLatest');
  } catch (e) {
    console.error('초기 데이터 로드 오류:', e);
  }
}

// ============================================================================
// 앱 초기화
// ============================================================================
async function initializeApp() {
  try {
    bindEvents();

    // 드래그 초기화 (없으면 넘어감)
    safeCall('initDrag');

    const ok = await waitForFunctions(7000);
    if (!ok) {
      // 필수 함수가 일부 없더라도 가능한 부분부터 로드
      console.warn('일부 함수가 준비되지 않았지만 진행합니다.');
    }

    await initialDataLoad();
    console.log('앱 초기화 완료');
  } catch (e) {
    console.error('앱 초기화 오류:', e);
  }
}

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializeApp);

console.log('main.js 로딩 완료');
