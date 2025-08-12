// 최신 영상 섹션 전용 관리
console.log('latest-videos.js 로딩 시작');

// 최신 영상 설정
const LATEST_CONFIG = {
  MIN_DURATION: 180,        // 최소 영상 길이 (초) - 롱폼만
  MAX_SEARCH_VIDEOS: 10,    // 채널당 최대 검색 영상 수
  PAGINATION_SIZE: 5,       // 페이지당 영상 수
  MAX_SEARCH_PAGES: 2       // 채널당 최대 검색 페이지
};

// 최신 영상 새로고침
async function refreshLatest() {
  console.log('최신 영상 새로고침 시작');
  
  const listEl = qs('#latest-list');
  if (!listEl) {
    console.error('latest-list 요소를 찾을 수 없음');
    return;
  }
  
  // 로딩 상태 표시
  showLatestLoading();
  
  try {
    const channels = await getAllChannels();
    console.log('조회할 채널 수:', channels.length);
    
    if (!channels.length) {
      showLatestEmpty();
      return;
    }

    const videos = await collectLatestVideos(channels);
    console.log('총 최신 영상 수:', videos.length);
    
    // 정렬 적용
    const sortMode = getLatestSortMode();
    sortLatestVideos(videos, sortMode);
    
    // 렌더링
    renderLatestVideos(videos);
    
  } catch (error) {
    console.error('최신 영상 새로고침 실패:', error);
    showLatestError(error);
  }
}

// 최신 영상 수집
async function collectLatestVideos(channels) {
  const videos = [];
  
  for (const channel of channels) {
    console.log('최신 영상 조회:', channel.title);
    
    try {
      const latestVideo = await findLatestVideoForChannel(channel);
      if (latestVideo) {
        videos.push(latestVideo);
      }
    } catch (e) {
      console.error(`채널 ${channel.title} 최신 영상 조회 실패:`, e);
    }
  }
  
  return videos;
}

// 개별 채널의 최신 영상 찾기
async function findLatestVideoForChannel(channel) {
  // uploadsPlaylistId 확인
  const uploadsPlaylistId = await ensureLatestUploadsPlaylistId(channel);
  if (!uploadsPlaylistId) {
    console.log(`${channel.title}: uploadsPlaylistId를 찾을 수 없음`);
    return null;
  }
  
  let nextPageToken = null;
  let searchCount = 0;
  
  while (searchCount < LATEST_CONFIG.MAX_SEARCH_PAGES) {
    const playlistResponse = await window.yt('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: LATEST_CONFIG.MAX_SEARCH_VIDEOS,
      pageToken: nextPageToken || ''
    });
    
    searchCount++;
    const videoIds = (playlistResponse.items || []).map(item => item.contentDetails.videoId);
    if (!videoIds.length) break;
    
    const videosResponse = await window.yt('videos', {
      part: 'snippet,statistics,contentDetails',
      id: videoIds.join(',')
    });
    
    // 롱폼 영상 찾기
    for (const video of (videosResponse.items || [])) {
      const duration = window.seconds(video.contentDetails.duration);
      if (duration > LATEST_CONFIG.MIN_DURATION) {
        return createLatestVideoObject(video, channel);
      }
    }
    
    nextPageToken = playlistResponse.nextPageToken;
    if (!nextPageToken) break;
  }
  
  console.log(`${channel.title}: 롱폼 영상을 찾을 수 없음`);
  return null;
}

// uploadsPlaylistId 확인 및 업데이트
async function ensureLatestUploadsPlaylistId(channel) {
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

// 최신 영상 객체 생성
function createLatestVideoObject(video, channel) {
  const views = parseInt(video.statistics.viewCount || '0', 10);
  const subscribers = parseInt(channel.subscriberCount || '1', 10);
  const mutantIndex = subscribers > 0 ? (views / subscribers) : 0;
  const duration = window.seconds(video.contentDetails.duration);
  
  return {
    id: video.id,
    title: video.snippet.title,
    thumbnail: video.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
    viewCount: views,
    publishedAt: video.snippet.publishedAt,
    mutantIndex: mutantIndex.toFixed(2),
    duration: duration,
    likeCount: parseInt(video.statistics.likeCount || '0', 10),
    commentCount: parseInt(video.statistics.commentCount || '0', 10),
    __ch: {
      subscriberCount: subscribers,
      title: channel.title,
      channelId: channel.id
    }
  };
}

// 정렬 모드 가져오기
function getLatestSortMode() {
  const sortSelect = qs('#sort-latest');
  return sortSelect?.value || 'views';
}

// 최신 영상 정렬
function sortLatestVideos(videos, mode) {
  console.log('최신 영상 정렬:', mode);
  
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
    case 'mutantIndex':
      videos.sort((a, b) => parseFloat(b.mutantIndex || 0) - parseFloat(a.mutantIndex || 0));
      break;
    default:
      videos.sort((a, b) => b.viewCount - a.viewCount);
  }
}

// 최신 영상 렌더링
function renderLatestVideos(videos) {
  const currentPage = window.state?.currentPage?.latest || 1;
  const totalItems = videos.length;
  const startIndex = (currentPage - 1) * LATEST_CONFIG.PAGINATION_SIZE;
  const endIndex = startIndex + LATEST_CONFIG.PAGINATION_SIZE;
  const paginatedVideos = videos.slice(startIndex, endIndex);
  
  const listEl = qs('#latest-list');
  if (!listEl) return;
  
  if (!videos.length) {
    showLatestEmpty();
    return;
  }
  
  listEl.innerHTML = '';
  
  // 비디오 카드 렌더링
  paginatedVideos.forEach(video => {
    const videoCard = createLatestVideoCard(video);
    listEl.appendChild(videoCard);
  });
  
  // 키워드 렌더링
  renderLatestKeywords(videos);
  
  // 페이지네이션 렌더링
  renderLatestPagination(currentPage, totalItems);
}

// 최신 비디오 카드 생성
function createLatestVideoCard(video) {
  const videoCard = document.createElement('div');
  videoCard.className = 'video-card';
  
  const channelName = video.__ch?.title || '알 수 없음';
  const subscriberCount = parseInt(video.__ch?.subscriberCount || 0);
  const viewCount = parseInt(video.viewCount || 0);
  const uploadDate = moment(video.publishedAt).format('MM-DD');
  const mutantIndex = parseFloat(video.mutantIndex || '0.00');
  const duration = Math.round(video.duration / 60); // 분 단위
  const daysSinceUpload = moment().diff(moment(video.publishedAt), 'days');
  
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
  
  // 최신 여부 표시
  const isRecent = daysSinceUpload <= 3;
  const showMutantBadge = mutantIndex >= window.CONFIG.MUTANT_THRESHOLD;
  
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
        ${isRecent ? `
          <div class="new-badge" style="
            position: absolute;
            top: 4px;
            left: 4px;
            background: linear-gradient(135deg, #ff4757, #c44569);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            box-shadow: 0 2px 8px rgba(255, 71, 87, 0.3);
          ">NEW</div>
        ` : ''}
      </div>
      <div class="v-title">${video.title}</div>
      <div class="v-meta">
        <div class="v-meta-top">
          <span title="${channelName}">${window.truncateText(channelName, 12)}</span>
          <span>${formatSubscribers(subscriberCount)}</span>
          <span>${formatViews(viewCount)}</span>
        </div>
        <div class="v-meta-bottom">
          ${showMutantBadge ? 
            `<div class="mutant-badge">🚀 ${mutantIndex}</div>` : 
            `<div class="mutant-indicator">${mutantIndex}</div>`
          }
          <div class="upload-date" title="${moment(video.publishedAt).format('YYYY-MM-DD HH:mm')}">${uploadDate}</div>
          <label class="video-done-checkbox">
            <input type="checkbox" data-done="${video.id}"/> 완료
          </label>
        </div>
        ${video.likeCount > 0 || video.commentCount > 0 ? `
          <div class="engagement-stats" style="
            display: flex;
            justify-content: space-between;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--border);
            font-size: 10px;
            color: var(--muted);
          ">
            <span>👍 ${window.fmt(video.likeCount)}</span>
            <span>💬 ${window.fmt(video.commentCount)}</span>
            <span>${daysSinceUpload}일 전</span>
          </div>
        ` : ''}
      </div>
    </a>
  `;
  
  // 완료 상태 복원
  restoreLatestVideoCompletionState(videoCard, video);
  
  // 완료 상태 변경 이벤트
  bindLatestVideoCompletionEvent(videoCard, video);
  
  return videoCard;
}

// 완료 상태 복원
function restoreLatestVideoCompletionState(videoCard, video) {
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
function bindLatestVideoCompletionEvent(videoCard, video) {
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
function renderLatestKeywords(videos) {
  const keywords = window.extractKeywords(videos.map(v => v.title || '').join(' '));
  const topKeywords = keywords.slice(0, 12);
  const keywordsEl = qs('#latest-keywords');
  
  if (keywordsEl) {
    keywordsEl.innerHTML = topKeywords.map(([word, count]) => 
      `<span class="kw">${word} ${count}회</span>`
    ).join('');
  }
}

// 페이지네이션 렌더링
function renderLatestPagination(currentPage, totalItems) {
  if (totalItems <= LATEST_CONFIG.PAGINATION_SIZE) {
    const paginationEl = qs('#latest-pagination');
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }
  
  window.renderPagination('latest-pagination', currentPage, totalItems, LATEST_CONFIG.PAGINATION_SIZE, (page) => {
    window.state.currentPage.latest = page;
    refreshLatest();
  });
}

// UI 상태 표시 함수들
function showLatestLoading() {
  const listEl = qs('#latest-list');
  if (listEl) {
    listEl.innerHTML = `
      <div class="loading-state" style="text-align: center; padding: 40px 20px;">
        <div class="loading-spinner"></div>
        <div style="margin-top: 16px; color: var(--muted);">최신 영상을 조회하는 중...</div>
      </div>
    `;
  }
}

function showLatestEmpty() {
  const listEl = qs('#latest-list');
  if (listEl) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📱</div>
        <p class="muted">최신 영상을 찾을 수 없습니다</p>
        <p class="muted" style="font-size: 12px;">등록된 채널의 롱폼 영상(3분 이상)이 없습니다</p>
      </div>
    `;
  }
  
  // 키워드와 페이지네이션도 초기화
  const keywordsEl = qs('#latest-keywords');
  if (keywordsEl) keywordsEl.innerHTML = '';
  
  const paginationEl = qs('#latest-pagination');
  if (paginationEl) paginationEl.innerHTML = '';
}

function showLatestError(error) {
  const listEl = qs('#latest-list');
  if (listEl) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p class="muted">최신 영상 조회 중 오류가 발생했습니다</p>
        <p class="muted" style="font-size: 12px;">${error.message}</p>
        <button class="btn btn-secondary" onclick="window.refreshLatest()">다시 시도</button>
      </div>
    `;
  }
}

// 최신 영상 설정 변경 함수들
function updateLatestConfig(newConfig) {
  Object.assign(LATEST_CONFIG, newConfig);
  console.log('최신 영상 설정 업데이트:', LATEST_CONFIG);
}

function getLatestConfig() {
  return { ...LATEST_CONFIG };
}

// 최신 영상 통계 조회
function getLatestVideoStats(videos) {
  if (!videos.length) return null;
  
  const totalVideos = videos.length;
  const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0);
  const avgViews = totalViews / totalVideos;
  const totalLikes = videos.reduce((sum, v) => sum + (v.likeCount || 0), 0);
  const totalComments = videos.reduce((sum, v) => sum + (v.commentCount || 0), 0);
  const avgMutantIndex = videos.reduce((sum, v) => sum + parseFloat(v.mutantIndex), 0) / totalVideos;
  
  const recentVideos = videos.filter(v => 
    moment().diff(moment(v.publishedAt), 'days') <= 7
  );
  
  return {
    totalVideos,
    totalViews,
    avgViews: Math.round(avgViews),
    totalLikes,
    totalComments,
    avgMutantIndex: avgMutantIndex.toFixed(2),
    recentVideosCount: recentVideos.length,
    engagementRate: totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100).toFixed(2) : 0
  };
}

// 전역으로 노출
window.refreshLatest = refreshLatest;
window.LATEST_CONFIG = LATEST_CONFIG;
window.updateLatestConfig = updateLatestConfig;
window.getLatestConfig = getLatestConfig;
window.getLatestVideoStats = getLatestVideoStats;

console.log('latest-videos.js 로딩 완료');
