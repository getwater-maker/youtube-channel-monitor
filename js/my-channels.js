// my-channels.js — "내 채널들" 실제 동작 + 버튼 위임(전역 클릭)으로 어떤 마크업에서도 동작
console.log('my-channels.js 로딩 시작');

/**
 * 무엇을 하나요?
 * - Google 로그인/로그아웃, 내 채널/내 구독 불러오기
 * - "모니터링에 추가" 버튼으로 IndexedDB 저장
 * - 버튼이 다른 ID/구조여도 전역 클릭 위임으로 동작 (텍스트 매칭 포함)
 *
 * 필요 전역:
 *   - window.initOAuthManager, window.oauthSignIn, window.oauthSignOut, window.ytAuth  (oauth-manager.js)
 *   - idbGet(id), idbSet(id, value), getAllChannels()     (common.js / channels.js)
 *   - window.toast(message, type?)                         (common.js)
 */

window.myChannelsState = window.myChannelsState || {
  initialized: false,
  list: [] // { id, title, thumbnail, subscriberCount, uploadsPlaylistId }
};

// ---- 유틸 ----
function $id(id) { return document.getElementById(id); }
function getSectionRoot() {
  return $id('section-my-channels', 'my-channels-section') || document;
}
function formatNumber(n) {
  const v = Number(n || 0);
  return isNaN(v) ? '0' : v.toLocaleString('ko-KR');
}

// ---- 레이아웃 보장 (없으면 만들어 줌) ----
function ensureMyChannelsLayout() {
  const root = getSectionRoot();

  // 상단 컨트롤(버튼들)
  let controls = root.querySelector('.mych-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.className = 'mych-controls';
    controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center;';
    controls.innerHTML = `
      <button id="btn-oauth-signin" class="btn btn-primary" type="button">Google 로그인</button>
      <button id="btn-oauth-signout" class="btn btn-secondary" type="button" style="display:none">로그아웃</button>
      <button id="btn-load-my-channel" class="btn btn-secondary" type="button">내 채널 불러오기</button>
      <button id="btn-load-subscriptions" class="btn btn-secondary" type="button">내 구독 불러오기</button>
      <span id="mych-status" style="margin-left:auto;color:var(--muted);font-weight:600;">로그인 필요</span>
    `;
    const sectionHeader = root.querySelector('.section-header');
    if (sectionHeader && sectionHeader.parentElement) {
      sectionHeader.parentElement.insertBefore(controls, sectionHeader.nextSibling);
    } else {
      root.prepend(controls);
    }
  } else {
    // 기존 마크업이라도 type 보정
    ['btn-oauth-signin','btn-oauth-signout','btn-load-my-channel','btn-load-subscriptions'].forEach(id=>{
      const el = $id(id); if (el && !el.getAttribute('type')) el.setAttribute('type','button');
    });
  }

  // 리스트 컨테이너
  let list = $id('my-channels-list');
  if (!list) {
    list = document.createElement('div');
    list.id = 'my-channels-list';
    list.className = 'channel-list horizontal-grid';
    const section = root.querySelector('.section') || root;
    section.appendChild(list);
  }

  // 빈 상태
  let empty = $id('mych-empty');
  if (!empty) {
    empty = document.createElement('div');
    empty.id = 'mych-empty';
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-icon">🙂</div>
      <p class="muted">Google 로그인 후 <b>내 채널/내 구독</b>을 불러올 수 있어요.</p>`;
    list.parentElement.insertBefore(empty, list);
  }

  return { controls, list, empty, status: $id('mych-status') };
}

// ---- 상태 표시 ----
function setStatus(text) {
  const { status } = ensureMyChannelsLayout();
  if (status) status.textContent = text || '';
}
function reflectLoginStatus() {
  const token = (window.getAccessToken && window.getAccessToken()) || null;
  const signIn  = $id('btn-oauth-signin');
  const signOut = $id('btn-oauth-signout');
  if (signIn)  signIn.style.display  = token ? 'none' : '';
  if (signOut) signOut.style.display = token ? '' : 'none';
  setStatus(token ? '로그인됨' : '로그인 필요');
}

// ---- API 호출 ----
async function fetchMyChannel() {
  const j = await window.ytAuth('channels', {
    part: 'snippet,contentDetails,statistics',
    mine: true,
    maxResults: 50
  });
  const out = [];
  for (const it of (j.items || [])) {
    const uploads = it.contentDetails?.relatedPlaylists?.uploads || '';
    out.push({
      id: it.id,
      title: it.snippet?.title || '(제목 없음)',
      thumbnail:
        it.snippet?.thumbnails?.high?.url ||
        it.snippet?.thumbnails?.medium?.url ||
        it.snippet?.thumbnails?.default?.url ||
        'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj',
      subscriberCount: parseInt(it.statistics?.subscriberCount || '0', 10),
      uploadsPlaylistId: uploads
    });
  }
  return out;
}

async function fetchMySubscriptions() {
  // subscriptions.list → channelId 모으고 → channels.list 로 상세
  const ids = [];
  let pageToken = undefined;
  while (true) {
    const s = await window.ytAuth('subscriptions', {
      part: 'snippet',
      mine: true,
      maxResults: 50,
      ...(pageToken ? { pageToken } : {})
    });
    (s.items || []).forEach(it => {
      const id = it.snippet?.resourceId?.channelId;
      if (id) ids.push(id);
    });
    if (!s.nextPageToken) break;
    pageToken = s.nextPageToken;
  }
  if (!ids.length) return [];

  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const cj = await window.ytAuth('channels', {
      part: 'snippet,contentDetails,statistics',
      id: batch.join(',')
    });
    (cj.items || []).forEach(it => {
      const uploads = it.contentDetails?.relatedPlaylists?.uploads || '';
      out.push({
        id: it.id,
        title: it.snippet?.title || '(제목 없음)',
        thumbnail:
          it.snippet?.thumbnails?.high?.url ||
          it.snippet?.thumbnails?.medium?.url ||
          it.snippet?.thumbnails?.default?.url ||
          'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj',
        subscriberCount: parseInt(it.statistics?.subscriberCount || '0', 10),
        uploadsPlaylistId: uploads
      });
    });
  }
  return out;
}

// ---- IndexedDB 저장 ----
async function addToMonitored(channel) {
  try {
    const existing = await idbGet('my_channels', channel.id);
    if (existing) {
      window.toast && window.toast('이미 모니터링 중인 채널입니다.', 'info');
      return;
    }
    await idbSet('my_channels', channel.id, channel);
    window.toast && window.toast('모니터링 목록에 추가되었습니다.', 'success');
    if (typeof window.getAllChannels === 'function') {
      await window.getAllChannels(true);
    }
  } catch (e) {
    console.error('채널 저장 실패', e);
    window.toast && window.toast('채널 저장에 실패했습니다.', 'error');
  }
}

// ---- 렌더링 ----
function renderChannelList(list) {
  const { empty } = ensureMyChannelsLayout();
  const wrap = $id('my-channels-list');
  if (!wrap) return;

  if (!list || list.length === 0) {
    if (empty) empty.style.display = '';
    wrap.innerHTML = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  wrap.innerHTML = list.map(ch => `
    <div class="channel-card">
      <img class="channel-thumb" src="${ch.thumbnail}"
           alt="${ch.title}"
           onerror="this.src='https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj'">
      <div class="channel-meta">
        <h3 title="${ch.title}">
          <a href="https://www.youtube.com/channel/${ch.id}" target="_blank" rel="noopener">${ch.title}</a>
        </h3>
        <div class="row">
          <div><strong>구독자</strong> ${formatNumber(ch.subscriberCount)}</div>
          <div><strong>ID</strong> ${ch.id}</div>
        </div>
        <div class="latest">업로드 플레이리스트: <code>${ch.uploadsPlaylistId || '-'}</code></div>
      </div>
      <div class="channel-actions">
        <button class="btn btn-primary" type="button" data-add="${ch.id}">모니터링에 추가</button>
      </div>
    </div>
  `).join('');

  // 개별 추가 버튼
  wrap.querySelectorAll('[data-add]').forEach(btn => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-add');
      const ch = list.find(x => x.id === id);
      if (ch) addToMonitored(ch);
    });
  });
}

// ---- 버튼(전역 위임) 바인딩 ----
function bindMyChannelsEventsOnce() {
  if (document.body.dataset.mychDelegated === '1') return;
  document.body.dataset.mychDelegated = '1';

  // 어떤 구조여도 동작하도록 전역 클릭 위임
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('button, a');
    if (!el) return;

    // id 우선
    const id = el.id || '';
    const label = (el.textContent || '').trim();

    // 어떤 버튼인지 판별
    const isSignin  = ['btn-oauth-signin'].includes(id) || /google\s*로그인/i.test(label);
    const isSignout = ['btn-oauth-signout'].includes(id) || /로그아웃/i.test(label);
    const isLoadMine= ['btn-load-my-channel'].includes(id) || /내\s*채널\s*불러오기/i.test(label);
    const isLoadSubs= ['btn-load-subscriptions'].includes(id) || /내\s*구독\s*불러오기/i.test(label);

    if (!(isSignin || isSignout || isLoadMine || isLoadSubs)) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      if (isSignin) {
        console.log('[내채널] Google 로그인 버튼 클릭 감지');
        await window.oauthSignIn();   // redirect 진행 (성공 시 콜백에서 돌아옴)
        return;
      }
      if (isSignout) {
        console.log('[내채널] 로그아웃 클릭');
        window.oauthSignOut && window.oauthSignOut();
        reflectLoginStatus();
        renderChannelList([]);
        return;
      }
      if (isLoadMine) {
        console.log('[내채널] 내 채널 불러오기 클릭');
        setStatus('내 채널 불러오는 중…');
        const list = await fetchMyChannel();
        window.myChannelsState.list = list;
        renderChannelList(list);
        setStatus(`내 채널 ${list.length}개 로드`);
        return;
      }
      if (isLoadSubs) {
        console.log('[내채널] 내 구독 불러오기 클릭');
        setStatus('내 구독 불러오는 중…');
        const list = await fetchMySubscriptions();
        window.myChannelsState.list = list;
        renderChannelList(list);
        setStatus(`구독 채널 ${list.length}개 로드`);
        return;
      }
    } catch (err) {
      console.error('버튼 처리 중 오류:', err);
      window.toast && window.toast((err && err.message) ? err.message : String(err), 'error');
      setStatus('오류');
    }
  }, true); // 캡처 단계에서 잡아서 다른 핸들러보다 먼저 처리

  console.log('내채널 전역 클릭 위임 바인딩 완료');
}

// ---- 초기화 ----
async function initializeMyChannels() {
  console.log('내채널 초기화 시작');

  ensureMyChannelsLayout();
  bindMyChannelsEventsOnce();

  try { await window.initOAuthManager?.(); } catch (e) { console.warn('OAuth 매니저 초기화 실패', e); }
  reflectLoginStatus();

  // 기존 저장 채널 간단 안내
  try {
    const existing = await getAllChannels();
    if (existing && existing.length) {
      setStatus(`이미 모니터링 중: ${existing.length}개 · 상단 버튼으로 내 구독을 불러오세요`);
    }
  } catch {}

  console.log('내채널 초기화 완료');
}

// 전역 공개
window.initializeMyChannels = initializeMyChannels;

console.log('my-channels.js 로딩 완료');
