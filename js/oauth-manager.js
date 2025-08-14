// oauth-manager.js — Google Identity Services(OAuth2) 기반 로그인/토큰 관리 + 인증 API 헬퍼
console.log('oauth-manager.js 로딩 시작');

/**
 * ✨ 무엇을 하나요?
 * - Google 로그인 팝업을 열어 YouTube Data API v3 호출에 쓸 access_token을 받습니다.
 * - 토큰/만료 정보를 localStorage에 저장하고, 만료 임박 시 자동으로 새 토큰을 요청합니다(prompt: 'none').
 * - 인증이 필요한 API 호출을 위해 oauthFetch(), ytAuth() 헬퍼를 제공합니다.
 *
 * ✅ 외부에서 쓰는 주요 함수(전역):
 *   - initOAuthManager()        : 초기화(페이지 시작 시 1회)
 *   - oauthSignIn()             : 로그인(버튼에서 호출)
 *   - oauthSignOut()            : 로그아웃
 *   - getAccessToken()          : 현재 유효한 액세스 토큰(없으면 null)
 *   - ensureAccessToken()       : 유효 토큰 보장(필요시 무소음 재발급)
 *   - ytAuth(endpoint, params)  : 인증이 필요한 YouTube API 호출(ex: ytAuth('subscriptions',{mine:true,part:'snippet'}))
 *   - oauthFetch(url, init)     : Bearer 토큰 붙여 fetch
 */

(function () {
  // ==============================
  // 기본 설정
  // ==============================
  const CLIENT_ID = '1024944960226-7af4jsut8gquqs6omtibdqla7qurefls.apps.googleusercontent.com'; // ← 필수: 본인 값으로 교체
  const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
  const STORAGE_KEY = 'yt_oauth_v2';

  // Google Identity Services 스크립트 로드(중복 방지)
  function loadGis() {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        return resolve();
      }
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  // 로컬 저장
  function saveOAuthState(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
    } catch (e) { console.warn('OAuth state save failed', e); }
  }
  function loadOAuthState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function clearOAuthState() { saveOAuthState({}); }

  // 남은 초 계산
  function secondsLeft(expiresAt) {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, (expiresAt || 0) - now);
  }

  // 전역 상태
  window.oAuthState = window.oAuthState || {
    tokenClient: null,
    initialized: false
  };

  // ==============================
  // 토큰 보유/요청
  // ==============================
  async function initOAuthManager() {
    if (window.oAuthState.initialized) {
      console.log('OAuth 매니저: 이미 초기화됨');
      return;
    }
    await loadGis();

    // Token Client 생성
    window.oAuthState.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      prompt: '',                  // 기본: silent 가능
      callback: (resp) => {
        // 이 콜백은 requestAccessToken() 호출 때마다 재지정하므로 여긴 비워둡니다.
      }
    });

    window.oAuthState.initialized = true;
    console.log('OAuth 매니저 초기화 완료');

    // 자동 로그인(무소음) 시도
    try {
      await ensureAccessToken(true); // silentOnly = true
      if (getAccessToken()) {
        console.log('OAuth: 무소음 토큰 확보');
      } else {
        console.log('OAuth: 저장된 토큰이 없음');
      }
    } catch {
      console.log('OAuth: 자동 로그인 실패 또는 저장된 토큰 없음');
    }
  }

  function getAccessToken() {
    const state = loadOAuthState();
    const left = secondsLeft(state.expires_at);
    if (state.access_token && left > 10) return state.access_token;
    return null;
  }

  // silentOnly=true 면 사용자 프롬프트 없이 재발급만 시도
  function ensureAccessToken(silentOnly = false) {
    return new Promise((resolve, reject) => {
      const state = loadOAuthState();
      const left = secondsLeft(state.expires_at);
      if (state.access_token && left > 60) {
        return resolve(state.access_token);
      }

      if (!window.oAuthState.tokenClient) {
        return reject(new Error('Token client not initialized'));
      }

      window.oAuthState.tokenClient.callback = (resp) => {
        if (resp.error) {
          console.warn('토큰 발급 오류', resp);
          if (silentOnly) return resolve(null);
          return reject(new Error(resp.error));
        }
        // 토큰 저장
        const expiresAt = Math.floor(Date.now() / 1000) + (resp.expires_in || 3600);
        saveOAuthState({
          access_token: resp.access_token,
          expires_at: expiresAt
        });
        resolve(resp.access_token);
      };

      try {
        window.oAuthState.tokenClient.requestAccessToken({
          prompt: silentOnly ? 'none' : undefined
        });
      } catch (e) {
        console.error('토큰 요청 실패', e);
        if (silentOnly) return resolve(null);
        reject(e);
      }
    });
  }

  async function oauthSignIn() {
    await initOAuthManager();
    await ensureAccessToken(false); // 사용자 프롬프트 허용
    if (getAccessToken()) {
      window.toast && window.toast('Google 로그인 완료', 'success');
    }
    return getAccessToken();
  }

  function oauthSignOut() {
    clearOAuthState();
    window.toast && window.toast('Google 로그아웃 완료', 'info');
  }

  // ==============================
  // 인증 Fetch/YouTube API 헬퍼
  // ==============================
  async function oauthFetch(url, init = {}) {
    const token = await ensureAccessToken(true);
    if (!token) throw new Error('로그인이 필요합니다.');
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  }

  // ytAuth('subscriptions', { part:'snippet', mine:true, maxResults:50 })
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
  window.initOAuthManager = initOAuthManager;
  window.oauthSignIn = oauthSignIn;
  window.oauthSignOut = oauthSignOut;
  window.getAccessToken = getAccessToken;
  window.ensureAccessToken = ensureAccessToken;
  window.oauthFetch = oauthFetch;
  window.ytAuth = ytAuth;
})();

console.log('oauth-manager.js 로딩 완료');
