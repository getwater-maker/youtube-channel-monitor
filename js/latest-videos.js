// YouTube 채널 모니터 - 최신 영상 섹션
console.log('latest-videos.js 로딩 시작');

// ============================================================================
// 최신 영상 설정 및 상수
// ============================================================================
const LATEST_CONFIG = {
  MIN_DURATION: 181,        // 최소 영상 길이 (초) - 롱폼만
  MIN_VIEWS: 50000,         // 최소 조회수 (5만회)
  MAX_SEARCH_VIDEOS: 10,    // 채널당 최대 검색 영상 수
  PAGINATION_SIZE: 12,      // 페이지당 영상 수 (수평 그리드용으로 증가)
  MAX_SEARCH_PAGES: 3       // 채널당 최대 검색 페이지 (더 많은 영상 검색)
};

// 기간 필터 (index.html의 최신영상 버튼과 매칭: 1w, 2w, 1m, all)
function getLatestDateFilter() {
  const p = (window.state && window.state.currentLatestPeriod) || '1m';
  if (p === 'all') return null;
  if (p === '1w') return moment().subtract(7, 'days');
  if (p === '2w') return moment().subtract(14, 'days');
  return moment().subtract(1, 'month'); // default 1m
}

// ============================================================================
// 섹션 전용: 기간 버튼 바인딩 (이 섹션만 갱신)
// ============================================================================
function bindLatestPeriodButtons() {
  const container = document.querySelector('#section-latest .date-range');
  if (!container || container.dataset.bound === '1') return;

  container.dataset.bound = '1';
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-period]');
    if (!btn) return;

    e.stopPropagation(); // 다른 섹션으로 이벤트 전파 방지
    container.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (!window.state) window.state = {};
    window.state.currentLatestPeriod = btn.dataset.period || '1m';

    refreshLatest(); // 최신영상 섹션만 갱신
  });
}

// ============================================================================
// 키워드 추출기 보장 (전역에 없으면 간단 버전 사용)
// ============================================================================
function getKeywordExtractor() {
  if (typeof window.extractKeywords === 'function') return window.extractKeywords;

  // 간단한 한/영 키워드 추출기 (fallback)
  const STOP = new Set(['the','a','an','of','and','or','to','in','on','for','with','by','is','are','was','were','be','as','at','it','this','that','from','한달','전체','영상']);
  return function fallbackExtract(titles) {
    const freq = new Map();
    (titles || []).forEach(t => {
      String(t || '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(Boolean)
        .forEach(w => {
          const k = w.toLowerCase();
          if (k.length < 2 || STOP.has(k)) return;
          freq.set(k, (freq.get(k) || 0) + 1);
        });
    });
    return [...freq.entries()]
      .sort((a,b) => b[1]-a[1])
      .slice(0, 30)
      .map(([w]) => w);
  };
}

// 안전한 문자열 자르기 보장
function safeTruncate(str, n) {
  if (typeof window.truncateText === 'function') return window.truncateText(str, n);
  const s = String(str || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ISO 8601 PTxxS → seconds 보장
function toSeconds(iso) {
  if (typeof window.seconds === 'function') return window.seconds(iso);
  try { return moment.duration(iso).asSeconds() | 0; } catch { return 0; }
}

// ============================================================================
// 최신 영상 수집 및 분석
// ============================================================================
async function refreshLatest() {
  console.log('최신 영상 새로고침 시작');

  bindLatestPeriodButtons(); // 버튼 보장 (중복 바인딩 방지)

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
  const dateFilter = getLatestDateFilter();

  for (const channel of channels) {
    console.log('채널 분석 시작:', channel.title);

    try {
      const channelVideos = await analyzeLatestVideosForChannel(channel, dateFilter);
      videos.push(...channelVideos);
    } catch (e) {
      console.error(`채널 ${channel.title} 분석 실패:`, e);
    }
  }

  return videos;
}

// 개별 채널의 최신 영상 분석
async function analyzeLatestVideosForChannel(channel, dateFilter) {
  let uploadsPlaylistId = await ensureUploadsPlaylistId(channel);
  if (!uploadsPlaylistId) {
    console.log(`${channel.title}: uploadsPlaylistId를 찾을 수 없음`);
    return [];
  }

  const videoIds = await collectVideoIds(uploadsPlaylistId, dateFilter);
  console.log(`${channel.title}: ${videoIds.length}개 영상 ID 수집`);

  const latestVideos = await analyzeVideosForLatest(videoIds, channel);
  console.log(`${channel.title}: ${latestVideos.length}개 최신 영상 발견`);

  return latestVideos;
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
  const maxFetches = LATEST_CONFIG.MAX_SEARCH_PAGES;

  while (videoIds.length < LATEST_CONFIG.MAX_SEARCH_VIDEOS && fetchCount < maxFetches) {
    const playlistResponse = await window.yt('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: 25,
      pageToken: nextPageToken || ''
    });

    fetchCount++;
    const items = playlistResponse.items || [];
    if (!items.length) break;

    const filteredItems = dateFilter
      ? items.filter(item => moment(item.snippet.publishedAt).isAfter(dateFilter))
      : items;

    videoIds.push(...filteredItems.map(item => item.contentDetails.videoId));
    nextPageToken = playlistResponse.nextPageToken;

    if (dateFilter && filteredItems.length < items.length) {
      break; // 필터로 유효한 항목이 거의 없으면 중단
    }

    if (!nextPageToken) break;
  }

  return videoIds;
}

// 영상들을 최신 영상 여부 분석
async function analyzeVideosForLatest(videoIds, channel) {
  const latestVideos = [];
  const subscriberCount = parseInt(channel.subscriberCount || '1', 10);

  for (let i = 0; i < videoIds.length; i += 25) {
    const batchIds = videoIds.slice(i, i + 25);

    const videosResponse = await window.yt('videos', {
      part: 'snippet,statistics,contentDetails',
      id: batchIds.join(',')
    });

    (videosResponse.items || []).forEach(video => {
      const latestVideo = processLatestVideo(video, channel, subscriberCount);
      if (latestVideo) {
        latestVideos.push(latestVideo);
      }
    });
  }

  return latestVideos;
}

// 개별 영상 최신 영상 처리
function processLatestVideo(video, channel, subscriberCount) {
  const duration = toSeconds(video.contentDetails.duration);
  if (duration < LATEST_CONFIG.MIN_DURATION) {
    return null; // 숏폼 제외 (181초 미만)
  }

  const views = parseInt(video.statistics.viewCount || '0', 10);
  
  // 최신 영상 조건: 최소 조회수 이상
  if (views >= LATEST_CONFIG.MIN_VIEWS) {
    const mutantIndex = subscriberCount > 0 ? (views / subscriberCount) : 0;
    
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
        subscriberCount: subscriberCount,
        title: channel.title,
        channelId: channel.id,
        thumbnail: channel.thumbnail || ''
      }
    };
  }

  return null;
}

// ============================================================================
// 최신 영상 렌더링 및 UI
// ============================================================================
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

// 최신 비디오 카드 생성 (수평 그리드용)
function createLatestVideoCard(video) {
  const videoCard = document.createElement('div');
  videoCard.className = 'video-card';

  const channelName = video.__ch?.title || '알 수 없음';
  const subscriberCount = parseInt(video.__ch?.subscriberCount || 0);
  const viewCount = parseInt(video.viewCount || 0);
  const uploadDate = moment(video.publishedAt).format('MM-DD');
  const mutantIndex = parseFloat(video.mutantIndex || '0.00');
  const durationMin = Math.round((video.duration || 0) / 60);

  const profileImage = video.__ch?.thumbnail || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiByeD0iMTgiIGZpbGw9IiM0YTU1NjgiLz4KPHN2ZyB4PSI2IiB5PSI2IiB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2U0ZTZlYSI+CjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDNjMS42NiAwIDMgMS4zNCAzIDNzLTEuMzQgMy0zIDMtMy0xLjM0LTMtMyAxLjM0LTMgMy0zem0wIDE0LjJjLTIuNSAwLTQuNzEtMS4yOC02LTMuMi4wMy0xLjk5IDQtMy4wOCA2LTMuMDhzNS45NyAxLjA5IDYgMy4wOGMtMS4yOSAxLjkyLTMuNSAzLjItNiAzLjJ6Ii8+Cjwvc3ZnPgo8L3N2Zz4=';

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
      <div class="thumb-wrap" style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 8px 8px 0 0; overflow: hidden;">
        <img class="thumb" src="${video.thumbnail}" alt="${safeTruncate(video.title, 80)}"
             style="width: 100%; height: 100%; object-fit: contain; display: block;">
        <div class="duration-badge">${durationMin}분</div>
        <div class="badge" style="position:absolute; top:6px; left:6px; padding:4px 8px; border-radius:8px; background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; font-weight:700; font-size:12px;">📱 최신</div>
      </div>
    </a>
    <div class="video-body">
      <div class="title">${safeTruncate(video.title, 70)}</div>
      <div class="meta">
        <img src="${profileImage}" alt="${channelName}" 
             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAzNiAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiByeD0iMTgiIGZpbGw9IiM0YTU1NjgiLz48L3N2Zz4=';"
             style="width:36px; height:36px; border-radius:50%; object-fit:cover; flex-shrink:0;">
        <div style="min-width:0; overflow:hidden;">
          <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${channelName}</div>
          <div style="font-size:12px; color:var(--muted); white-space:nowrap;">
            ${formatSubscribers(subscriberCount)} · ${formatViews(viewCount)} · ${uploadDate}
          </div>
        </div>
      </div>
      <div style="margin-top:6px; color:var(--muted); font-size:12px;">
        ${mutantIndex >= 2.0 ? `돌연변이 ${mutantIndex}` : `일반 영상`}
      </div>
    </div>
  `;

  return videoCard;
}

// 키워드 렌더링
function renderLatestKeywords(videos) {
  const kwEl = qs('#latest-keywords');
  if (!kwEl) return;

  const extract = getKeywordExtractor();
  const words = extract(videos.map(v => v.title));
  kwEl.innerHTML = words.map(w => `<span class="kw">${w}</span>`).join(' ');

  setTimeout(() => window.updateKeywordsBoxHeights && window.updateKeywordsBoxHeights(), 0);
}

// 페이지네이션
function renderLatestPagination(currentPage, totalItems) {
  const totalPages = Math.max(1, Math.ceil(totalItems / LATEST_CONFIG.PAGINATION_SIZE));
  const el = qs('#latest-pagination');
  if (!el) return;
  
  if (totalPages <= 1) {
    el.innerHTML = '';
    return;
  }
  
  const btn = (p, label = p, disabled = false, active = false) =>
    `<button class="btn btn-secondary ${active ? 'active' : ''}" data-page="${p}" ${disabled ? 'disabled' : ''} style="min-width:36px;">${label}</button>`;

  let html = '';
  html += btn(Math.max(1, currentPage - 1), '‹', currentPage === 1);
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  for (let p = start; p <= end; p++) html += btn(p, String(p), false, p === currentPage);
  html += btn(Math.min(totalPages, currentPage + 1), '›', currentPage === totalPages);

  el.innerHTML = html;
  
  // 페이지 버튼 이벤트
  qsa('button[data-page]', el).forEach(b => {
    b.addEventListener('click', () => {
      const p = parseInt(b.getAttribute('data-page'), 10);
      if (!window.state) window.state = { currentPage: {} };
      window.state.currentPage.latest = p;
      refreshLatest();
    });
  });
}

// 정렬 모드
function getLatestSortMode() {
  const select = qs('#sort-latest');
  return select?.value || 'latest';
}

// 정렬
function sortLatestVideos(videos, mode) {
  if (mode === 'views') {
    videos.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  } else if (mode === 'subscribers') {
    videos.sort((a, b) => (a.__ch?.subscriberCount || 0) - (b.__ch?.subscriberCount || 0)).reverse();
  } else if (mode === 'mutantIndex') {
    videos.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
  } else {
    // latest - 기본 정렬 (최신순)
    videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }
}

// 로딩/빈/에러
function showLatestLoading() {
  const el = qs('#latest-list');
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p class="muted">불러오는 중...</p></div>`;
}
function showLatestEmpty() {
  const el = qs('#latest-list');
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">📱</div><p class="muted">조건에 맞는 최신 영상이 없습니다.<br>조회수 5만 이상의 롱폼 영상을 찾고 있습니다.</p></div>`;
}
function showLatestError(error) {
  const el = qs('#latest-list');
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p class="muted">오류: ${error?.message || error}</p></div>`;
}

// 전역 노출
window.refreshLatest = refreshLatest;

console.log('latest-videos.js 로딩 완료');