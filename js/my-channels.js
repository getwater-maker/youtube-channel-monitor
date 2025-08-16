// my-channels.js — "내 채널들" UI/동작(팝업 OAuth 대응, 전역 클릭 위임, 안내 강화)
console.log('my-channels.js 로딩 시작');

window.myChannelsState = window.myChannelsState || {
  initialized: false,
  list: [] // { id, title, thumbnail, subscriberCount, uploadsPlaylistId }
};

// ===== 안전 토스트(전역 toast와 이름 충돌 방지) =====
const showToast = (msg, type) => {
  try {
    if (typeof window.toast === 'function' && window.toast !== showToast) {
      return window.toast(msg, type); // common.js의 전역 toast 사용
    }
  } catch {}
  // 전역 toast가 없거나, 우연히 자기 자신일 때는 alert로 폴백
  alert(msg);
};

// ---- 유틸 ----
function $id(id) { return document.getElementById(id); }
function formatNumber(n) {
  const v = Number(n || 0);
  return isNaN(v) ? '0' : v.toLocaleString('ko-KR');
}

// 섹션 요소 확보(없어도 안전하게 작동)
function ensureMyChannelsLayout() {
  const root = document.getElementById('section-my-channels') || document;

  // 상태 표시
  let status = $id('mych-status');
  if (!status) {
    const hdr = root.querySelector('.mych-controls') || root.querySelector('.section-header') || root;
    const span = document.createElement('span');
    span.id = 'mych-status';
    span.style.cssText = 'margin-left:8px;color:var(--muted);font-weight:600;';
    span.textContent = '로그인 필요';
    hdr.appendChild(span);
    status = span;
  }

  // 리스트 컨테이너
  let list = $id('my-channels-list');
  if (!list) {
    list = document.createElement('div');
    list.id = 'my-channels-list';
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

  return { list, empty, status };
}

function setStatus(text) {
  const { status } = ensureMyChannelsLayout();
  status.textContent = text || '';
}

function reflectLoginStatus() {
  const token = (window.getAccessToken && window.getAccessToken()) || null;
  const btnSignin  = $id('btn-oauth-signin');
  const btnSignout = $id('btn-oauth-signout');
  if (btnSignin)  btnSignin.style.display  = token ? 'none' : '';
  if (btnSignout) btnSignout.style.display = token ? '' : 'none';
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
  // subscriptions.list → channelId 모으고 → channels.list로 상세
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

// ---- IndexedDB 저장(모니터링 목록에 추가) ----
async function addToMonitored(channel) {
  try {
    if (typeof idbGet === 'function' && typeof idbSet === 'function') {
      const existing = await idbGet('my_channels', channel.id);
      if (existing) { showToast('이미 모니터링 중인 채널입니다.', 'info'); return; }
      await idbSet('my_channels', channel.id, channel);
      showToast('모니터링 목록에 추가되었습니다.', 'success');
      if (typeof window.getAllChannels === 'function') {
        await window.getAllChannels(true);
      }
    } else {
      showToast('저장소가 준비되지 않았습니다.', 'error');
    }
  } catch (e) {
    console.error('채널 저장 실패', e);
    showToast('채널 저장에 실패했습니다.', 'error');
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

// ---- 내보내기 ----
async function exportAllJSON() {
  try {
    let data = [];
    if (window.myChannelsState.list?.length) {
      data = window.myChannelsState.list;
    } else if (typeof window.getAllChannels === 'function') {
      data = await window.getAllChannels(true);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'channels-export.json'; a.click();
    URL.revokeObjectURL(url);
    showToast(`내보내기 완료 (${data.length}개)`, 'success');
  } catch (e) {
    console.error(e);
    showToast('내보내기에 실패했습니다.', 'error');
  }
}

// ---- 데모 채널(로그인 없이 체험) ----
function loadDemo() {
  const demo = [
    { id:'UC_x5XG1OV2P6uZZ5FSM9Ttw', title:'Google Developers', thumbnail:'https://yt3.ggpht.com/ytc/AKedOLRk-demo=s88-c-k-c0x00ffffff-no-rj', subscriberCount:1000000, uploadsPlaylistId:'' },
    { id:'UCE_M8A5yxnLfW0KghEeajjw', title:'Apple',             thumbnail:'https://yt3.ggpht.com/ytc/AKedOLRk-demo2=s88-c-k-c0x00ffffff-no-rj', subscriberCount:18000000, uploadsPlaylistId:'' }
  ];
  window.myChannelsState.list = demo;
  renderChannelList(demo);
  setStatus('데모 채널 2개 표시 (로그인 필요 없음)');
}

// ---- 버튼(전역 위임) 바인딩 ----
function bindMyChannelsEventsOnce() {
  if (document.body.dataset.mychDelegated === '1') return;
  document.body.dataset.mychDelegated = '1';

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('button, a');
    if (!el) return;

    const id = el.id || '';
    const label = (el.textContent || '').trim();

    const isSignin   = ['btn-oauth-signin'].includes(id) || /google\s*로그인/i.test(label) || /채널\s*연동/i.test(label);
    const isSignout  = ['btn-oauth-signout'].includes(id) || /로그아웃/i.test(label);
    const isLoadMine = ['btn-load-my-channel'].includes(id) || /내\s*채널\s*불러오기/i.test(label);
    const isLoadSubs = ['btn-load-subscriptions'].includes(id) || /내\s*구독\s*불러오기/i.test(label);
    const isExport   = ['btn-export-all'].includes(id) || /전체\s*내보내기/i.test(label);
    const isDemo     = ['btn-demo'].includes(id) || /데모\s*체험/i.test(label);

    if (!(isSignin || isSignout || isLoadMine || isLoadSubs || isExport || isDemo)) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      if (isSignin) {
        console.log('[내채널] Google 로그인/채널연동 버튼 클릭');
        await window.oauthSignIn();
        reflectLoginStatus();             // ← 로그인 후 즉시 UI 갱신
        return;
      }
      if (isSignout) {
        window.oauthSignOut && window.oauthSignOut();
        reflectLoginStatus();
        renderChannelList([]);
        return;
      }
      if (isDemo) {
        loadDemo();
        return;
      }
      if (isExport) {
        await exportAllJSON();
        return;
      }
      if (isLoadMine) {
        setStatus('내 채널 불러오는 중…');
        const list = await fetchMyChannel();
        window.myChannelsState.list = list;
        renderChannelList(list);
        setStatus(`내 채널 ${list.length}개 로드`);
        return;
      }
      if (isLoadSubs) {
        setStatus('내 구독 불러오는 중…');
        const list = await fetchMySubscriptions();
        window.myChannelsState.list = list;
        renderChannelList(list);
        setStatus(`구독 채널 ${list.length}개 로드`);
        return;
      }
    } catch (err) {
      console.error('버튼 처리 중 오류:', err);
      const msg = String(err?.message || err || '');
      if (/SERVICE_DISABLED|accessNotConfigured|youtube\.googleapis\.com\/overview/i.test(msg)) {
        showToast('YouTube Data API v3가 이 프로젝트에서 꺼져있습니다. GCP에서 Enable 후 다시 시도하세요.', 'error');
      } else if (/insufficientPermissions|forbidden|403/i.test(msg)) {
        showToast('권한 오류입니다. 동의 화면에서 권한을 허용했는지 확인해 주세요.', 'error');
      } else {
        showToast(msg, 'error');
      }
      setStatus('오류');
    }
  }, true);

  // OAuth 이벤트로도 UI 갱신
  window.addEventListener('oauth:login', reflectLoginStatus);
  window.addEventListener('oauth:logout', reflectLoginStatus);

  console.log('내채널 전역 클릭 위임 바인딩 완료');
}

// ---- 초기화 ----
async function initializeMyChannels() {
  console.log('내채널 초기화 시작');
  ensureMyChannelsLayout();
  bindMyChannelsEventsOnce();

  try { await window.initOAuthManager?.(); } catch (e) { console.warn('OAuth 매니저 초기화 실패', e); }
  reflectLoginStatus();

  // 기존 저장 채널 안내
  try {
    if (typeof window.getAllChannels === 'function') {
      const existing = await window.getAllChannels();
      if (existing && existing.length) {
        setStatus(`이미 모니터링 중: ${existing.length}개 · 상단 버튼으로 내 구독을 불러오세요`);
      }
    }
  } catch {}

  console.log('내채널 초기화 완료');
}

// 전역 공개
window.initializeMyChannels = initializeMyChannels;

console.log('my-channels.js 로딩 완료');
