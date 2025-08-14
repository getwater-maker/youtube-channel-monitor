// my-channels.js — 실제 동작하는 "내 채널" 구현 (내 채널/구독 채널 불러오기 → 모니터링에 추가)
console.log('my-channels.js 로딩 시작');

/**
 * ✨ 무엇을 하나요?
 * - Google 로그인 상태를 표시하고, 버튼으로 로그인/로그아웃 가능
 * - 내 채널(channels?mine=true)과 내 구독 목록(subscriptions?mine=true) 가져오기
 * - 가져온 채널을 카드로 렌더링하고, "모니터링에 추가" 버튼으로 IndexedDB에 저장
 *
 * ✅ 외부 의존
 *   - window.initOAuthManager, window.oauthSignIn, window.oauthSignOut, window.ytAuth (oauth-manager.js)
 *   - idbGet/idbSet/idbDel 등 IndexedDB 유틸(common.js에 있다고 가정)
 *   - getAllChannels(), saveChannel(channel) (channels.js/common.js 쪽에 있다고 가정)
 */

window.myChannelsState = window.myChannelsState || {
  initialized: false,
  loading: false,
  list: [] // {id,title,thumbnail,subscriberCount,uploadsPlaylistId}
};

// 안전한 DOM 선택자 얻기
function $id(...names) {
  for (const n of names) {
    const el = document.getElementById(n);
    if (el) return el;
  }
  return null;
}

// 섹션 루트 찾기(없으면 document 사용)
function getSectionRoot() {
  return $id('section-my-channels', 'my-channels-section') || document;
}

// UI 요소 찾기(부재 시 생성까지)
function ensureMyChannelsLayout() {
  const root = getSectionRoot();

  // 상단 컨트롤 박스
  let controls = root.querySelector('.mych-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.className = 'mych-controls';
    controls.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;';
    controls.innerHTML = `
      <button id="btn-oauth-signin" class="btn btn-primary">Google 로그인</button>
      <button id="btn-oauth-signout" class="btn btn-secondary">로그아웃</button>
      <button id="btn-load-my-channel" class="btn btn-secondary">내 채널 불러오기</button>
      <button id="btn-load-subscriptions" class="btn btn-secondary">내 구독 불러오기</button>
      <span id="mych-status" style="margin-left:auto; color:var(--muted); font-weight:600;"></span>
    `;

    // 섹션 헤더 바로 아래나 섹션 맨 위에 삽입
    const sectionHeader = root.querySelector('.section-header');
    if (sectionHeader && sectionHeader.parentElement) {
      sectionHeader.parentElement.insertBefore(controls, sectionHeader.nextSibling);
    } else {
      root.prepend(controls);
    }
  }

  // 목록 컨테이너
  let list = $id('my-channels-list', 'mychannels-list');
  if (!list) {
    list = document.createElement('div');
    list.id = 'my-channels-list';
    list.className = 'channel-list horizontal-grid';
    list.style.minHeight = '120px';
    // 섹션 본문에 삽입
    const section = getSectionRoot().querySelector('.section') || getSectionRoot();
    section.appendChild(list);
  }

  // 빈상태 컨테이너
  let empty = $id('mych-empty');
  if (!empty) {
    empty = document.createElement('div');
    empty.id = 'mych-empty';
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">🙂</div>
      <p class="muted">Google 로그인 후 <b>내 채널/내 구독</b>을 불러올 수 있어요.</p>
    `;
    list.parentElement.insertBefore(empty, list);
  }

  return { controls, list, empty, status: $id('mych-status') };
}

// 상태 텍스트
function setStatus(text) {
  const { status } = ensureMyChannelsLayout();
  if (status) status.textContent = text || '';
}

// 로그인 상태 배지
function reflectLoginStatus() {
  const has = !!(window.getAccessToken && window.getAccessToken());
  const signIn = $id('btn-oauth-signin');
  const signOut = $id('btn-oauth-signout');
  if (signIn) signIn.style.display = has ? 'none' : '';
  if (signOut) signOut.style.display = has ? '' : 'none';
  setStatus(has ? '로그인됨' : '로그인 필요');
}

// ==============================
// API: 내 채널/구독 가져오기
// ==============================

async function fetchMyChannel() {
  // channels.list?mine=true
  const j = await window.ytAuth('channels', {
    part: 'snippet,contentDetails,statistics',
    mine: true,
    maxResults: 50
  });

  const out = [];
  for (const it of (j.items || [])) {
    const uploadsId = it.contentDetails?.relatedPlaylists?.uploads || '';
    out.push({
      id: it.id,
      title: it.snippet?.title || '(제목 없음)',
      thumbnail:
        it.snippet?.thumbnails?.high?.url ||
        it.snippet?.thumbnails?.medium?.url ||
        it.snippet?.thumbnails?.default?.url ||
        'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj',
      subscriberCount: parseInt(it.statistics?.subscriberCount || '0', 10),
      uploadsPlaylistId: uploadsId
    });
  }
  return out;
}

async function fetchMySubscriptions() {
  // subscriptions.list?mine=true 로 채널ID 수집 → channels.list로 상세 조회
  const allChannelIds = [];
  let pageToken = '';

  while (true) {
    const j = await window.ytAuth('subscriptions', {
      part: 'snippet',
      mine: true,
      maxResults: 50,
      ...(pageToken ? { pageToken } : {})
    });

    (j.items || []).forEach(it => {
      const chId = it.snippet?.resourceId?.channelId;
      if (chId) allChannelIds.push(chId);
    });

    if (j.nextPageToken) pageToken = j.nextPageToken;
    else break;
  }

  if (!allChannelIds.length) return [];

  // 채널 상세 조회(50개씩)
  const out = [];
  for (let i = 0; i < allChannelIds.length; i += 50) {
    const batch = allChannelIds.slice(i, i + 50);
    const cj = await window.ytAuth('channels', {
      part: 'snippet,contentDetails,statistics',
      id: batch.join(',')
    });

    (cj.items || []).forEach(it => {
      const uploadsId = it.contentDetails?.relatedPlaylists?.uploads || '';
      out.push({
        id: it.id,
        title: it.snippet?.title || '(제목 없음)',
        thumbnail:
          it.snippet?.thumbnails?.high?.url ||
          it.snippet?.thumbnails?.medium?.url ||
          it.snippet?.thumbnails?.default?.url ||
          'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj',
        subscriberCount: parseInt(it.statistics?.subscriberCount || '0', 10),
        uploadsPlaylistId: uploadsId
      });
    });
  }

  return out;
}

// ==============================
// IndexedDB에 추가/중복 방지
// ==============================
async function addToMonitored(channel) {
  try {
    // 이미 저장돼 있나?
    const existing = await idbGet('my_channels', channel.id);
    if (existing) {
      window.toast && window.toast('이미 모니터링 중인 채널입니다.', 'info');
      return;
    }
    await idbSet('my_channels', channel.id, channel);
    window.toast && window.toast('모니터링 목록에 추가되었습니다.', 'success');

    // 외부에서 쓰는 getAllChannels()가 있다면 갱신
    if (typeof window.getAllChannels === 'function') {
      await window.getAllChannels(true); // optional refresh
    }
  } catch (e) {
    console.error('채널 저장 실패', e);
    window.toast && window.toast('채널 저장에 실패했습니다.', 'error');
  }
}

// ==============================
// 렌더링
// ==============================
function renderChannelList(channels) {
  const { list, empty } = ensureMyChannelsLayout();
  if (!list) return;

  if (!channels || channels.length === 0) {
    if (empty) empty.style.display = '';
    list.innerHTML = '';
    return;
  }

  if (empty) empty.style.display = 'none';

  const html = channels.map(ch => `
    <div class="channel-card">
      <img class="channel-thumb" src="${ch.thumbnail}"
           alt="${ch.title}"
           onerror="this.src='https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj'">
      <div class="channel-meta">
        <h3 title="${ch.title}">
          <a href="https://www.youtube.com/channel/${ch.id}" target="_blank" rel="noopener">${ch.title}</a>
        </h3>
        <div class="row">
          <div><strong>구독자</strong> ${Number(ch.subscriberCount || 0).toLocaleString('ko-KR')}</div>
          <div><strong>ID</strong> ${ch.id}</div>
        </div>
        <div class="latest">
          업로드 플레이리스트: <code>${ch.uploadsPlaylistId || '-'}</code>
        </div>
      </div>
      <div class="channel-actions">
        <button class="btn btn-primary" data-add="${ch.id}">모니터링에 추가</button>
      </div>
    </div>
  `).join('');

  list.innerHTML = html;

  // 버튼 바인딩
  list.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-add');
      const ch = channels.find(c => c.id === id);
      if (ch) addToMonitored(ch);
    });
  });
}

// ==============================
// 초기화/이벤트 바인딩
// ==============================
function bindMyChannelsEvents() {
  const signIn = $id('btn-oauth-signin');
  const signOut = $id('btn-oauth-signout');
  const loadMine = $id('btn-load-my-channel');
  const loadSubs = $id('btn-load-subscriptions');

  if (signIn && !signIn.dataset.bound) {
    signIn.dataset.bound = '1';
    signIn.addEventListener('click', async () => {
      try {
        await window.oauthSignIn();
        reflectLoginStatus();
      } catch (e) {
        window.toast && window.toast('로그인 실패: ' + e.message, 'error');
      }
    });
  }

  if (signOut && !signOut.dataset.bound) {
    signOut.dataset.bound = '1';
    signOut.addEventListener('click', () => {
      window.oauthSignOut();
      reflectLoginStatus();
      renderChannelList([]); // 목록 초기화
    });
  }

  if (loadMine && !loadMine.dataset.bound) {
    loadMine.dataset.bound = '1';
    loadMine.addEventListener('click', async () => {
      try {
        setStatus('내 채널 불러오는 중…');
        const list = await fetchMyChannel();
        window.myChannelsState.list = list;
        renderChannelList(list);
        setStatus(`내 채널 ${list.length}개 로드`);
      } catch (e) {
        console.error(e);
        window.toast && window.toast('내 채널 불러오기 실패: ' + e.message, 'error');
        setStatus('');
      }
    });
  }

  if (loadSubs && !loadSubs.dataset.bound) {
    loadSubs.dataset.bound = '1';
    loadSubs.addEventListener('click', async () => {
      try {
        setStatus('내 구독 불러오는 중…');
        const list = await fetchMySubscriptions();
        window.myChannelsState.list = list;
        renderChannelList(list);
        setStatus(`구독 채널 ${list.length}개 로드`);
      } catch (e) {
        console.error(e);
        window.toast && window.toast('내 구독 불러오기 실패: ' + e.message, 'error');
        setStatus('');
      }
    });
  }
}

async function initializeMyChannels() {
  console.log('내채널 초기화 시작');
  ensureMyChannelsLayout();
  bindMyChannelsEvents();

  // OAuth 매니저 준비 & 상태 반영
  try {
    await window.initOAuthManager?.();
  } catch (e) {
    console.warn('OAuth 매니저 초기화 실패', e);
  }
  reflectLoginStatus();

  // 첫 화면은 기존 저장 채널(모니터링 목록) 간단 표시 유도
  try {
    const existing = await getAllChannels();
    if (!existing.length) {
      renderChannelList([]);
    } else {
      // 저장 목록을 간단히 보여주되, "내 구독 불러오기"를 안내
      setStatus(`이미 모니터링 중: ${existing.length}개 · 상단 버튼으로 내 구독을 불러오세요`);
    }
  } catch {
    // 무시
  }

  console.log('내채널 초기화 완료');
}

// 전역 공개
window.initializeMyChannels = initializeMyChannels;

console.log('my-channels.js 로딩 완료');
