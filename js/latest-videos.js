// YouTube 채널 모니터 - 최신 영상 섹션
console.log('latest-videos.js 로딩 시작');

// ============================================================================
// 최신 영상 설정 및 상수
// ============================================================================
const LATEST_CONFIG = {
  MIN_DURATION: 180,        // 최소 영상 길이 (초) - 롱폼만
  MAX_SEARCH_VIDEOS: 10,    // 채널당 최대 검색 영상 수
  PAGINATION_SIZE: 5,       // 페이지당 영상 수
  MAX_SEARCH_PAGES: 2       // 채널당 최대 검색 페이지
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
  const container = document.querySelector('[data-col="latest"] .date-range');
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
    console.log('최신 영상 조회:', channel.title);

    try {
      const latestVideo = await findLatestVideoForChannel(channel, dateFilter);
      if (latestVideo) {
        videos.push(latestVideo);
      }
    } catch (e) {
      console.error(`채널 ${channel.title} 최신 영상 조회 실패:`, e);
    }
  }

  return videos;
}

// 개별 채널의 최신 롱폼 영상 찾기 (+ 날짜필터)
async function findLatestVideoForChannel(channel, dateFilter) {
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
    const items = (playlistResponse.items || []);
    if (!items.length) break;

    // 날짜 필터 적용(있다면)
    const filteredItems = dateFilter
      ? items.filter(it => moment(it.snippet.publishedAt).isAfter(dateFilter))
      : items;

    const videoIds = filteredItems.map(item => item.contentDetails.videoId);
    if (!videoIds.length) {
      nextPageToken = playlistResponse.nextPageToken;
      if (!nextPageToken) break;
      continue;
    }

    const videosResponse = await window.yt('videos', {
      part: 'snippet,statistics,contentDetails',
      id: videoIds.join(',')
    });

    // 롱폼 영상 찾기
    for (const video of (videosResponse.items || [])) {
      const duration = toSeconds(video.contentDetails.duration);
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

// 최신 영상 객체 생성 (프로필 썸네일 포함)
function createLatestVideoObject(video, channel) {
  const views = parseInt(video.statistics.viewCount || '0', 10);
  const subscribers = parseInt(channel.subscriberCount || '1', 10);
  const mutantIndex = subscribers > 0 ? (views / subscribers) : 0;
  const duration = toSeconds(video.contentDetails.duration);

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
      channelId: channel.id,
      thumbnail: channel.thumbnail || ''   // 프로필 출력 보장
    }
  };
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

// 최신 비디오 카드 생성 (썸네일 전체 표시: object-fit: contain)
function createLatestVideoCard(video) {
  const videoCard = document.createElement('div');
  videoCard.className = 'video-card';

  const channelName = video.__ch?.title || '알 수 없음';
  const subscriberCount = parseInt(video.__ch?.subscriberCount || 0);
  const viewCount = parseInt(video.viewCount || 0);
  const uploadDate = moment(video.publishedAt).format('MM-DD');
  const mutantIndex = parseFloat(video.mutantIndex || '0.00');
  const durationMin = Math.round((video.duration || 0) / 60);
  const daysSinceUpload = moment().diff(moment(video.publishedAt), 'days');
  const isRecent = daysSinceUpload <= 3;
  const showMutantBadge = mutantIndex >= (window.CONFIG?.MUTANT_THRESHOLD || 2.0);

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
      <div class="thumb-wrap" style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden;">
        <img class="thumb" src="${video.thumbnail}" alt="${safeTruncate(video.title, 80)}"
             style="width: 100%; height: 100%; object-fit: contain; display: block;">
        <div class="duration-badge" style="position: absolute; bottom: 6px; right: 6px; padding: 3px 8px; border-radius: 8px; background: rgba(0,0,0,.6); color:#fff; font-size:12px;">
          ${durationMin}분
        </div>
        ${isRecent ? `<div class="badge" style="position:absolute; top:6px; right:6px; padding:4px 8px; border-radius:8px; background:#5865f2; color:#fff; font-weight:700; font-size:12px;">NEW</div>` : ''}
        ${showMutantBadge ? `<div class="badge" style="position:absolute; top:6px; left:6px; padding:4px 8px; border-radius:8px; background:linear-gradient(135deg,#c4302b,#a02622); color:#fff; font-weight:700; font-size:12px;">🚀 돌연변이</div>` : ''}
      </div>
    </a>
    <div class="video-body" style="padding: 10px 8px 8px 8px;">
      <div class="title" style="font-weight:700; margin: 4px 0 8px 0;">${safeTruncate(video.title, 70)}</div>
      <div class="meta" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; color:var(--muted); font-size:13px;">
        <img src="${video.__ch?.thumbnail || ''}" alt="${channelName}" onerror="this.style.display='none';"
             style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
        <span>${channelName}</span>
        <span>·</span>
        <span>${formatSubscribers(subscriberCount)}</span>
        <span>·</span>
        <span>${formatViews(viewCount)}</span>
        <span>·</span>
        <span>${uploadDate}</span>
      </div>
      <div style="margin-top:6px; color:var(--muted); font-size:13px;">지수 ${mutantIndex.toFixed(2)}</div>
    </div>
  `;

  return videoCard;
}

// 키워드 렌더링 (끝나면 키워드 박스 높이 동기화)
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
  if (typeof window.renderPagination === 'function') {
    window.renderPagination(el, currentPage, totalPages, (page) => {
      if (!window.state) window.state = { currentPage: {} };
      window.state.currentPage.latest = page;
      refreshLatest();
    });
  } else {
    el.innerHTML = '';
  }
}

// 정렬 모드
function getLatestSortMode() {
  const select = qs('#sort-latest');
  return select?.value || 'views';
}

// 정렬
function sortLatestVideos(videos, mode) {
  if (mode === 'subscribers') {
    videos.sort((a, b) => (a.__ch?.subscriberCount || 0) - (b.__ch?.subscriberCount || 0)).reverse();
  } else if (mode === 'latest') {
    videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  } else if (mode === 'mutantIndex') {
    videos.sort((a, b) => parseFloat(b.mutantIndex) - parseFloat(a.mutantIndex));
  } else {
    videos.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  }
}

// 로딩/빈/에러
function showLatestLoading() {
  const el = qs('#latest-list');
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><p class="muted">불러오는 중...</p></div>`;
}
function showLatestEmpty() {
  const el = qs('#latest-list');
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">📱</div><p class="muted">채널을 추가하여 영상을 분석해주세요</p></div>`;
}
function showLatestError(error) {
  const el = qs('#latest-list');
  if (el) el.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p class="muted">오류: ${error?.message || error}</p></div>`;
}

// 키워드 박스 높이 동기화(공용)
if (typeof window.updateKeywordsBoxHeights !== 'function') {
  window.updateKeywordsBoxHeights = function() {
    const a = qs('#mutant-keywords');
    const b = qs('#latest-keywords');
    if (!a || !b) return;
    a.style.height = 'auto';
    b.style.height = 'auto';
    const maxH = Math.max(a.scrollHeight, b.scrollHeight);
    a.style.minHeight = maxH + 'px';
    b.style.minHeight = maxH + 'px';
  };
}

// 전역 노출
window.refreshLatest = refreshLatest;

console.log('latest-videos.js 로딩 완료');
