// 돌연변이 영상 섹션 전용 관리
console.log('mutant-videos.js 로딩 시작');

// 돌연변이 영상 설정
const MUTANT_CONFIG = {
  THRESHOLD: 2.0,           // 돌연변이 지수 임계값
  MAX_VIDEOS_PER_CHANNEL: 50,  // 채널당 최대 영상 수
  MIN_DURATION: 180,        // 최소 영상 길이 (초)
  PAGINATION_SIZE: 5        // 페이지당 영상 수
};

// 돌연변이 영상 새로고침
async function refreshMutant() {
  console.log('돌연변이 영상 새로고침 시작');
  
  const listEl = qs('#mutant-list');
  if (!listEl) {
    console.error('mutant-list 요소를 찾을 수 없음');
    return;
  }
  
  // 로딩 상태 표시
  showMutantLoading();
  
  try {
    const channels = await getAllChannels();
    console.log('분석할 채널 수:', channels.length);
    
    if (!channels.length) {
      showMutantEmpty();
      return;
    }

    const videos = await collectMutantVideos(channels);
    console.log('총 돌연변이 영상 수:', videos.length);
    
    // 정렬 적용
    const sortMode = getMutantSortMode();
    sortMutantVideos(videos, sortMode);
    
    // 렌더링
    renderMutantVideos(videos);
    
  } catch (error) {
    console.error('돌연변이 영상 새로고침 실패:', error);
    showMutantError(error);
  }
}

// 돌연변이 영상 수집
async function collectMutantVideos(channels) {
  const videos = [];
  const dateFilter = getMutantDateFilter();
  
  for (const channel of channels) {
    console.log('채널 분석 시작:', channel.title);
    
    try {
      const channelVideos = await analyzeMutantVideosForChannel(channel, dateFilter);
      videos.push(...channelVideos);
    } catch (e) {
      console.error(`채널 ${channel.title} 분석 실패:`, e);
    }
  }
  
  return videos;
}

// 개별 채널의 돌연변이 영상 분석
async function analyzeMutantVideosForChannel(channel, dateFilter) {
  // uploadsPlaylistId 확인 및 업데이트
  let uploadsPlaylistId = await ensureUploadsPlaylistId(channel);
  if (!uploadsPlaylistId) {
    console.log(`${channel.title}: uploadsPlaylistId를 찾을 수 없음`);
    return [];
  }
  
  const videoIds = await collectVideoIds(uploadsPlaylistId, dateFilter);
  console.log(`${channel.title}: ${videoIds.length}개 영상 ID 수집`);
  
  const mutantVideos = await analyzeVideosForMutants(videoIds, channel);
  console.log(`${channel.title}: ${mutantVideos.length}개 돌연변이 영상 발견`);
  
  return mutantVideos;
}

// uploadsPlaylistId 확인 및 업데이트
async function ensureUploadsPlaylistId(channel) {
  if (channel.uploadsPlaylistId) {
    return channel.uploadsPlaylistId;
  }
  
  try {
    const channelInfo = await window.yt('channels', {
      part: 'contentDetails',
      id: channel.id
    });
    
    const uploadsPlaylistId = channelInfo.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (uploadsPlaylistId) {
      channel.uploadsPlaylistId = uploadsPlaylistId;
      await idbPut('my_channels', channel);
      console.log(`${channel.title}: uploadsPlaylistId 업데이트됨`);
      return uploadsPlaylistId;
    }
  } catch (e) {
    console.error(`${channel.title}: 채널 정보 업데이트 실패`, e);
  }
  
  return null;
}

// 비디오 ID 수집
async function collectVideoIds(uploadsPlaylistId, dateFilter) {
  const videoIds = [];
  let nextPageToken = null;
  let fetchCount = 0;
  const maxFetches = 2; // API 호출 제한
  
  while (videoIds.length < MUTANT_CONFIG.MAX_VIDEOS_PER_CHANNEL && fetchCount < maxFetches) {
    const playlistResponse = await window.yt('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: 25,
      pageToken: nextPageToken || ''
    });
    
    fetchCount++;
    const items = playlistResponse.items || [];
    if (!items.length) break;
    
    // 기간 필터 적용
    const filteredItems = dateFilter ? 
      items.filter(item => moment(item.snippet.publishedAt).isAfter(dateFilter)) : 
      items;
    
    videoIds.push(...filteredItems.map(item => item.contentDetails.videoId));
    nextPageToken = playlistResponse.nextPageToken;
    
    // 날짜 필터에 걸려서 더 이상 유효한 영상이 없으면 중단
    if (dateFilter && filteredItems.length < items.length) {
      break;
    }
    
    if (!nextPageToken) break;
  }
  
  return videoIds;
}

// 영상들을 돌연변이 여부 분석
async function analyzeVideosForMutants(videoIds, channel) {
  const mutantVideos = [];
  const subscriberCount = parseInt(channel.subscriberCount || '1', 10);
  
  // 25개씩 배치 처리
  for (let i = 0; i < videoIds.length; i += 25) {
    const batchIds = videoIds.slice(i, i + 25);
    
    const videosResponse = await window.yt('videos', {
      part: 'snippet,statistics,contentDetails',
      id: batchIds.join(',')
    });
    
    (videosResponse.items || []).forEach(video => {
      const mutantVideo = processMutantVideo(video, channel, subscriberCount);
      if (mutantVideo) {
        mutantVideos.push(mutantVideo);
      }
    });
  }
  
  return mutantVideos;
}

// 개별 영상 돌연변이 처리
function processMutantVideo(video, channel, subscriberCount) {
  const duration = window.seconds(video.contentDetails.duration);
  if (duration <= MUTANT_CONFIG.MIN_DURATION) {
    return null; // 숏폼 제외
  }
  
  const views = parseInt(video.statistics.viewCount || '0', 10);
  const mutantIndex = subscriberCount > 0 ? (views / subscriberCount) : 0;
  
  if (mutantIndex >= MUTANT_CONFIG.THRESHOLD) {
    return {
      id: video.id,
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
      viewCount: views,
      publishedAt: video.snippet.publishedAt,
      mutantIndex: mutantIndex.toFixed(2),
      duration: duration,
      __ch: {
        subscriberCount: subscriberCount,
        title: channel.title,
        channelId: channel.id
      }
    };
  }
  
  return null;
}

// 날짜 필터 가져오기
function getMutantDateFilter() {
  if (!window.state || window.state.currentMutantPeriod === 'all') {
    return null;
  }
  
  const periods = {
    '1m': 1,
    '3m': 3,
    '6m': 6
  };
  
  const months = periods[window.state.currentMutantPeriod] || 6;
  return moment().subtract(months, 'months');
}

// 정렬 모드 가져오기
function getMutantSortMode() {
  const sortSelect = qs('#sort-mutant');
  return sortSelect?.value || 'mutantIndex';
}

// 돌연변이 영상 정렬
function sortMutantVideos(videos, mode) {
  console.log('돌연변이 영상 정렬:', mode);
  
  switch (mode) {
    case 'views':
      videos.sort((a, b) => b.viewCount - a.viewCount);
      break;
    case 'subscribers':
      videos.sort((a, b) => b.__ch.subscriberCount - a.__ch.subscriberCount);
      break;
    case 'latest':
      videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      break;
    default: // mutantIndex
      videos.sort((a, b) => parseFloat(b.mutantIndex || 0) - parseFloat(a.mutantIndex || 0));
  }
}

// 돌연변이 영상 렌더링
function renderMutantVideos(videos) {
  const currentPage = window.state?.currentPage?.mutant || 1;
  const totalItems = videos.length;
  const startIndex = (currentPage - 1) * MUTANT_CONFIG.PAGINATION_SIZE;
  const endIndex = startIndex + MUTANT_CONFIG.PAGINATION_SIZE;
  const paginatedVideos = videos.slice(startIndex, endIndex);
  
  const listEl = qs('#mutant-list');
  if (!listEl) return;
  
  if (!videos.length) {
    showMutantEmpty();
    return;
  }
  
  listEl.innerHTML = '';
  
  // 비디오 카드 렌더링
  paginatedVideos.forEach(video => {
    const videoCard = createMutantVideoCard(video);
    listEl.appendChild(videoCard);
  });
  
  // 키워드 렌더링
  renderMutantKeywords(videos);
  
  // 페이지네이션 렌더링
  renderMutantPagination(currentPage, totalItems);
}

// 돌연변이 비디오 카드 생성
function createMutantVideoCard(video) {
  const videoCard = document.createElement('div');
  videoCard.className = 'video-card';
  
  const channelName = video.__ch?.title || '알 수 없음';
  const subscriberCount = parseInt(video.__ch?.subscriberCount || 0);
  const viewCount = parseInt(video.viewCount || 0);
  const uploadDate = moment(video.publishedAt).format('MM-DD');
  const mutantIndex = parseFloat(video.mutantIndex || '0.00');
  const duration = Math.round(video.duration / 60); // 분 단위
  
  // 포맷팅 함수들
  const formatSubscribers = (count) => {
    if (count >= 10000) return `구독자 ${Math.floor(count / 10000)}만명`;
    if (count >= 1000) return `구독자 ${Math.floor(count / 1000)}천명`;
    return `구독자 ${count}명`;
  };
  
  const formatViews = (count) => {
    if (count >= 100000000) return `조회수 ${Math.floor(count / 100000000)}억`;
    if (count >= 10000) return `조회수 ${Math.floor(count / 10000)}만`;
    if (count >= 1000) return `조회수 ${Math.floor(count / 1000)}천`;
    return `조회수 ${count}`;
  };
  
  videoCard.innerHTML = `
    <a class="video-link" target="_blank" href="https://www.youtube.com/watch?v=${video.id}">
      <div class="thumb-wrap">
        <img class="thumb" src="${video.thumbnail}" alt="" loading="lazy">
        <div class="duration-badge" style="
          position: absolute;
          bottom: 4px;
          right: 4px;
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        ">${duration}분</div>
      </div>
      <div class="v-title">${video.title}</div>
      <div class="v-meta">
        <div class="v-meta-top">
          <span title="${channelName}">${window.truncateText(channelName, 12)}</span>
          <span>${formatSubscribers(subscriberCount)}</span>
          <span>${formatViews(viewCount)}</span>
        </div>
        <div class="v-meta-bottom">
          <div class="mutant-badge">🚀 ${mutantIndex}</div>
          <div class="upload-date">${uploadDate}</div>
          <label class="video-done-checkbox">
            <input type="checkbox" data-done="${video.id}"/> 완료
          </label>
        </div>
      </div>
    </a>
  `;
  
  // 완료 상태 복원
  restoreVideoCompletionState(videoCard, video);
  
  // 완료 상태 변경 이벤트
  bindVideoCompletionEvent(videoCard, video);
  
  return videoCard;
}

// 완료 상태 복원
function restoreVideoCompletionState(videoCard, video) {
  idbGet('doneVideos', [video.__ch?.channelId || '', video.id])
    .then(record => {
      if (record) {
        const checkbox = videoCard.querySelector(`[data-done='${video.id}']`);
        if (checkbox) checkbox.checked = true;
      }
    })
    .catch(e => console.error('완료 상태 조회 실패:', e));
}

// 완료 상태 변경 이벤트 바인딩
function bindVideoCompletionEvent(videoCard, video) {
  videoCard.addEventListener('change', async (e) => {
    if (e.target && e.target.matches(`[data-done='${video.id}']`)) {
      const channelId = video.__ch?.channelId || '';
      try {
        if (e.target.checked) {
          await idbPut('doneVideos', {
            channelId: channelId,
            videoId: video.id,
            done: true,
            timestamp: Date.now()
          });
        } else {
          await idbDel('doneVideos', [channelId, video.id]);
        }
      } catch (e) {
        console.error('완료 상태 저장 실패:', e);
      }
    }
  });
}

// 키워드 렌더링
function renderMutantKeywords(videos) {
  const keywords = window.extractKeywords(videos.map(v => v.title || '').join(' '));
  const topKeywords = keywords.slice(0, 12);
  const keywordsEl = qs('#mutant-keywords');
  
  if (keywordsEl) {
    keywordsEl.innerHTML = topKeywords.map(([word, count]) => 
      `<span class="kw">${word} ${count}회</span>`
    ).join('');
  }
}

// 페이지네이션 렌더링
function renderMutantPagination(currentPage, totalItems) {
  if (totalItems <= MUTANT_CONFIG.PAGINATION_SIZE) {
    const paginationEl = qs('#mutant-pagination');
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }
  
  window.renderPagination('mutant-pagination', currentPage, totalItems, MUTANT_CONFIG.PAGINATION_SIZE, (page) => {
    window.state.currentPage.mutant = page;
    refreshMutant();
  });
}

// UI 상태 표시 함수들
function showMutantLoading() {
  const listEl = qs('#mutant-list');
  if (listEl) {
    listEl.innerHTML = `
      <div class="loading-state" style="text-align: center; padding: 40px 20px;">
        <div class="loading-spinner"></div>
        <div style="margin-top: 16px; color: var(--muted);">돌연변이 영상을 분석하는 중...</div>
      </div>
    `;
  }
}

function showMutantEmpty() {
  const listEl = qs('#mutant-list');
  if (listEl) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🚀</div>
        <p class="muted">돌연변이 영상을 찾을 수 없습니다</p>
        <p class="muted" style="font-size: 12px;">구독자 대비 ${MUTANT_CONFIG.THRESHOLD}배 이상 조회수인 영상이 없습니다</p>
      </div>
    `;
  }
  
  // 키워드와 페이지네이션도 초기화
  const keywordsEl = qs('#mutant-keywords');
  if (keywordsEl) keywordsEl.innerHTML = '';
  
  const paginationEl = qs('#mutant-pagination');
  if (paginationEl) paginationEl.innerHTML = '';
}

function showMutantError(error) {
  const listEl = qs('#mutant-list');
  if (listEl) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p class="muted">영상 분석 중 오류가 발생했습니다</p>
        <p class="muted" style="font-size: 12px;">${error.message}</p>
        <button class="btn btn-secondary" onclick="window.refreshMutant()">다시 시도</button>
      </div>
    `;
  }
}

// 전역으로 노출
window.refreshMutant = refreshMutant;
window.MUTANT_CONFIG = MUTANT_CONFIG;

console.log('mutant-videos.js 로딩 완료');
