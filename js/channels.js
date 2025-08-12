// YouTube 채널 모니터 - 채널 관리 섹션
console.log('channels.js 로딩 시작');

// ============================================================================
// 채널 관리 핵심 함수들
// ============================================================================

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
    // 삭제 후 새로고침 (최신 실행만 반영되도록 토큰 사용)
    refreshChannels();
  } catch (e) {
    console.error('채널 삭제 실패:', e);
    toast('채널 삭제 실패: ' + (e.message || e), 'error');
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

// ============================================================================
// 채널 추가 기능
// ============================================================================

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

    // 썸네일 안전 선택 (high -> medium -> default)
    const th = channelData.snippet.thumbnails || {};
    const thumbnail =
      th.high?.url || th.medium?.url || th.default?.url || '';

    const data = {
      id: channelData.id,
      title: channelData.snippet.title,
      thumbnail, // 고품질 우선 저장
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
    setTimeout(() => refreshChannels(), 50);

    return true;
  } catch (e) {
    console.error('채널 추가 실패:', e);
    toast('채널 추가 실패: ' + e.message, 'error');
    return false;
  }
}

// ============================================================================
// 채널 목록 렌더링 (동시 실행 방지 토큰 방식)
// ============================================================================

// 최신 실행 토큰(가장 마지막으로 시작된 refresh만 DOM 적용)
window.__channelsRefreshToken = window.__channelsRefreshToken || 0;

// 채널 목록 새로고침
async function refreshChannels() {
  console.log('채널 목록 새로고침 시작');

  // 새 실행 토큰 발급
  const myToken = ++window.__channelsRefreshToken;

  try {
    const allChannels = await getAllChannels();

    // 일일 스냅샷 업데이트 (비차단)
    for (const ch of allChannels) {
      // 토큰이 변경되었다면 중단 (뒤에 시작한 실행이 있음)
      if (myToken !== window.__channelsRefreshToken) return;
      await updateDailySubSnapshot(ch);
    }

    // 정렬 방식 결정
    const sortSelect = qs('#sort-channels');
    const sortMode = sortSelect?.value || 'subscribers';
    sortChannels(allChannels, sortMode);

    // 채널 카운트 업데이트 (토큰 확인)
    if (myToken !== window.__channelsRefreshToken) return;
    const channelCountEl = qs('#channel-count');
    if (channelCountEl) {
      channelCountEl.textContent = allChannels.length.toString();
    }

    // 채널 리스트 컨테이너
    const wrap = qs('#channel-list');
    if (!wrap) {
      console.error('channel-list 요소를 찾을 수 없음');
      return;
    }

    // 비어있을 때
    if (!allChannels.length) {
      if (myToken !== window.__channelsRefreshToken) return;
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📺</div>
          <p class="muted">채널을 추가하여 시작하세요</p>
          <button class="btn btn-primary" onclick="document.getElementById('btn-add-channel').click()">첫 채널 추가하기</button>
        </div>
      `;
      return;
    }

    // ----------- 여기서부터 HTML을 모두 구성한 뒤 한 번에 교체 -----------
    let html = '';

    for (const ch of allChannels) {
      // 토큰 변경되면 즉시 중단
      if (myToken !== window.__channelsRefreshToken) return;

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

      const chThumb = (ch.thumbnail || '').trim();
      const safeThumb = chThumb || `https://i.ytimg.com/vi/${(ch.id || '').replace(/^UC/, '')}/mqdefault.jpg`;

      html += `
        <div class="channel-card">
          <a href="https://www.youtube.com/channel/${ch.id}" target="_blank" style="text-decoration: none;">
            <img src="${safeThumb}" alt="${ch.title}" 
                 onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiByeD0iMTIiIGZpbGw9IiNlMGUwZTAiLz48L3N2Zz4=';" 
                 style="width: 72px; height: 72px; border-radius: 8px; object-fit: cover;">
          </a>

          <div style="flex: 1;">
            <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
              <a href="https://www.youtube.com/channel/${ch.id}" target="_blank" style="text-decoration:none;color:inherit;">
                <div class="ch-title" style="font-weight:800;margin-bottom:4px;">${ch.title}</div>
              </a>
              <button class="btn btn-danger" data-del="${ch.id}" title="채널 삭제">삭제</button>
            </div>

            <div class="ch-sub" style="color:var(--muted);font-size:14px;">
              구독자: <b>${fmt(ch.subscriberCount)}</b> &nbsp; 영상수: <b>${fmt(ch.videoCount)}</b>
            </div>
            <div class="ch-meta" style="margin-top:8px;display:grid;grid-template-columns:1fr 120px;gap:8px;align-items:center;">
              <div class="stat-box" style="background:var(--glass-bg);padding:8px 10px;border-radius:8px;border:1px solid var(--border);font-size:13px;">
                <div style="font-weight:700;">전일대비</div>
                <div>${diffStr}</div>
              </div>
              <div class="stat-box" style="background:var(--glass-bg);padding:8px 10px;border-radius:8px;border:1px solid var(--border);font-size:13px;">
                <div style="font-weight:700;">국가</div>
                <div>${(ch.country || 'KR')}</div>
              </div>
            </div>
            <div style="margin-top:8px;font-size:12px;color:var(--muted);">
              최신 업로드: ${ch.latestUploadDate ? moment(ch.latestUploadDate).format('YYYY-MM-DD') : '-'}
            </div>
          </div>
        </div>
      `;
    }

    // 렌더 직전 토큰 확인 후 한번에 교체
    if (myToken !== window.__channelsRefreshToken) return;
    wrap.innerHTML = html;

    // 삭제 버튼 이벤트 바인딩
    qsa('[data-del]', wrap).forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const id = btn.getAttribute('data-del');
        if (!id) return;
        if (!confirm('정말 삭제하시겠어요?')) return;
        await deleteChannel(id);
      });
    });

  } catch (e) {
    console.error('채널 목록 새로고침 실패:', e);
    const wrap = qs('#channel-list');
    if (wrap) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <p class="muted">채널 목록을 불러오는 중 오류가 발생했습니다.</p>
        </div>
      `;
    }
  }
}

// 전역 노출(다른 파일에서 사용)
window.getAllChannels = getAllChannels;
window.deleteChannel = deleteChannel;
window.refreshChannels = refreshChannels;
window.addChannelById = addChannelById;

console.log('channels.js 로딩 완료');
