// 메인 이벤트 리스너 및 초기화
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  initDrag();
  
  // 기본 UI 이벤트
  qs('btn-toggle-theme').onclick = toggleTheme;
  qs('btn-analyze').onclick = openAnalyzeModal;
  
  // 채널 관련 이벤트
  if (qs('btn-export-channels')) qs('btn-export-channels').onclick = exportChannels;
  if (qs('btn-import-channels')) qs('btn-import-channels').onclick = () => qs('file-import-channels').click();
  if (qs('file-import-channels')) {
    qs('file-import-channels').onchange = (e) => { 
      const f = e.target.files[0]; 
      if (f) importChannelsFromFile(f); 
      e.target.value = ''; 
    };
  }

  // API 키 모달 이벤트
  qs('btn-api').onclick = () => { 
    const box = qs('api-inputs'); 
    box.innerHTML = ''; 
    for (let i = 0; i < 5; i++) { 
      box.insertAdjacentHTML('beforeend', `<input class="api-inp" placeholder="API Key ${i + 1}" value="${apiKeys[i] || ''}">`);
    } 
    qs('api-test-result').textContent = ''; 
    openModal('modal-api'); 
  };
  
  document.querySelectorAll('.close').forEach(x => x.onclick = e => closeModal(e.target.dataset.close));
  
  qs('api-file-btn').onclick = () => qs('api-file').click();
  qs('api-file').onchange = e => { 
    const f = e.target.files[0]; 
    if (!f) return; 
    const r = new FileReader(); 
    r.onload = () => { 
      const keys = r.result.split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, 5); 
      const box = qs('api-inputs'); 
      box.innerHTML = ''; 
      for (let i = 0; i < 5; i++) { 
        box.insertAdjacentHTML('beforeend', `<input class="api-inp" placeholder="API Key ${i + 1}" value="${keys[i] || ''}">`);
      } 
      qs('api-test-result').textContent = '파일에서 불러왔습니다. [저장]을 눌러 반영하세요.'; 
    }; 
    r.readAsText(f); 
  };
  
  qs('api-save').onclick = () => { 
    const keys = [...document.querySelectorAll('.api-inp')].map(i => i.value.trim()).filter(Boolean); 
    setApiKeys(keys); 
    toast('API 키가 저장되었습니다.'); 
    qs('api-test-result').textContent = ''; 
    closeModal('modal-api'); 
    refreshAll(); 
  };
  
  qs('api-download').onclick = () => { 
    if (!apiKeys.length) { 
      toast('저장된 키가 없습니다.'); 
      return; 
    } 
    const blob = new Blob([apiKeys.join('\n')], { type: 'text/plain' }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = 'api_keys.txt'; 
    document.body.appendChild(a); 
    a.click(); 
    a.remove(); 
    URL.revokeObjectURL(url); 
  };
  
  qs('api-test').onclick = async () => { 
    const keys = [...document.querySelectorAll('.api-inp')].map(i => i.value.trim()).filter(Boolean); 
    const testKeys = keys.length ? keys : apiKeys; 
    if (!testKeys.length) { 
      qs('api-test-result').innerHTML = '<span class="test-bad">저장된 키가 없습니다.</span>'; 
      return; 
    } 
    qs('api-test-result').textContent = 'API 키 테스트 중...'; 
    let ok = false, lastErr = ''; 
    for (const k of testKeys) { 
      try { 
        const u = `${CONFIG.API_BASE}channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${encodeURIComponent(k)}`; 
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
    qs('api-test-result').innerHTML = ok ? 
      '<span class="test-ok">✓ API 키가 정상적으로 작동합니다!</span>' : 
      `<span class="test-bad">✗ API 키 테스트 실패: ${lastErr}<br><small>Google Cloud Console에서 YouTube Data API v3 활성화 및 리퍼러 설정을 확인해주세요.</small></span>`; 
  };

  // 채널 추가 모달
  qs('btn-add-channel').onclick = () => { 
    if (!hasKeys()) { 
      toast('먼저 API 키를 설정해주세요.'); 
      return; 
    } 
    openModal('modal-add'); 
  };

  // 정렬 변경 이벤트
  qs('sort-channels').onchange = () => {
    state.currentPage.channels = 1;
    refreshAll('channels');
  };
  qs('sort-mutant').onchange = () => {
    state.currentPage.mutant = 1;
    refreshAll('mutant');
  };
  qs('sort-latest').onchange = () => {
    state.currentPage.latest = 1;
    refreshAll('latest');
  };

  // 탭/모달 이벤트
  document.addEventListener('click', e => {
    if (e.target.classList.contains('tab')) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active'); 
      qs(e.target.dataset.tab).classList.add('active');
    }
    
    if (e.target.dataset.period) {
      document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active'); 
      state.currentMutantPeriod = e.target.dataset.period; 
      state.currentPage.mutant = 1;
      refreshAll('mutant');
    }
  });

  // 채널 검색 기능
  const CH_PSIZE = CONFIG.PAGINATION.SEARCH_CHANNELS; 
  let chCache = [], chPage = 1;
  
  const daysAgoStr = iso => { 
    if (!iso) return '-'; 
    const d = moment(iso); 
    const diff = moment().diff(d, 'days'); 
    if (diff <= 0) return '오늘'; 
    if (diff === 1) return '1일 전'; 
    return `${diff}일 전`; 
  };
  
  async function renderChPage() {
    const list = qs('ch-results'); 
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
      qs('ch-pagination').innerHTML = ''; 
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
      
      row.querySelector('[data-add-ch]').onclick = async () => {
        const b = row.querySelector('[data-add-ch]'); 
        const t = b.textContent; 
        b.textContent = '추가 중…'; 
        b.disabled = true;
        try { 
          const ok = await addChannelById(ch.id); 
          if (ok) { 
            b.textContent = '완료!'; 
            b.style.background = '#1db954'; 
            setTimeout(() => closeModal('modal-add'), 800);
          } else { 
            b.textContent = t; 
            b.disabled = false; 
          } 
        } catch { 
          b.textContent = t; 
          b.disabled = false; 
          toast('채널 추가 중 오류'); 
        }
      };
      list.appendChild(row);
    });
    
    const total = Math.ceil(chCache.length / CH_PSIZE); 
    const pg = qs('ch-pagination'); 
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
  
  async function searchChannels() {
    const q = qs('ch-query').value.trim(); 
    if (!q) { 
      showError('ch-results', '검색어를 입력해주세요.'); 
      return; 
    }
    qs('ch-results').innerHTML = '<div class="muted">검색 중...</div>'; 
    qs('ch-pagination').innerHTML = '';
    
    const res = await yt('search', { part: 'snippet', q, type: 'channel', maxResults: 25 });
    if (!res.items?.length) { 
      qs('ch-results').innerHTML = '<div class="muted">검색 결과가 없습니다.</div>'; 
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
  }
  
  qs('btn-ch-search').onclick = searchChannels; 
  qs('ch-query').onkeydown = e => { if (e.key === 'Enter') searchChannels(); }; 
  (document.getElementById('ch-sort') || {}).onchange = () => renderChPage();

  // 영상 검색(롱폼)
  const VID_PSIZE = CONFIG.PAGINATION.SEARCH_VIDEOS; 
  let vidCache = [], vidPage = 1;
  
  async function renderVidPage() {
    const list = qs('vid-results'); 
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
      qs('vid-pagination').innerHTML = ''; 
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
          <div class="r-sub">${v.snippet.channelTitle} · 채널 구독자: ${fmt(v.__ch?.subscriberCount)} · 채널 영상: ${fmt(v.__ch?.videoCount)} · 영상 조회수: ${fmt(v.__vid?.viewCount)} · 업로드: ${moment(v.snippet.publishedAt).format('YYYY-MM-DD')}</div>
        </div>
        <button class="btn" data-add-ch-from-vid="${v.snippet.channelId}">채널 추가</button>`;
      
      row.querySelector('[data-add-ch-from-vid]').onclick = async () => {
        const b = row.querySelector('[data-add-ch-from-vid]'); 
        const t = b.textContent; 
        b.textContent = '추가 중…'; 
        b.disabled = true;
        try { 
          const ok = await addChannelById(v.snippet.channelId); 
          if (ok) { 
            b.textContent = '완료!'; 
            b.style.background = '#1db954'; 
            setTimeout(() => closeModal('modal-add'), 800);
          } else { 
            b.textContent = t; 
            b.disabled = false; 
          } 
        } catch { 
          b.textContent = t; 
          b.disabled = false; 
          toast('채널 추가 중 오류'); 
        }
      };
      list.appendChild(row);
    });
    
    const total = Math.ceil(vidCache.length / VID_PSIZE); 
    const pg = qs('vid-pagination'); 
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
  
  async function searchVideos() {
    const q = qs('vid-query').value.trim(); 
    if (!q) return;
    
    const res = await yt('search', { part: 'snippet', q, type: 'video', videoDuration: 'long', maxResults: 25 });
    if (!res.items?.length) { 
      qs('vid-results').innerHTML = '<div class="muted">검색 결과가 없습니다.</div>'; 
      qs('vid-pagination').innerHTML = ''; 
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
  }
  
  qs('btn-vid-search').onclick = searchVideos; 
  qs('vid-query').onkeydown = e => { if (e.key === 'Enter') searchVideos(); }; 
  (document.getElementById('vid-sort') || {}).onchange = () => renderVidPage();

  // URL 직접 추가
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
  
  qs('btn-url-add').onclick = async () => {
    const input = qs('url-input').value.trim(); 
    if (!input) { 
      showError('url-result', '채널 URL 또는 ID를 입력해주세요.'); 
      return; 
    }
    
    let channelRef = extractChannelId(input);
    let channelId = typeof channelRef === 'string' ? channelRef : null;
    
    if (channelRef && channelRef.videoId) {
      try { 
        const vd = await yt('videos', { part: 'snippet', id: channelRef.videoId }); 
        channelId = vd.items?.[0]?.snippet?.channelId || null; 
      } catch {}
    }
    
    if (channelRef && channelRef.playlistId && !channelId) {
      try { 
        const pd = await yt('playlists', { part: 'snippet', id: channelRef.playlistId }); 
        channelId = pd.items?.[0]?.snippet?.channelId || null; 
      } catch {}
    }
    
    if (!channelId) {
      try {
        showSuccess('url-result', '채널을 검색하는 중...');
        const searchRes = await yt('search', { part: 'snippet', q: input.replace(/^@/, ''), type: 'channel', maxResults: 1 });
        if (searchRes.items?.[0]) channelId = searchRes.items[0].snippet.channelId;
        else throw new Error('채널을 찾을 수 없습니다.');
      } catch { 
        showError('url-result', '채널을 찾을 수 없습니다. URL이나 채널명을 확인해주세요.'); 
        return; 
      }
    }
    
    try {
      showSuccess('url-result', '채널을 추가하는 중...');
      const ok = await addChannelById(channelId); 
      if (ok) { 
        closeModal('modal-add'); 
        qs('url-input').value = ''; 
        qs('url-result').innerHTML = ''; 
      }
    } catch (e) { 
      showError('url-result', '채널 추가 실패: ' + e.message); 
    }
  };

  // 첫 로드
  if (hasKeys()) refreshAll(); 
  else toast('API 키를 설정해주세요.');
});
