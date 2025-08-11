// main.js - 안전한 초기화 버전

document.addEventListener('DOMContentLoaded', () => {
  try {
    // 필수 함수들이 로드되었는지 확인
    if (typeof loadTheme === 'undefined') {
      console.error('loadTheme 함수가 정의되지 않았습니다. ui.js를 확인해주세요.');
      return;
    }
    
    if (typeof initDrag === 'undefined') {
      console.error('initDrag 함수가 정의되지 않았습니다. ui.js를 확인해주세요.');
      return;
    }
    
    // UI 초기화
    loadTheme();
    initDrag();
    
    // Chart.js 로딩 확인
    if (typeof Chart === 'undefined') {
      console.error('Chart.js가 로드되지 않았습니다.');
      toast('차트 라이브러리 로딩 오류가 발생했습니다.');
    } else {
      console.log('Chart.js 버전:', Chart.version);
    }
    
    // Moment.js 확인
    if (typeof moment === 'undefined') {
      console.error('Moment.js가 로드되지 않았습니다.');
    } else {
      console.log('Moment.js 버전:', moment.version);
    }
    
    // 기본 UI 이벤트
    const btnToggleTheme = qs('btn-toggle-theme');
    const btnAnalyze = qs('btn-analyze');
    
    if (btnToggleTheme && typeof toggleTheme === 'function') {
      btnToggleTheme.onclick = toggleTheme;
    }
    
    if (btnAnalyze && typeof openAnalyzeModal === 'function') {
      btnAnalyze.onclick = openAnalyzeModal;
    }
    
    // 채널 관련 이벤트
    const btnExportChannels = qs('btn-export-channels');
    const btnImportChannels = qs('btn-import-channels');
    const fileImportChannels = qs('file-import-channels');
    
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

    // 분석 페이지에서 뒤로가기 처리 (전역 이벤트)
    document.addEventListener('click', (e) => {
      // 뒤로가기 버튼 처리
      if (e.target && e.target.id === 'btn-back-home') {
        e.preventDefault();
        if (typeof showHome === 'function') {
          showHome();
        }
        return;
      }
      
      // 기존 탭/모달 이벤트
      if (e.target && e.target.classList.contains('tab')) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
        e.target.classList.add('active'); 
        const tabPanel = qs(e.target.dataset.tab);
        if (tabPanel) tabPanel.classList.add('active');
      }
      
      if (e.target && e.target.dataset && e.target.dataset.period) {
        document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active'); 
        if (window.state) {
          window.state.currentMutantPeriod = e.target.dataset.period; 
          if (window.state.currentPage) {
            window.state.currentPage.mutant = 1;
          }
        }
        if (typeof refreshAll === 'function') {
          refreshAll('mutant');
        }
      }
    });

    // API 키 모달 이벤트
    const btnApi = qs('btn-api');
    if (btnApi) {
      btnApi.onclick = () => { 
        const box = qs('api-inputs'); 
        if (box) {
          box.innerHTML = ''; 
          for (let i = 0; i < 5; i++) { 
            const apiKey = (window.apiKeys && window.apiKeys[i]) || '';
            box.insertAdjacentHTML('beforeend', `<input class="api-inp" placeholder="API Key ${i + 1}" value="${apiKey}">`);
          } 
          const testResult = qs('api-test-result');
          if (testResult) testResult.textContent = ''; 
          openModal('modal-api');
        }
      };
    }
    
    // 모달 닫기 이벤트
    document.querySelectorAll('.close').forEach(x => {
      x.onclick = e => {
        if (e.target.dataset && e.target.dataset.close && typeof closeModal === 'function') {
          closeModal(e.target.dataset.close);
        }
      };
    });
    
    // API 파일 업로드 이벤트
    const apiFileBtn = qs('api-file-btn');
    const apiFile = qs('api-file');
    
    if (apiFileBtn && apiFile) {
      apiFileBtn.onclick = () => apiFile.click();
    }
    
    if (apiFile) {
      apiFile.onchange = e => { 
        const f = e.target.files[0]; 
        if (!f) return; 
        const r = new FileReader(); 
        r.onload = () => { 
          const keys = r.result.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 5); 
          const box = qs('api-inputs'); 
          if (box) {
            box.innerHTML = ''; 
            for (let i = 0; i < 5; i++) { 
              box.insertAdjacentHTML('beforeend', `<input class="api-inp" placeholder="API Key ${i + 1}" value="${keys[i] || ''}">`);
            } 
            const testResult = qs('api-test-result');
            if (testResult) testResult.textContent = '파일에서 불러왔습니다. [저장]을 눌러 반영하세요.'; 
          }
        }; 
        r.readAsText(f); 
      };
    }
    
    // API 키 저장 이벤트
    const apiSave = qs('api-save');
    if (apiSave && typeof setApiKeys === 'function') {
      apiSave.onclick = () => { 
        const keys = [...document.querySelectorAll('.api-inp')].map(i => i.value.trim()).filter(Boolean); 
        setApiKeys(keys); 
        toast('API 키가 저장되었습니다.'); 
        const testResult = qs('api-test-result');
        if (testResult) testResult.textContent = ''; 
        closeModal('modal-api'); 
        if (typeof refreshAll === 'function') {
          refreshAll();
        }
      };
    }
    
    // API 키 다운로드 이벤트
    const apiDownload = qs('api-download');
    if (apiDownload) {
      apiDownload.onclick = () => { 
        if (!window.apiKeys || !window.apiKeys.length) { 
          toast('저장된 키가 없습니다.'); 
          return; 
        } 
        const blob = new Blob([window.apiKeys.join('\n')], { type: 'text/plain' }); 
        const url = URL.createObjectURL(blob); 
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = 'api_keys.txt'; 
        document.body.appendChild(a); 
        a.click(); 
        a.remove(); 
        URL.revokeObjectURL(url); 
      };
    }
    
    // API 키 테스트 이벤트
    const apiTest = qs('api-test');
    if (apiTest && window.CONFIG) {
      apiTest.onclick = async () => { 
        const keys = [...document.querySelectorAll('.api-inp')].map(i => i.value.trim()).filter(Boolean); 
        const testKeys = keys.length ? keys : (window.apiKeys || []); 
        const testResult = qs('api-test-result');
        
        if (!testKeys.length) { 
          if (testResult) {
            testResult.innerHTML = '<span class="test-bad">저장된 키가 없습니다.</span>'; 
          }
          return; 
        } 
        
        if (testResult) testResult.textContent = 'API 키 테스트 중...'; 
        let ok = false, lastErr = ''; 
        
        for (const k of testKeys) { 
          try { 
            const u = `${window.CONFIG.API_BASE}channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${encodeURIComponent(k)}`; 
            const r = await fetch(u); 
            const j = await r.json(); 
            if (!j.error) { 
              ok = true; 
              break; 
            } 
            lastErr = j.error.message || JSON.stringify(j.error); 
          } catch (e) { 
            lastErr = e.message || String(e); 
          } 
        } 
        
        if (testResult) {
          testResult.innerHTML = ok ? 
            '<span class="test-ok">✓ API 키가 정상적으로 작동합니다!</span>' : 
            `<span class="test-bad">✗ API 키 테스트 실패: ${lastErr}<br><small>Google Cloud Console에서 YouTube Data API v3 활성화 및 리퍼러 설정을 확인해주세요.</small></span>`; 
        }
      };
    }

    // 채널 추가 모달
    const btnAddChannel = qs('btn-add-channel');
    if (btnAddChannel) {
      btnAddChannel.onclick = () => { 
        if (!hasKeys || !hasKeys()) { 
          toast('먼저 API 키를 설정해주세요.'); 
          return; 
        } 
        openModal('modal-add'); 
      };
    }

    // 정렬 변경 이벤트
    const sortChannels = qs('sort-channels');
    const sortMutant = qs('sort-mutant');
    const sortLatest = qs('sort-latest');
    
    if (sortChannels && typeof refreshAll === 'function') {
      sortChannels.onchange = () => {
        if (window.state && window.state.currentPage) {
          window.state.currentPage.channels = 1;
        }
        refreshAll('channels');
      };
    }
    
    if (sortMutant && typeof refreshAll === 'function') {
      sortMutant.onchange = () => {
        if (window.state && window.state.currentPage) {
          window.state.currentPage.mutant = 1;
        }
        refreshAll('mutant');
      };
    }
    
    if (sortLatest && typeof refreshAll === 'function') {
      sortLatest.onchange = () => {
        if (window.state && window.state.currentPage) {
          window.state.currentPage.latest = 1;
        }
        refreshAll('latest');
      };
    }

    // 채널 검색 기능 (안전한 버전)
    setupChannelSearch();
    setupVideoSearch();
    setupUrlAdd();

    // 첫 로드
    if (hasKeys && hasKeys() && typeof refreshAll === 'function') {
      refreshAll();
    } else {
      toast('API 키를 설정해주세요.');
    }
    
    console.log('메인 초기화 완료');
    
  } catch (error) {
    console.error('메인 초기화 오류:', error);
    toast('애플리케이션 초기화 중 오류가 발생했습니다.');
  }
});

// 채널 검색 기능 설정
function setupChannelSearch() {
  const CH_PSIZE = window.CONFIG ? window.CONFIG.PAGINATION.SEARCH_CHANNELS : 4; 
  let chCache = [], chPage = 1;
  
  const daysAgoStr = iso => { 
    if (!iso || typeof moment === 'undefined') return '-'; 
    const d = moment(iso); 
    const diff = moment().diff(d, 'days'); 
    if (diff <= 0) return '오늘'; 
    if (diff === 1) return '1일 전'; 
    return `${diff}일 전`; 
  };
  
  async function renderChPage() {
    const list = qs('ch-results'); 
    if (!list) return;
    
    list.innerHTML = '';
    const sort = (document.getElementById('ch-sort') || {}).value || 'subs';
    const sorted = [...chCache].sort((a, b) => {
      if (sort === 'videos') return (parseInt(b.statistics?.videoCount || '0', 10)) - (parseInt(a.statistics?.videoCount || '0', 10));
      if (sort === 'latest') return new Date(b.latestUploadDate || 0) - new Date(a.latestUploadDate || 0);
      return (parseInt(b.statistics?.subscriberCount || '0', 10)) - (parseInt(a.statistics?.subscriberCount || '0', 10));
    });
    
    const items = sorted.slice((chPage - 1) * CH_PSIZE, chPage * CH_PSIZE);
    if (!items.length) { 
      list.innerHTML = '<div class="muted">결과가 없습니다.</div>'; 
      const pagination = qs('ch-pagination');
      if (pagination) pagination.innerHTML = ''; 
      return; 
    }
    
    items.forEach(ch => {
      const row = document.createElement('div'); 
      row.className = 'result-row';
      row.innerHTML = `
        <a href="https://www.youtube.com/channel/${ch.id}" target="_blank" rel="noopener">
          <img class="r-avatar" src="${ch.snippet.thumbnails?.default?.url || ''}" alt="">
        </a>
        <div>
          <div class="r-title">${ch.snippet.title}</div>
          <div class="r-sub">${ch.snippet.description ? ch.snippet.description.substring(0, 100) + '...' : '설명 없음'}</div>
          <div class="r-sub">구독자: ${fmt(ch.statistics?.subscriberCount || '0')} · 영상: ${fmt(ch.statistics?.videoCount || '0')} · 최신업로드: ${daysAgoStr(ch.latestUploadDate || '')}</div>
        </div>
        <button class="btn" data-add-ch="${ch.id}">추가</button>`;
      
      const addBtn = row.querySelector('[data-add-ch]');
      if (addBtn && typeof addChannelById === 'function') {
        addBtn.onclick = async () => {
          const b = addBtn; 
          const t = b.textContent; 
          b.textContent = '추가 중…'; 
          b.disabled = true;
          try { 
            const ok = await addChannelById(ch.id); 
            if (ok) { 
              b.textContent = '완료!'; 
              b.style.background = '#1db954'; 
              setTimeout(() => {
                if (typeof closeModal === 'function') {
                  closeModal('modal-add');
                }
              }, 800);
            } else { 
              b.textContent = t; 
              b.disabled = false; 
            } 
          } catch (error) { 
            b.textContent = t; 
            b.disabled = false; 
            toast('채널 추가 중 오류'); 
          }
        };
      }
      list.appendChild(row);
    });
    
    const total = Math.ceil(chCache.length / CH_PSIZE); 
    const pg = qs('ch-pagination'); 
    if (pg) {
      pg.innerHTML = ''; 
      if (total > 1) { 
        for (let i = 1; i <= total; i++) { 
          const btn = document.createElement('button'); 
          btn.textContent = i; 
          if (i === chPage) { 
            btn.className = 'active'; 
          } 
          btn.onclick = () => { chPage = i; renderChPage(); }; 
          pg.appendChild(btn);
        } 
      }
    }
  }
  
  async function searchChannels() {
    const queryInput = qs('ch-query');
    if (!queryInput) return;
    
    const q = queryInput.value.trim(); 
    if (!q) { 
      const resultsEl = qs('ch-results');
      if (resultsEl && typeof showError === 'function') {
        showError('ch-results', '검색어를 입력해주세요.'); 
      }
      return; 
    }
    
    const resultsEl = qs('ch-results');
    const paginationEl = qs('ch-pagination');
    
    if (resultsEl) resultsEl.innerHTML = '<div class="muted">검색 중...</div>'; 
    if (paginationEl) paginationEl.innerHTML = '';
    
    try {
      if (typeof yt !== 'function') {
        throw new Error('YouTube API 함수가 로드되지 않았습니다.');
      }
      
      const res = await yt('search', { part: 'snippet', q, type: 'channel', maxResults: 25 });
      if (!res.items?.length) { 
        if (resultsEl) resultsEl.innerHTML = '<div class="muted">검색 결과가 없습니다.</div>'; 
        return; 
      }
      
      const ids = res.items.map(i => i.snippet.channelId).filter(Boolean);
      const details = await yt('channels', { part: 'snippet,statistics,contentDetails', id: ids.join(',') });
      
      const enriched = [];
      for (const it of (details.items || [])) {
        let latest = it.snippet.publishedAt;
        try {
          const upl = it.contentDetails?.relatedPlaylists?.uploads;
          if (upl) { 
            const pl = await yt('playlistItems', { part: 'snippet', playlistId: upl, maxResults: 1 }); 
            if (pl.items?.[0]) latest = pl.items[0].snippet.publishedAt || latest; 
          }
        } catch {}
        enriched.push({ ...it, latestUploadDate: latest });
      }
      
      chCache = enriched; 
      chPage = 1; 
      renderChPage();
    } catch (error) {
      console.error('채널 검색 오류:', error);
      if (resultsEl && typeof showError === 'function') {
        showError('ch-results', '검색 중 오류가 발생했습니다.');
      }
    }
  }
  
  const btnChSearch = qs('btn-ch-search');
  const chQueryInput = qs('ch-query');
  const chSortSelect = document.getElementById('ch-sort');
  
  if (btnChSearch) btnChSearch.onclick = searchChannels; 
  if (chQueryInput) chQueryInput.onkeydown = e => { if (e.key === 'Enter') searchChannels(); }; 
  if (chSortSelect) chSortSelect.onchange = () => renderChPage();
}

// 영상 검색 기능 설정
function setupVideoSearch() {
  const VID_PSIZE = window.CONFIG ? window.CONFIG.PAGINATION.SEARCH_VIDEOS : 4; 
  let vidCache = [], vidPage = 1;
  
  async function renderVidPage() {
    const list = qs('vid-results'); 
    if (!list) return;
    
    list.innerHTML = '';
    const sort = (document.getElementById('vid-sort') || {}).value || 'views';
    const sorted = [...vidCache].sort((a, b) => {
      if (sort === 'subs') return (parseInt(b.__ch?.subscriberCount || '0', 10)) - (parseInt(a.__ch?.subscriberCount || '0', 10));
      if (sort === 'date') return new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt);
      return (parseInt(b.__vid?.viewCount || '0', 10)) - (parseInt(a.__vid?.viewCount || '0', 10));
    });
    
    const items = sorted.slice((vidPage - 1) * VID_PSIZE, vidPage * VID_PSIZE);
    if (!items.length) { 
      list.innerHTML = '<div class="muted">결과가 없습니다.</div>'; 
      const pagination = qs('vid-pagination');
      if (pagination) pagination.innerHTML = ''; 
      return; 
    }
    
    items.forEach(v => {
      const row = document.createElement('div'); 
      row.className = 'result-row';
      row.innerHTML = `
        <a href="https://www.youtube.com/watch?v=${v.id.videoId}" target="_blank" rel="noopener">
          <img class="r-thumb" src="${v.snippet.thumbnails?.default?.url || ''}" alt="">
        </a>
        <div>
          <div class="r-title">${v.snippet.title}</div>
          <div class="r-sub">${v.snippet.channelTitle} · 채널 구독자: ${fmt(v.__ch?.subscriberCount)} · 채널 영상: ${fmt(v.__ch?.videoCount)} · 영상 조회수: ${fmt(v.__vid?.viewCount)} · 업로드: ${typeof moment !== 'undefined' ? moment(v.snippet.publishedAt).format('YYYY-MM-DD') : v.snippet.publishedAt.slice(0, 10)}</div>
        </div>
        <button class="btn" data-add-ch-from-vid="${v.snippet.channelId}">채널 추가</button>`;
      
      const addBtn = row.querySelector('[data-add-ch-from-vid]');
      if (addBtn && typeof addChannelById === 'function') {
        addBtn.onclick = async () => {
          const b = addBtn; 
          const t = b.textContent; 
          b.textContent = '추가 중…'; 
          b.disabled = true;
          try { 
            const ok = await addChannelById(v.snippet.channelId); 
            if (ok) { 
              b.textContent = '완료!'; 
              b.style.background = '#1db954'; 
              setTimeout(() => {
                if (typeof closeModal === 'function') {
                  closeModal('modal-add');
                }
              }, 800);
            } else { 
              b.textContent = t; 
              b.disabled = false; 
            } 
          } catch (error) { 
            b.textContent = t; 
            b.disabled = false; 
            toast('채널 추가 중 오류'); 
          }
        };
      }
      list.appendChild(row);
    });
    
    const total = Math.ceil(vidCache.length / VID_PSIZE); 
    const pg = qs('vid-pagination'); 
    if (pg) {
      pg.innerHTML = ''; 
      if (total > 1) { 
        for (let i = 1; i <= total; i++) { 
          const btn = document.createElement('button'); 
          btn.textContent = i; 
          if (i === vidPage) { 
            btn.className = 'active'; 
          } 
          btn.onclick = () => { vidPage = i; renderVidPage(); }; 
          pg.appendChild(btn);
        } 
      }
    }
  }
  
  async function searchVideos() {
    const queryInput = qs('vid-query');
    if (!queryInput) return;
    
    const q = queryInput.value.trim(); 
    if (!q) return;
    
    const resultsEl = qs('vid-results');
    const paginationEl = qs('vid-pagination');
    
    if (resultsEl) resultsEl.innerHTML = '<div class="muted">검색 중...</div>';
    if (paginationEl) paginationEl.innerHTML = '';
    
    try {
      if (typeof yt !== 'function') {
        throw new Error('YouTube API 함수가 로드되지 않았습니다.');
      }
      
      const res = await yt('search', { part: 'snippet', q, type: 'video', videoDuration: 'long', maxResults: 25 });
      if (!res.items?.length) { 
        if (resultsEl) resultsEl.innerHTML = '<div class="muted">검색 결과가 없습니다.</div>'; 
        return; 
      }
      
      const ids = res.items.map(i => i.id.videoId || i.id).filter(Boolean);
      let stats = { items: [] };
      if (ids.length) {
        try { 
          stats = await yt('videos', { part: 'statistics', id: ids.join(',') }); 
        } catch {}
      }
      
      const chIds = Array.from(new Set(res.items.map(i => i.snippet.channelId).filter(Boolean)));
      let chs = { items: [] };
      if (chIds.length) {
        try { 
          chs = await yt('channels', { part: 'statistics', id: chIds.join(',') }); 
        } catch {}
      }
      
      const statsMap = new Map((stats.items || []).map(it => [it.id, it.statistics || {}]));
      const chMap = new Map((chs.items || []).map(it => [it.id, it.statistics || {}]));
      
      vidCache = res.items.map(it => { 
        return { 
          ...it, 
          __vid: statsMap.get(it.id.videoId || it.id) || {}, 
          __ch: chMap.get(it.snippet.channelId) || {} 
        }; 
      });
      
      vidPage = 1; 
      renderVidPage();
    } catch (error) {
      console.error('영상 검색 오류:', error);
      if (resultsEl && typeof showError === 'function') {
        showError('vid-results', '검색 중 오류가 발생했습니다.');
      }
    }
  }
  
  const btnVidSearch = qs('btn-vid-search');
  const vidQueryInput = qs('vid-query');
  const vidSortSelect = document.getElementById('vid-sort');
  
  if (btnVidSearch) btnVidSearch.onclick = searchVideos; 
  if (vidQueryInput) vidQueryInput.onkeydown = e => { if (e.key === 'Enter') searchVideos(); }; 
  if (vidSortSelect) vidSortSelect.onchange = () => renderVidPage();
}

// URL 직접 추가 기능 설정
function setupUrlAdd() {
  function extractChannelId(url) {
    if (!url) return null; 
    url = url.trim();
    if (/^UC[a-zA-Z0-9_-]{22}$/.test(url)) return url;
    
    let m = url.match(/(?:youtube\.com|youtu\.be)\/channel\/([a-zA-Z0-9_-]+)/); 
    if (m) return m[1];
    
    const h = url.match(/^@([a-zA-Z0-9_-]+)$/) || url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
    if (h) return null;
    
    const v = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (v) return { videoId: v[1] };
    
    const p = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (p) return { playlistId: p[1] };
    
    return null;
  }
  
  const btnUrlAdd = qs('btn-url-add');
  if (btnUrlAdd) {
    btnUrlAdd.onclick = async () => {
      const urlInput = qs('url-input');
      if (!urlInput) return;
      
      const input = urlInput.value.trim(); 
      if (!input) { 
        if (typeof showError === 'function') {
          showError('url-result', '채널 URL 또는 ID를 입력해주세요.'); 
        }
        return; 
      }
      
      let channelRef = extractChannelId(input);
      let channelId = typeof channelRef === 'string' ? channelRef : null;
      
      if (channelRef && channelRef.videoId) {
        try { 
          if (typeof yt === 'function') {
            const vd = await yt('videos', { part: 'snippet', id: channelRef.videoId }); 
            channelId = vd.items?.[0]?.snippet?.channelId || null; 
          }
        } catch {}
      }
      
      if (channelRef && channelRef.playlistId && !channelId) {
        try { 
          if (typeof yt === 'function') {
            const pd = await yt('playlists', { part: 'snippet', id: channelRef.playlistId }); 
            channelId = pd.items?.[0]?.snippet?.channelId || null; 
          }
        } catch {}
      }
      
      if (!channelId) {
        try {
          if (typeof showSuccess === 'function') {
            showSuccess('url-result', '채널을 검색하는 중...');
          }
          if (typeof yt === 'function') {
            const searchRes = await yt('search', { part: 'snippet', q: input.replace(/^@/, ''), type: 'channel', maxResults: 1 });
            if (searchRes.items?.[0]) channelId = searchRes.items[0].snippet.channelId;
            else throw new Error('채널을 찾을 수 없습니다.');
          }
        } catch { 
          if (typeof showError === 'function') {
            showError('url-result', '채널을 찾을 수 없습니다. URL이나 채널명을 확인해주세요.'); 
          }
          return; 
        }
      }
      
      try {
        if (typeof showSuccess === 'function') {
          showSuccess('url-result', '채널을 추가하는 중...');
        }
        if (typeof addChannelById === 'function') {
          const ok = await addChannelById(channelId); 
          if (ok) { 
            if (typeof closeModal === 'function') {
              closeModal('modal-add'); 
            }
            urlInput.value = ''; 
            const urlResult = qs('url-result');
            if (urlResult) urlResult.innerHTML = ''; 
          }
        }
      } catch (e) { 
        if (typeof showError === 'function') {
          showError('url-result', '채널 추가 실패: ' + e.message); 
        }
      }
    };
  }
}
