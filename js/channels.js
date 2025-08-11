// 채널 관리 함수들
async function getAllChannels() { 
  return idbAll('my_channels'); 
}

async function deleteChannel(id) { 
  await idbDel('my_channels', id); 
  await idbDel('insights', id); 
}

function sortChannels(list, mode) {
  if (mode === 'videos') {
    list.sort((a, b) => parseInt(b.videoCount || '0') - parseInt(a.videoCount || '0'));
  } else if (mode === 'latest') {
    list.sort((a, b) => new Date(b.latestUploadDate || 0) - new Date(a.latestUploadDate || 0));
  } else {
    list.sort((a, b) => parseInt(b.subscriberCount || '0') - parseInt(a.subscriberCount || '0'));
  }
}

async function ensureUploadsAndLatest(ch) {
  if (ch.uploadsPlaylistId && ch.latestUploadDate) return ch;
  
  const info = await yt('channels', { part: 'contentDetails', id: ch.id });
  ch.uploadsPlaylistId = info.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || '';
  
  if (ch.uploadsPlaylistId) {
    const pl = await yt('playlistItems', { 
      part: 'snippet', 
      playlistId: ch.uploadsPlaylistId, 
      maxResults: 1 
    });
    if (pl.items && pl.items[0]) {
      ch.latestUploadDate = pl.items[0].snippet.publishedAt;
    }
  }
  
  await idbPut('my_channels', ch); 
  return ch;
}

async function getYesterdaySubCount(ch) {
  const y = moment().subtract(1, 'day').format('YYYY-MM-DD');
  const rec = await idbGet('dailySubs', [ch.id, y]); 
  return rec ? rec.subCount : null;
}

async function updateDailySubSnapshot(ch) {
  const today = moment().format('YYYY-MM-DD');
  const ex = await idbGet('dailySubs', [ch.id, today]);
  if (!ex) {
    await idbPut('dailySubs', {
      channelId: ch.id,
      date: today,
      subCount: parseInt(ch.subscriberCount || '0', 10)
    });
  }
}

async function addChannelById(channelId) {
  if (!channelId) { 
    toast('올바른 채널 ID가 아닙니다.'); 
    return false; 
  }
  
  const exist = await idbGet('my_channels', channelId); 
  if (exist) { 
    toast('이미 등록된 채널입니다.'); 
    return false; 
  }
  
  const ch = await yt('channels', { 
    part: 'snippet,statistics,contentDetails', 
    id: channelId 
  });
  
  const it = ch.items?.[0]; 
  if (!it) throw new Error('채널을 찾을 수 없습니다.');
  
  const uploads = it.contentDetails?.relatedPlaylists?.uploads || ''; 
  let latest = it.snippet.publishedAt; 
  const country = it.snippet.country || '-';
  
  if (uploads) { 
    try { 
      const pl = await yt('playlistItems', { 
        part: 'snippet', 
        playlistId: uploads, 
        maxResults: 1 
      }); 
      if (pl.items && pl.items[0]) {
        latest = pl.items[0].snippet.publishedAt || latest; 
      }
    } catch {} 
  }
  
  const data = { 
    id: it.id,
    title: it.snippet.title,
    thumbnail: it.snippet.thumbnails?.default?.url || '',
    subscriberCount: it.statistics.subscriberCount || '0',
    videoCount: it.statistics.videoCount || '0',
    uploadsPlaylistId: uploads,
    latestUploadDate: latest,
    country 
  };
  
  await idbPut('my_channels', data); 
  toast(`✅ ${data.title} 채널이 등록되었습니다.`); 
  setTimeout(() => refreshAll('channels'), 50); 
  return true;
}

async function refreshChannels() {
  const allChannels = await getAllChannels();
  
  for (const ch of allChannels) {
    await ensureUploadsAndLatest(ch);
    await updateDailySubSnapshot(ch);
  }
  
  sortChannels(allChannels, qs('sort-channels').value);
  
  const itemsPerPage = CONFIG.PAGINATION.CHANNELS;
  const currentPage = state.currentPage.channels;
  const totalItems = allChannels.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedChannels = allChannels.slice(startIndex, endIndex);
  
  qs('channel-count').textContent = allChannels.length;
  const wrap = qs('channel-list');
  
  if (!allChannels.length) { 
    wrap.innerHTML = '<p class="muted">채널을 추가하세요.</p>'; 
    qs('channel-pagination').innerHTML = '';
    return; 
  }
  
  wrap.innerHTML = '';
  
  for (const ch of paginatedChannels) {
    const y = await getYesterdaySubCount(ch);
    const today = parseInt(ch.subscriberCount || '0', 10);
    const diff = y == null ? null : today - y;
    const diffStr = y == null ? '<span class="v" style="color:#888">(전일 정보 없음)</span>'
      : diff > 0 ? `<span class="v" style="color:#1db954">+${fmt(diff)}</span>`
      : diff < 0 ? `<span class="v" style="color:#c4302b">${fmt(diff)}</span>`
      : `<span class="v" style="color:#888">0</span>`;
    
    const el = document.createElement('div');
    el.className = 'channel-card';
    el.innerHTML = `
      <a class="channel-thumb-link" href="https://www.youtube.com/channel/${ch.id}" target="_blank" rel="noopener">
        <img class="channel-thumb" src="${ch.thumbnail || ''}" alt="${ch.title}">
      </a>
      <div class="channel-meta">
        <h3><a class="channel-title-link" href="https://www.youtube.com/channel/${ch.id}" target="_blank" rel="noopener">${ch.title}</a></h3>
        <div class="row">
          <span>구독자: <strong>${fmt(today)}</strong></span>
          <span>영상: <strong>${fmt(ch.videoCount)}</strong></span>
          <span>운영기간: <strong>${ch.firstUploadDate ? moment().diff(moment(ch.firstUploadDate), 'years') + '년 ' + (moment().diff(moment(ch.firstUploadDate), 'months') % 12) + '개월' : '-'}</strong></span>
        </div>
        <div class="latest">최신 업로드: ${ch.latestUploadDate ? moment(ch.latestUploadDate).format('YYYY-MM-DD') : '-'} · 최초 업로드: ${ch.firstUploadDate ? moment(ch.firstUploadDate).format('YYYY-MM-DD') : '-'}</div>
      </div>
      <div class="channel-actions">
        <button class="btn-danger" data-del="${ch.id}">삭제</button>
      </div>
      <div class="channel-insights">
        <div class="insights" id="ins-${ch.id}">
          <div><span class="k">전일대비</span> <span class="v">${diffStr}</span></div>
          <div><span class="k">평균조회</span> <span class="v">-</span></div>
          <div><span class="k">좋아요율</span> <span class="v">-</span></div>
          <div><span class="k">업로드빈도</span> <span class="v">-</span></div>
          <div><span class="k">평균길이</span> <span class="v">-</span></div>
          <div><span class="k">롱/숏</span> <span class="v">-</span></div>
          <div><span class="k">국가</span> <span class="v">${ch.country || '-'}</span></div>
          <div><span class="k">최다요일</span> <span class="v">-</span></div>
          <div style="grid-column:1/-1"><span class="k">카테고리</span> <span class="v">-</span></div>
        </div>
      </div>`;
    
    el.querySelector('[data-del]').onclick = async () => { 
      if (confirm('채널을 삭제할까요?')) { 
        await deleteChannel(ch.id); 
        refreshAll('channels'); 
      } 
    };
    
    wrap.appendChild(el);
  }
  
  // 채널 페이지네이션
  renderPagination('channel-pagination', currentPage, totalItems, itemsPerPage, (page) => {
    state.currentPage.channels = page;
    refreshChannels();
  });
}

// 채널 내보내기/가져오기
async function exportChannels() {
  const list = await getAllChannels();
  const data = { 
    version: 1, 
    exportedAt: new Date().toISOString(), 
    channels: list.map(c => ({ id: c.id, title: c.title })) 
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'channels-export.json';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
  toast('채널 목록을 다운로드했습니다.');
}

async function importChannelsFromFile(file) {
  try {
    const txt = await file.text();
    const parsed = JSON.parse(txt);
    
    let ids = [];
    if (Array.isArray(parsed)) {
      ids = parsed.map(x => (typeof x === 'string' ? x : x.id)).filter(Boolean);
    } else if (parsed && Array.isArray(parsed.channels)) {
      ids = parsed.channels.map(x => (typeof x === 'string' ? x : x.id)).filter(Boolean);
    } else {
      ids = Object.values(parsed).map(x => (typeof x === 'string' ? x : x.id)).filter(Boolean);
    }
    
    ids = Array.from(new Set(ids));
    if (!ids.length) { 
      toast('가져올 채널 ID가 없습니다.'); 
      return; 
    }

    const exist = await getAllChannels();
    const existIds = new Set(exist.map(c => c.id));
    const toAdd = ids.filter(id => !existIds.has(id));

    let ok = 0, fail = 0;
    for (const id of toAdd) {
      try {
        await addChannelById(id);
        ok++;
      } catch (e) {
        console.error('채널 추가 실패', id, e);
        fail++;
      }
    }
    
    toast(`가져오기 완료: ${ok}개 추가${fail ? `, 실패 ${fail}개` : ''} (중복 제외)`);
    refreshAll('channels');
  } catch (e) {
    console.error(e);
    toast('가져오는 중 오류가 발생했습니다.');
  }
}
