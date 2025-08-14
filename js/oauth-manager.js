// oauth-manager.js — OAuth2 (GIS Code + PKCE) 기본, TokenClient는 보조
console.log('oauth-manager.js 로딩 시작');

/**
 * 무엇을 하나요?
 * - 권장 플로우: GIS Code Client(Authorization Code + PKCE, ux: redirect) → oauth-callback.html에서 교환
 * - 토큰/만료/리프레시토큰 localStorage 저장 및 자동 갱신
 * - 버튼 로그인은 항상 Code+PKCE로 안정 발급
 * - (보조) Token Client 무소음 시도는 있되 실패해도 사용자에게 방해 안 함
 * - ytAuth()/oauthFetch() 헬퍼 제공
 *
 * 교체/설정:
 *   1) CLIENT_ID, REDIRECT_URI 값을 실제로 교체
 *   2) Google Cloud Console
 *      - Authorized JavaScript origins : https://YOUR.DOMAIN  (또는 http://localhost:PORT)
 *      - Authorized redirect URIs     : https://YOUR.DOMAIN/oauth-callback.html
 */

(function () {
  // ==============================
  // 설정
  // ==============================
  const CLIENT_ID   = '1024944960226-7af4jsut8gquqs6omtibdqla7qurefls.apps.googleusercontent.com'; // ← 반드시 교체
  const REDIRECT_URI = 'https://YOUR.DOMAIN/oauth-callback.html'; // ← 반드시 교체 (정확한 경로)

  const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
  const STORAGE_KEY = 'yt_oauth_v2';           // { access_token, expires_at, refresh_token? }
  const RETURN_TO_KEY = 'yt_oauth_return_to';  // 로그인 전 위치 복귀용
  const PKCE_KEY = 'yt_pkce_verifier';         // code_verifier 저장

  // ==============================
  // 유틸(저장/시간)
  // ==============================
  function saveState(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {})); }
    catch (e) { console.warn('OAuth state save failed', e); }
  }
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }
  function clearState() { saveState({}); }

  function secLeft(exp) {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, (exp || 0) - now);
  }

  // 안전 경고: file:// 로 열면 OAuth가 동작하지 않습니다.
  function warnIfFileOrigin() {
    if (location.origin === 'null' || location.protocol === 'file:') {
      console.warn('[OAuth] file:// 에서는 동작하지 않습니다. 로컬 서버(예: http://localhost:5173)로 실행하세요.');
      window.toast && window.toast('file:// 에서는 Google 로그인 불가. 로컬 서버에서 실행하세요.', 'error');
    }
  }

  // ==============================
  // GIS 로딩
  // ==============================
  async function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ==============================
  // Token Client (보조: 무소음 시도 용)
  // ==============================
  function initTokenClient() {
    if (window._tokenClient) return;
    window._tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      prompt: '',   // 호출 시 지정
      callback: () => {}
    });
  }

  async function trySilentToken() {
    try {
      initTokenClient();
      const tok = await new Promise((resolve, reject) => {
        window._tokenClient.callback = (resp) => {
          if (resp && resp.access_token) {
            const expiresAt = Math.floor(Date.now() / 1000) + (resp.expires_in || 3600);
            saveState({ access_token: resp.access_token, expires_at: expiresAt });
            return resolve(resp.access_token);
          }
          return reject(new Error(resp?.error || 'silent_failed'));
        };
        window._tokenClient.requestAccessToken({ prompt: 'none' });
      });
      return tok || null;
    } catch {
      return null;
    }
  }

  // ==============================
  // Code Client (주플로우: PKCE)
  // ==============================
  function base64url(uint8) {
    return btoa(String.fromCharCode(...new Uint8Array(uint8)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function createPkce() {
    const arr = new Uint8Array(64);
    crypto.getRandomValues(arr);
    const verifier = base64url(arr);
    const enc = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', enc);
    const challenge = base64url(new Uint8Array(digest));
    sessionStorage.setItem(PKCE_KEY, verifier);
    return { verifier, challenge };
  }

  function initCodeClient(challenge) {
    return window.google.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ux_mode: 'redirect',        // 리디렉트가 가장 호환성 좋음
      redirect_uri: REDIRECT_URI, // GCP에 등록된 URI와 정확히 일치해야 함
      state: 'ytapp-' + Math.random().toString(36).slice(2),
      prompt: 'consent',
      access_type: 'offline',     // refresh_token 요청
      include_granted_scopes: true,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
  }

  async function startPkceLogin() {
    warnIfFileOrigin();
    await loadGis();
    const { challenge } = await createPkce();
    // 로그인 전 현재 위치 저장(완료 후 돌아오기)
    try { sessionStorage.setItem(RETURN_TO_KEY, location.href); } catch {}
    const codeClient = initCodeClient(challenge);
    codeClient.requestCode(); // → google → REDIRECT_URI(oauth-callback.html) → 토큰교환 → 원래 페이지로 복귀
  }

  // ==============================
  // 토큰 갱신(Refresh Token)
  // ==============================
  async function refreshAccessToken() {
    const st = loadState();
    const rt = st.refresh_token;
    if (!rt) return null;

    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: rt
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!res.ok) {
      console.warn('리프레시 토큰 갱신 실패', await res.text());
      return null;
    }

    const j = await res.json();
    const expiresAt = Math.floor(Date.now() / 1000) + (j.expires_in || 3600);
    saveState({
      access_token: j.access_token,
      expires_at: expiresAt,
      refresh_token: rt // 기존 값 유지
    });
    return j.access_token || null;
  }

  // ==============================
  // 퍼블릭 API
  // ==============================
  async function initOAuthManager() {
    warnIfFileOrigin();
    await loadGis();

    // 페이지 진입 시: 1) 캐시 2) 만료 임박이면 refresh_token 3) 그래도 없으면 무소음 토큰 시도(성공 시만 저장)
    const st = loadState();
    if (st.access_token && secLeft(st.expires_at) > 60) {
      console.log('OAuth: 기존 토큰 사용');
      return;
    }
    if (st.refresh_token) {
      const t = await refreshAccessToken();
      if (t) { console.log('OAuth: 리프레시 토큰으로 갱신'); return; }
    }
    // 조용히만 시도 — 실패해도 사용자 방해 X
    await trySilentToken();
  }

  async function oauthSignIn() {
    // 버튼 클릭: 안정적인 PKCE 로그인으로 바로 진행
    await startPkceLogin();
    // 이후 동작은 oauth-callback.html에서 완료됩니다.
  }

  function oauthSignOut() {
    clearState();
    window.toast && window.toast('Google 로그아웃 완료', 'info');
  }

  function getAccessToken() {
    const st = loadState();
    return (st.access_token && secLeft(st.expires_at) > 10) ? st.access_token : null;
  }

  // 유효 토큰 보장
  async function ensureAccessToken(silentOnly = false) {
    const cache = getAccessToken();
    if (cache) return cache;

    // 만료/없음 → refresh 시도
    const st = loadState();
    if (st.refresh_token) {
      const t = await refreshAccessToken();
      if (t) return t;
    }

    if (silentOnly) return null;

    // 사용자 인터랙션 필요 → PKCE 로그인 시작
    await startPkceLogin();
    // 여기 도달하지 않습니다(redirect). 임시 null 반환.
    return null;
  }

  // 인증 fetch
  async function oauthFetch(url, init = {}) {
    const token = await ensureAccessToken(false);
    if (!token) throw new Error('로그인이 필요합니다.');
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  }

  // YouTube API (인증 필요)
  async function ytAuth(endpoint, params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (v === true) q.set(k, 'true');
      else if (v === false) q.set(k, 'false');
      else q.set(k, String(v));
    });
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${q.toString()}`;
    const res = await oauthFetch(url);
    if (!res.ok) {
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
