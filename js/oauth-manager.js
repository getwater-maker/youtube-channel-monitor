// oauth-manager.js — Google Identity Services Token Client(팝업) OAuth
// - 정적 호스팅(GitHub Pages)에서도 동작
// - client_secret 불필요
// - 로그인/로그아웃 시 커스텀 이벤트('oauth:login' / 'oauth:logout')를 발생시켜 UI가 즉시 갱신되도록 함
console.log('oauth-manager.js 로딩 시작');

(function () {
  // ===== 설정 =====
  // 1) 여기에 본인 OAuth 웹 클라이언트 ID를 넣거나
  // 2) 비워두면 첫 로그인 때 입력을 받아 localStorage('yt_client_id')에 저장합니다.
  let CLIENT_ID = '1024944960226-7af4jsut8gquqs6omtibdqla7qurefls.apps.googleusercontent.com'; // 예: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com'
  const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

  const STORAGE_KEY = 'yt_oauth_v2';   // { access_token, expires_at }
  const CID_KEY     = 'yt_client_id';  // CLIENT_ID 저장

  // ===== 상태 저장 유틸 =====
  function saveState(d){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(d||{})); }catch{} }
  function loadState(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); }catch{ return {}; } }
  function clearState(){ saveState({}); }
  function secLeft(exp){ const now=Math.floor(Date.now()/1000); return Math.max(0,(exp||0)-now); }

  // CLIENT_ID 확보: 상수 → localStorage → 사용자 입력
  function resolveClientId(interactiveIfMissing = false) {
    let cid = CLIENT_ID;
    if (!cid) cid = localStorage.getItem(CID_KEY) || '';
    if (!cid && interactiveIfMissing) {
      cid = (prompt('Google OAuth 웹 클라이언트 ID(…apps.googleusercontent.com):') || '').trim();
      if (cid) localStorage.setItem(CID_KEY, cid);
    }
    if (cid && !CLIENT_ID) CLIENT_ID = cid;
    return cid;
  }

  // ===== GIS 스크립트 로드 =====
  async function loadGis(){
    if (window.google?.accounts?.oauth2) return;
    await new Promise((res, rej)=>{
      const s=document.createElement('script');
      s.src='https://accounts.google.com/gsi/client';
      s.async=true; s.defer=true; s.onload=res; s.onerror=rej;
      document.head.appendChild(s);
    });
  }

  // ===== Token Client =====
  function createTokenClient() {
    const cid = resolveClientId(true);
    if (!cid) throw new Error('CLIENT_ID가 필요합니다.');
    return window.google.accounts.oauth2.initTokenClient({
      client_id: cid,
      scope: SCOPE,
      callback: () => {} // 요청마다 동적 지정
    });
  }

  let tokenClient = null;

  // 인터랙티브 토큰 요청(팝업)
  function requestInteractiveToken(promptMode = 'consent') {
    return new Promise((resolve, reject) => {
      try {
        if (!tokenClient) tokenClient = createTokenClient();
        tokenClient.callback = (resp) => {
          if (resp && resp.access_token) {
            const expiresAt = Math.floor(Date.now()/1000) + (resp.expires_in || 3600);
            const data = { access_token: resp.access_token, expires_at: expiresAt };
            saveState(data);
            // 로그인 이벤트 전파(다른 스크립트가 UI 갱신)
            window.dispatchEvent(new CustomEvent('oauth:login', { detail: data }));
            return resolve(resp.access_token);
          }
          const err = resp?.error || 'unknown_error';
          const subtype = resp?.error_subtype || '';
          console.warn('토큰 발급 오류', resp);
          if (err === 'access_denied' || subtype === 'access_denied') {
            return reject(new Error('권한이 거부되었습니다. 요청을 허용해야 데이터를 불러올 수 있어요.'));
          }
          if (err === 'popup_closed_by_user') {
            return reject(new Error('로그인 창이 닫혔습니다. 다시 시도해 주세요.'));
          }
          reject(new Error(err));
        };
        tokenClient.requestAccessToken({ prompt: promptMode, include_granted_scopes: true });
      } catch (e) { reject(e); }
    });
  }

  // ===== 퍼블릭 API =====
  async function initOAuthManager(){
    await loadGis();
    // 캐시 토큰이 아직 유효하면 로그인 이벤트 한번 쏴줘서 UI가 즉시 갱신되게 함
    const st = loadState();
    if (st?.access_token && secLeft(st.expires_at) > 10) {
      window.dispatchEvent(new CustomEvent('oauth:login', { detail: st }));
    }
    console.log('OAuth 매니저 초기화 완료(토큰 팝업 방식).');
  }

  async function oauthSignIn(){
    await initOAuthManager();
    const tok = await requestInteractiveToken('consent');  // 명시적 동의로 안정 발급
    window.toast && window.toast('Google 로그인 완료', 'success');
    return tok;
  }

  function oauthSignOut(){
    clearState();
    window.toast && window.toast('Google 로그아웃 완료', 'info');
    window.dispatchEvent(new CustomEvent('oauth:logout'));
  }

  function getAccessToken(){
    const st = loadState();
    return (st?.access_token && secLeft(st.expires_at)>10) ? st.access_token : null;
  }

  // 유효 토큰 보장: 없거나 만료면 팝업으로 재발급
  async function ensureAccessToken(){
    const cache = getAccessToken();
    if (cache) return cache;
    await initOAuthManager();
    return requestInteractiveToken('consent');
  }

  // 인증 fetch/YouTube API 헬퍼
  async function oauthFetch(url, init={}){
    const token = await ensureAccessToken();
    const headers = new Headers(init.headers||{});
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  }

  async function ytAuth(endpoint, params={}){
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k,v])=>{
      if (v===undefined || v===null) return;
      q.set(k, v===true?'true': v===false?'false': String(v));
    });
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${q.toString()}`;
    const res = await oauthFetch(url);
    if (!res.ok){
      const text = await res.text();
      throw new Error(`YouTube API 오류(${res.status}): ${text}`);
    }
    return res.json();
  }

  // 전역 공개
  window.initOAuthManager  = initOAuthManager;
  window.oauthSignIn       = oauthSignIn;
  window.oauthSignOut      = oauthSignOut;
  window.getAccessToken    = getAccessToken;
  window.ensureAccessToken = ensureAccessToken;
  window.oauthFetch        = oauthFetch;
  window.ytAuth            = ytAuth;
})();
console.log('oauth-manager.js 로딩 완료');
