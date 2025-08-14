// YouTube 채널 모니터 - 영상분석 통합 관리 (탭별 취소토큰 + 진행바 중앙정렬 + 전역 아바타 폴백)
console.log('videos.js 로딩 시작');

// ============================================================================
// 전역: 채널/사용자 아바타 이미지 폴백(앱 전체 적용)
// ============================================================================
(function installGlobalAvatarFallback() {
  const DEFAULT_AVATAR = 'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj';

  // 이미지 에러를 캡처 단계에서 가로채어 폴백 처리
  window.addEventListener('error', (ev) => {
    const img = ev.target;
    if (!(img && img.tagName === 'IMG')) return;

    // 이미 폴백을 적용했으면 무시
    if (img.dataset.fallbackApplied === '1') return;

    const src = img.currentSrc || img.src || '';

    // YouTube/Google 아바타 계열만 폴백 적용 (비디오 썸네일 등은 건드리지 않음)
    const isLikelyAvatar =
      /yt3\.ggpht\.com/i.test(src) ||
      /googleusercontent\.com/i.test(src);

    if (isLikelyAvatar) {
      img.dataset.fallbackApplied = '1';
      img.src = DEFAULT_AVATAR;
      console.debug('Avatar fallback applied:', src);
    }
  }, true);

  // 이미 DOM에 있는 이미지들 중 깨진 것 바로 보정
  function fixExistingBroken() {
    document.querySelectorAll('img').forEach((img) => {
      // complete이면서 naturalWidth==0 이면 깨진 이미지
      if (img.complete && img.naturalWidth === 0) {
        const e = new Event('error');
        img.dispatchEvent(e);
      }
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(fixExistingBroken, 0);
  } else {
    document.addEventListener('DOMContentLoaded', fixExistingBroken);
  }
})();

// ============================================================================
// 상태 (탭별 로딩/토큰 분리)
// ============================================================================
window.videosState = window.videosState || {
  currentTab: 'latest',
  currentPeriod: '1m',     // 1w, 2w, 1m, all
  currentSort: 'views'     // views | subscribers | latest | mutantIndex
};

// 탭별 로딩 상태와 실행 토큰(취소용)
window.__videoLoads = window.__videoLoads || {
  latest: { loading: false, token: 0 },
  mutant: { loading: false, token: 0 }
};

// ============================================================================
// 유틸
// ============================================================================
function getPeriodText(p) {
  switch (p) {
    case '1w': return '최근 1주';
    case '2w': return '최근 2주';
    case '1m': return '최근 1개월';
    case 'all': return '전체';
    default: return '최근 1개월';
  }
}

function getDateRangeForPeriod(period) {
  const now = moment();
  let startDate = null;
  switch (period) {
    case '1w': startDate = moment().subtract(1, 'week'); break;
    case '2w': startDate = moment().subtract(2, 'weeks'); break;
    case '1m': startDate = moment().subtract(1, 'month'); break;
    case 'all': startDate = null; break;
    default: startDate = moment().subtract(1, 'month');
  }
  return { startDate, endDate: now };
}

function filterVideosByDate(videos, period) {
  if (period === 'all') return videos;
  const { startDate } = getDateRangeForPeriod(period);
  if (!startDate) return videos;
  return videos.filter(v => moment(v.snippet?.publishedAt).isAfter(startDate));
}

function numberWithCommas(n) {
  const num = parseInt(n || 0, 10);
  return isNaN(num) ? '0' : num.toLocaleString('ko-KR');
}

function ratioSafe(a, b) {
  const x = parseFloat(a || 0);
  const y = parseFloat(b || 0);
  return y > 0 ? (x / y) : 0;
}

// ============================================================================
// 진행바 UI (CSS로 중앙정렬, JS는 구조만 출력)
// ============================================================================
function mountProgress(container, titleText, total) {
  // 이미 있으면 재사용
  let wrap = container.querySelector('.progress-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'progress-wrap';
    wrap.innerHTML = `
      <div class="progress-head">
        <span class="progress-title"></span>
        <span class="progress-detail"></span>
      </div>
      <div class="progress-outer">
        <div class="progress-bar" style="width:0%"></div>
      </div>
      <div class="progress-foot">
        <span class="progress-text">0%</span>
      </div>
    `;
    container.innerHTML = '';
    container.appendChild(wrap);
  }
  wrap.querySelector('.progress-title').textContent = titleText || '진행 중';
  wrap.querySelector('.progress-detail').textContent = `채널 0 / ${total}`;
  wrap.querySelector('.progress-bar').style.width = '0%';
  wrap.querySelector('.progress-text').textContent = '0%';
  return wrap;
}

function updateProgress(wrap, current, total) {
  const pct = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
  wrap.querySelector('.progress-bar').style.width = pct + '%';
  wrap.querySelector('.progress-text').textContent = pct + '%';
  wrap.querySelector('.progress-detail').textContent = `채널 ${Math.min(current, total)} / ${total}`;
}

function finishProgress(wrap, note = '완료') {
  if (!wrap) return;
  wrap.querySelector('.progress-text').textContent = note;
}

// ============================================================================
// 탭/필터 초기화
// ============================================================================
function initializeVideoTabs() {
  const tabButtons = document.querySelectorAll('.video-tab');
  const tabContents = document.querySelectorAll('.video-tab-content');

  tabContents.forEach(c => (c.style.display = 'none'));
  const latestContent = document.getElementById('video-tab-latest');
  if (latestContent) latestContent.style.display = 'block';

  tabButtons.forEach(btn => {
    if (btn.dataset.tabBound === '1') return;
    btn.dataset.tabBound = '1';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = btn.dataset.videoTab;
      window.videosState.currentTab = tab;

      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach(c => { c.style.display = 'none'; c.classList.remove('active'); });
      const target = document.getElementById(`video-tab-${tab}`);
      if (target) { target.style.display = 'block'; target.classList.add('active'); }

      updateSortOptions(tab);
      loadVideoTabData(tab);        // 즉시 해당 탭 로딩 시작
    });
  });
}

function updateSortOptions(tabName) {
  const sortSelect = document.getElementById('sort-videos');
  if (!sortSelect) return;
  sortSelect.value = (tabName === 'mutant') ? 'mutantIndex' : 'views';
  window.videosState.currentSort = sortSelect.value;
}

function initializePeriodButtons() {
  const periodButtons = document.querySelectorAll('.period-btn');
  periodButtons.forEach(btn => {
    if (btn.dataset.periodBound === '1') return;
    btn.dataset.periodBound = '1';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const p = btn.dataset.period;
      window.videosState.currentPeriod = p;
      periodButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadVideoTabData(window.videosState.currentTab);
    });
  });
}

function initializeSortFilter() {
  const sortSelect = document.getElementById('sort-videos');
  if (!sortSelect || sortSelect.dataset.sortBound === '1') return;
  sortSelect.dataset.sortBound = '1';

  sortSelect.addEventListener('change', (e) => {
    window.videosState.currentSort = e.target.value;
    loadVideoTabData(window.videosState.currentTab);
  });
}

// ============================================================================
// 데이터 로딩 분기 (탭별 취소토큰 사용)
// ============================================================================
function loadVideoTabData(tabName) {
  console.log('영상 탭 데이터 로드:', tabName, '기간:', window.videosState.currentPeriod);
  if (tabName === 'mutant') refreshMutant();
  else if (tabName === 'latest') refreshLatest();
  else console.warn('알 수 없는 탭:', tabName);
}

// ============================================================================
// API 헬퍼
// ============================================================================
async function getChannelRecentLongformVideos(channel, perChannelMax = 5) {
  const uploadsId = channel.uploadsPlaylistId;
  if (!uploadsId) return [];

  const list = await window.yt('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId: uploadsId,
    maxResults: Math.min(10, perChannelMax * 2)
  });

  const ids = (list.items || [])
    .map(i => i.contentDetails && i.contentDetails.videoId)
    .filter(Boolean)
    .slice(0, Math.max(1, perChannelMax * 2));

  if (!ids.length) return [];

  const details = await window.yt('videos', {
    part: 'snippet,contentDetails,statistics',
    id: ids.join(',')
  });

  const MIN = (window.CONFIG && window.CONFIG.MIN_LONGFORM_DURATION) || 181;
  const longform = (details.items || []).filter(v => {
    const dur = moment.duration(v.contentDetails?.duration || 'PT0S').asSeconds();
    return dur >= MIN;
  });

  longform.forEach(v => {
    v.__channel = {
      id: channel.id,
      title: channel.title,
      thumbnail: channel.thumbnail,
      subscribers: parseInt(channel.subscriberCount || '0', 10)
    };
  });

  return longform;
}

// ============================================================================
// 최신 영상 탭
// ============================================================================
async function refreshLatest() {
  const slot = window.__videoLoads.latest;
  const myToken = ++slot.token;
  slot.loading = true;

  const listEl = document.getElementById('latest-list');
  if (!listEl) { console.error('latest-list 요소를 찾을 수 없음'); slot.loading = false; return; }

  listEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏳</div>
      <p class="muted">최신 영상을 불러오는 중... (${getPeriodText(window.videosState.currentPeriod)})</p>
    </div>`;

  let progressWrap = null;

  try {
    if (!(window.hasKeys && window.hasKeys())) {
      if (myToken !== slot.token) return;
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔑</div>
          <p class="muted">먼저 API 키를 설정해주세요. 우상단의 <b>🔑 API 키</b> 버튼을 클릭하세요.</p>
        </div>`;
      return;
    }

    const channels = await getAllChannels();
    const total = channels.length || 0;

    if (myToken !== slot.token) return;
    if (!total) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📺</div>
          <p class="muted">채널을 먼저 추가해주세요.</p>
        </div>`;
      return;
    }

    progressWrap = mountProgress(listEl, '최신영상 수집 중', total);

    const perChannelMax = 4;
    const all = [];
    let done = 0;

    for (const ch of channels) {
      if (myToken !== slot.token) return;
      try {
        const vids = await getChannelRecentLongformVideos(ch, perChannelMax);
        all.push(...vids);
      } catch (e) {
        console.warn('채널 영상 조회 실패:', ch?.title, e);
      } finally {
        done += 1;
        if (myToken !== slot.token) return;
        updateProgress(progressWrap, done, total);
      }
    }

    if (myToken !== slot.token) return;
    finishProgress(progressWrap, '정렬/필터 적용 중…');

    let videos = filterVideosByDate(all, window.videosState.currentPeriod);
    const sort = window.videosState.currentSort;
    videos.sort((a, b) => {
      const av = parseInt(a.statistics?.viewCount || '0', 10);
      const bv = parseInt(b.statistics?.viewCount || '0', 10);
      const as = a.__channel?.subscribers || 0;
      const bs = b.__channel?.subscribers || 0;
      const ap = new Date(a.snippet?.publishedAt || 0).getTime();
      const bp = new Date(b.snippet?.publishedAt || 0).getTime();
      const aIdx = ratioSafe(av, as);
      const bIdx = ratioSafe(bv, bs);

      switch (sort) {
        case 'subscribers': return bs - as;
        case 'latest': return bp - ap;
        case 'mutantIndex': return bIdx - aIdx;
        case 'views':
        default: return bv - av;
      }
    });

    if (myToken !== slot.token) return;
    listEl.innerHTML = '';
    renderVideoCards(listEl, videos);

    const kwBox = document.getElementById('latest-keywords');
    if (kwBox) {
      const keywords = window.extractKeywords
        ? window.extractKeywords(videos.map(v => v.snippet?.title || '').join(' '))
        : [];
      kwBox.innerHTML = keywords.map(w => `<span class="kw">${w}</span>`).join('') || '';
    }
  } catch (e) {
    if (myToken !== slot.token) return;
    console.error('최신 영상 탭 오류:', e);
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p class="muted">영상을 불러오는 중 오류가 발생했습니다: ${e?.message || e}</p>
      </div>`;
  } finally {
    if (myToken === slot.token) slot.loading = false;
  }
}

// ============================================================================
// 돌연변이 탭
// ============================================================================
async function refreshMutant() {
  const slot = window.__videoLoads.mutant;
  const myToken = ++slot.token;
  slot.loading = true;

  const listEl = document.getElementById('mutant-list');
  if (!listEl) { console.error('mutant-list 요소를 찾을 수 없음'); slot.loading = false; return; }

  listEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏳</div>
      <p class="muted">돌연변이 영상을 분석하는 중... (${getPeriodText(window.videosState.currentPeriod)})</p>
    </div>`;

  let progressWrap = null;

  try {
    if (!(window.hasKeys && window.hasKeys())) {
      if (myToken !== slot.token) return;
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔑</div>
          <p class="muted">먼저 API 키를 설정해주세요. 우상단의 <b>🔑 API 키</b> 버튼을 클릭하세요.</p>
        </div>`;
      return;
    }

    const channels = await getAllChannels();
    const total = channels.length || 0;

    if (myToken !== slot.token) return;
    if (!total) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🚀</div>
          <p class="muted">채널을 먼저 추가해주세요.<br>구독자 대비 높은 조회수(돌연변이지수)를 가진 영상을 찾습니다.</p>
        </div>`;
      return;
    }

    progressWrap = mountProgress(listEl, '돌연변이 분석 중', total);

    const perChannelMax = 6;
    const all = [];
    let done = 0;

    for (const ch of channels) {
      if (myToken !== slot.token) return;
      try {
        const vids = await getChannelRecentLongformVideos(ch, perChannelMax);
        all.push(...vids);
      } catch (e) {
        console.warn('채널 영상 조회 실패:', ch?.title, e);
      } finally {
        done += 1;
        if (myToken !== slot.token) return;
        updateProgress(progressWrap, done, total);
      }
    }

    if (myToken !== slot.token) return;
    finishProgress(progressWrap, '지수 계산/정렬 중…');

    let videos = filterVideosByDate(all, window.videosState.currentPeriod);

    videos.forEach(v => {
      const views = parseInt(v.statistics?.viewCount || '0', 10);
      const subs = v.__channel?.subscribers || 0;
      v.__mutant = ratioSafe(views, subs);
    });

    const sort = window.videosState.currentSort;
    videos.sort((a, b) => {
      const av = parseInt(a.statistics?.viewCount || '0', 10);
      const bv = parseInt(b.statistics?.viewCount || '0', 10);
      const as = a.__channel?.subscribers || 0;
      const bs = b.__channel?.subscribers || 0;
      const ap = new Date(a.snippet?.publishedAt || 0).getTime();
      const bp = new Date(b.snippet?.publishedAt || 0).getTime();
      const aIdx = a.__mutant || 0;
      const bIdx = b.__mutant || 0;

      switch (sort) {
        case 'views': return bv - av;
        case 'subscribers': return bs - as;
        case 'latest': return bp - ap;
        case 'mutantIndex':
        default: return bIdx - aIdx;
      }
    });

    if (myToken !== slot.token) return;
    listEl.innerHTML = '';
    renderVideoCards(listEl, videos);

    const kwBox = document.getElementById('mutant-keywords');
    if (kwBox) {
      const keywords = window.extractKeywords
        ? window.extractKeywords(videos.map(v => v.snippet?.title || '').join(' '))
        : [];
      kwBox.innerHTML = keywords.map(w => `<span class="kw">${w}</span>`).join('') || '';
    }
  } catch (e) {
    if (myToken !== slot.token) return;
    console.error('돌연변이 탭 오류:', e);
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p class="muted">영상을 불러오는 중 오류가 발생했습니다: ${e?.message || e}</p>
      </div>`;
  } finally {
    if (myToken === slot.token) slot.loading = false;
  }
}

// ============================================================================
// 렌더링
// ============================================================================
function renderVideoCards(container, videos) {
  if (!videos || videos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📱</div>
        <p class="muted">표시할 영상이 없습니다.</p>
      </div>`;
    return;
  }

  const limit = 30;
  const sliced = videos.slice(0, limit);

  const html = sliced.map(v => {
    const ch = v.__channel || {};
    const title = v.snippet?.title || '(제목 없음)';
    const videoId = v.id || v.contentDetails?.videoId || '';
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const thumb =
      v.snippet?.thumbnails?.maxres?.url ||
      v.snippet?.thumbnails?.standard?.url ||
      v.snippet?.thumbnails?.high?.url ||
      v.snippet?.thumbnails?.medium?.url ||
      v.snippet?.thumbnails?.default?.url || '';
    const chThumb = ch.thumbnail || 'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj';
    const views = numberWithCommas(v.statistics?.viewCount);
    const published = moment(v.snippet?.publishedAt).format('YYYY-MM-DD');
    const mutIdx = v.__mutant != null ? v.__mutant.toFixed(2) : ratioSafe(v.statistics?.viewCount, ch.subscribers).toFixed(2);

    return `
      <div class="video-card">
        <a class="video-link" href="${url}" target="_blank" rel="noopener">
          <div class="thumb-wrap">
            <img class="thumb" src="${thumb}" alt="${title}"
                 onerror="this.src='https://i.ytimg.com/vi/${videoId}/hqdefault.jpg'">
          </div>
          <div class="video-body">
            <div class="title">${title}</div>

            <div class="meta">
              <img src="${chThumb}" alt="${ch.title || 'channel'}"
                   onerror="this.src='https://yt3.ggpht.com/a/default-user=s48-c-k-c0x00ffffff-no-rj'">
              <span>${ch.title || '-'}</span>
            </div>

            <div class="v-meta">
              <div class="v-meta-top">
                <span>조회수 ${views}</span>
                <span class="upload-date">${published}</span>
                <span class="mutant-indicator">지수 ${mutIdx}</span>
              </div>
            </div>
          </div>
        </a>
      </div>`;
  }).join('');

  container.innerHTML = html;
}

// ============================================================================
// 섹션 초기화 & 외부 래퍼
// ============================================================================
function initializeVideosSection() {
  console.log('영상분석 섹션 초기화');
  initializeVideoTabs();
  initializePeriodButtons();
  initializeSortFilter();
  loadVideoTabData('latest');  // 첫 진입은 최신영상
  console.log('영상분석 섹션 초기화 완료');
}

// index.html 진단 로그에서 요구하는 얇은 래퍼
window.refreshVideos = function () {
  const tab = (window.videosState && window.videosState.currentTab) || 'latest';
  loadVideoTabData(tab);
};

// 전역 공개
window.initializeVideosSection = initializeVideosSection;

console.log('videos.js 로딩 완료');
