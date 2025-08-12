// YouTube 채널 모니터 - 채널 관리
console.log('channels.js 로딩 시작');

// 모든 채널 가져오기
async function getAllChannels() {
  try {
    const channels = await idbAll('my_channels');
    console.log('채널 목록 조회:', channels.length + '개');
    return channels;
  } catch (e) {
    console.error('채널 목록 조회 실패:', e);
    return [];
  }
}

// 채널 삭제
async function deleteChannel(id) {
  try {
    console.log('채널 삭제 시작:', id);
    await idbDel('my_channels', id);
    await idbDel('insights', id);
    console.log('채널 삭제 완료:', id);
  } catch (e) {
    console.error('채널 삭제 실패:', e);
    throw e;
  }
}

// 채널 정렬
function sortChannels(list, mode) {
  console.log('채널 정렬:', mode);
  if (mode === 'videos') {
    list.sort((a, b) => parseInt(b.videoCount || '0') - parseInt(a.videoCount || '0'));
  } else if (mode === 'latest') {
    list.sort((a, b) => new Date(b.latestUploadDate || 0) - new Date(a.latestUploadDate || 0));
  } else {
    list.sort((a, b) => parseInt(b.subscriberCount || '0') - parseInt(a.subscriberCount || '0'));
  }
}

// 전일 구독자 수 가져오기
async function getYesterdaySubCount(ch) {
  try {
    const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');
    const record = await idbGet('dailySubs', [ch.id, yesterday]);
    return record ? record.subCount : null;
  } catch (e) {
    console.error('전일 구독자 수 조회 실패:', e);
    return null;
  }
}

// 일일 구독자 스냅샷 업데이트
async function updateDailySubSnapshot(ch) {
  try {
    const today = moment().format('YYYY-MM-DD');
    const existing = await idbGet('dailySubs', [ch.id, today]);
    if (!existing) {
      await idbPut('dailySubs', {
        channelId: ch.id,
        date: today,
        subCount: parseInt(ch.subscriberCount || '0', 10)
      });
      console.log('일일 구독자 스냅샷 저장:', ch.title);
    }
  } catch (e) {
    console.error('일일 구독자 스냅샷 저장 실패:', e);
  }
}

// 채널 ID로 추가
async function addChannelById(channelId) {
  if (!channelId) {
    toast('올바른 채널 ID가 아닙니다.', 'error');
    return false;
  }

  console.log('채널 추가 시작:', channelId);

  try {
    const existing = await idbGet('my_channels', channelId);
    if (existing) {
      toast('이미 등록된 채널입니다.', 'warning');
      return false;
    }

    const channelResponse = await yt('channels', {
      part: 'snippet,statistics,contentDetails',
      id: channelId
    });

    const channelData = channelResponse.items?.[0];
    if (!channelData) {
      throw new Error('채널을 찾을 수 없습니다.');
    }

    const uploads = channelData.contentDetails?.relatedPlaylists?.uploads || '';
    let latestUpload = channelData.snippet.publishedAt;

    // 최신 업로드 날짜 가져오기
    if (uploads) {
      try {
        const playlistResponse = await yt('playlistItems', {
          part: 'snippet',
          playlistId: uploads,
          maxResults: 1
        });
        if (playlistResponse.items && playlistResponse.items[0]) {
          latestUpload = playlistResponse.items[0].snippet.publishedAt || latestUpload;
        }
      } catch (e) {
        console.warn('최신 업로드 날짜 조회 실패:', e);
      }
    }

    const data = {
      id: channelData.id,
      title: channelData.snippet.title,
      thumbnail: channelData.snippet.thumbnails?.default?.url || '',
      subscriberCount: channelData.statistics.subscriberCount || '0',
      videoCount: channelData.statistics.videoCount || '0',
      uploadsPlaylistId: uploads,
      latestUploadDate: latestUpload,
      country: channelData.snippet.country || '-'
    };

    await idbPut('my_channels', data);
    console.log('채널 추가 완료:', data.title);
    
    toast(`✅ ${data.title} 채널이 등록되었습니다.`, 'success');
    
    // 채널 목록 새로고침
    setTimeout(() => refreshChannels(), 100);
    
    return true;
  } catch (e) {
    console.error('채널 추가 실패:', e);
    toast('채널 추가 실패: ' + e.message, 'error');
    return false;
  }
}

// 채널 목록 새로고침
async function refreshChannels() {
  console.log('채널 목록 새로고침 시작');
  
  try {
    const allChannels = await getAllChannels();
    
    // 일일 스냅샷 업데이트
    for (const ch of allChannels) {
      await updateDailySubSnapshot(ch);
    }

    // 정렬 방식 결정
    const sortSelect = qs('#sort-channels');
    const sortMode = sortSelect?.value || 'subscribers';
    sortChannels(allChannels, sortMode);

    // 채널 카운트 업데이트
    const channelCountEl = qs('#channel-count');
    if (channelCountEl) {
      channelCountEl.textContent = allChannels.length.toString();
    }

    // 채널 리스트 렌더링
    const wrap = qs('#channel-list');
    if (!wrap) {
      console.error('channel-list 요소를 찾을 수 없음');
      return;
    }

    if (!allChannels.length) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📺</div>
          <p class="muted">채널을 추가하여 시작하세요</p>
          <button class="btn btn-primary" onclick="document.getElementById('btn-add-channel').click()">첫 채널 추가하기</button>
        </div>
      `;
      return;
    }

    wrap.innerHTML = '';

    for (const ch of allChannels) {
      const yesterday = await getYesterdaySubCount(ch);
      const today = parseInt(ch.subscriberCount || '0', 10);
      const diff = yesterday == null ? null : today - yesterday;
      
      let diffStr = '';
      if (yesterday == null) {
        diffStr = '<span class="v neutral">(전일 정보 없음)</span>';
      } else if (diff > 0) {
        diffStr = `<span class="v positive">+${fmt(diff)}</span>`;
      } else if (diff < 0) {
        diffStr = `<span class="v negative">${fmt(diff)}</span>`;
      } else {
        diffStr = `<span class="v neutral">0</span>`;
      }

      const channelCard = document.createElement('div');
      channelCard.className = 'channel-card';
      channelCard.innerHTML = `
        <a href="https://www.youtube.com/channel/${ch.id}" target="_blank" style="text-decoration: none;">
          <img class="channel-thumb" src="${ch.thumbnail || ''}" alt="${ch.title}" 
               onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNlMGUwZTAiLz4KPHN2ZyB4PSIxOCIgeT0iMTgiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyUzYuNDggMjIgMTIgMjJTMjIgMTcuNTIgMjIgMTJTMTcuNTIgMiAxMiAyWiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4K'">
        </a>
        <div class="channel-meta">
          <h3><a href="https://www.youtube.com/channel/${ch.id}" target="_blank">${ch.title}</a></h3>
          <div class="row">
            <span>구독자: <strong>${fmt(today)}</strong></span>
            <span>영상: <strong>${fmt(ch.videoCount)}</strong></span>
          </div>
          <div class="latest">최신 업로드: ${ch.latestUploadDate ? moment(ch.latestUploadDate).format('YYYY-MM-DD') : '-'}</div>
          <div class="channel-insights">
            <div class="insights">
              <div><span class="k">전일대비</span> ${diffStr}</div>
              <div><span class="k">국가</span> <span class="v">${ch.country || '-'}</span></div>
            </div>
          </div>
        </div>
        <div class="channel-actions">
          <button class="btn-danger" data-channel-id="${ch.id}">삭제</button>
        </div>
      `;

      // 삭제 버튼 이벤트
      const deleteBtn = channelCard.querySelector('.btn-danger');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (confirm(`'${ch.title}' 채널을 삭제하시겠습니까?`)) {
            try {
              await deleteChannel(ch.id);
              toast('채널이 삭제되었습니다.', 'success');
              refreshChannels();
            } catch (e) {
              toast('채널 삭제 중 오류가 발생했습니다.', 'error');
            }
          }
        });
      }

      wrap.appendChild(channelCard);
    }

    console.log('채널 목록 새로고침 완료');
    
  } catch (error) {
    console.error('채널 목록 새로고침 실패:', error);
    toast('채널 목록을 불러오는 중 오류가 발생했습니다.', 'error');
  }
}

// 채널 내보내기
async function exportChannels() {
  try {
    const channels = await getAllChannels();
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      channels: channels.map(c => ({ id: c.id, title: c.title }))
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
    
    toast('채널 목록을 다운로드했습니다.', 'success');
    console.log('채널 내보내기 완료');
  } catch (e) {
    console.error('채널 내보내기 실패:', e);
    toast('채널 내보내기 중 오류가 발생했습니다.', 'error');
  }
}

// 채널 가져오기
async function importChannelsFromFile(file) {
  try {
    console.log('채널 가져오기 시작');
    const text = await file.text();
    const parsed = JSON.parse(text);

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
      toast('가져올 채널 ID가 없습니다.', 'warning');
      return;
    }

    const existing = await getAllChannels();
    const existingIds = new Set(existing.map(c => c.id));
    const toAdd = ids.filter(id => !existingIds.has(id));

    if (!toAdd.length) {
      toast('모든 채널이 이미 등록되어 있습니다.', 'info');
      return;
    }

    let success = 0, failed = 0;
    for (const id of toAdd) {
      try {
        await addChannelById(id);
        success++;
      } catch (e) {
        console.error('채널 추가 실패:', id, e);
        failed++;
      }
    }

    toast(`가져오기 완료: ${success}개 추가${failed ? `, 실패 ${failed}개` : ''} (중복 제외)`, 'success');
    refreshChannels();
    
  } catch (e) {
    console.error('채널 가져오기 실패:', e);
    toast('파일을 읽는 중 오류가 발생했습니다.', 'error');
  }
}

// 전역으로 노출
window.getAllChannels = getAllChannels;
window.deleteChannel = deleteChannel;
window.addChannelById = addChannelById;
window.refreshChannels = refreshChannels;
window.exportChannels = exportChannels;
window.importChannelsFromFile = importChannelsFromFile;

console.log('channels.js 로딩 완료');