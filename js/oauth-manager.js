// oauth-manager.js — OAuth2 (Code+PKCE, redirect) + 자동 서브경로/CLIENT_ID 처리 + 헤더 버튼 바인딩
console.log('oauth-manager.js 로딩 시작');

(function () {
  // ====== 기본 설정 ======
  // 1) 아래 CLIENT_ID에 자신의 웹 클라이언트 ID를 넣거나
  // 2) 안 넣고 실행해도 됩니다. 처음 로그인 때 한 번만 입력을 요청하고 localStorage('yt_client_id')에 저장합니다.
  let CLIENT_ID = '1024944960226-7af4jsut8gquqs6omtibdqla7qurefls.apps.googleusercontent.com';
  const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

  // 현재 페이지의 디렉터리 기준으로 콜백 경로 자동 계산 (예: /youtube-channel-monitor/oauth-callback.html)
  function getBasePath() {
    const baseEl = document.querySelector('base[href]');
    if (baseEl) {
      const href = baseEl.getAttribute('href') || '';
      if (href.startsWith('/')) return href.replace(/\/$/, '');
    }
    const p = location.pathname;
    if (p.endsWith('/')) return p.replace(/\/$/, '');
    const i = p.lastIndexOf('/');
    return i > 0 ? p.slice(0, i) : '';
  }
  const REDIRECT_URI = `${location.origin}${getBasePath()}/oauth-callback.html`;

  const STORAGE_KEY   = 'yt_oauth_v2';        // { access_token, expires_at, refresh_token? }
  const RETURN_TO_KEY = 'yt_oauth_return_to'; // 로그인 전 위치 복귀
  const PKCE_KEY      = 'yt_pkce_verifier';   // code_verifier 저장
  const CID_KEY       = 'yt_client_id';       // CLIENT_ID 저장

  // ====== 유틸 ======
  function saveState(d){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(d||{})); }catch{} }
  function loadState(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); }catch{ return {}; } }
  function clearState(){ saveState({}); }
  function secLeft(exp){ const now=Math.floor(Date.now()/1000); return Math.max(0,(exp||0)-now); }
  function warnIfFileOrigin(){
    if (location.origin === 'null' || location.protocol === 'file:') {
      console.warn('[OAuth] file:// 에서는 동작하지 않습니다. 로컬 서버에서 실행하세요.');
      window.toast && window.toast('file:// 에서는 Google 로그인 불가. 로컬 서버에서 실행하세요.', 'error');
    }
  }

  // CLIENT_ID 확보(상수 → localStorage → prompt)
  function resolveClientId(interactiveIfMissing = false) {
    let cid = CLIENT_ID;
    if (!cid || cid.includes('REPLACE_WITH')) {
      cid = localStorage.getItem(CID_KEY) || '';
    }
    if ((!cid || cid.includes('REPLACE_WITH')) && interactiveIfMissing) {
      cid = (prompt('Google OAuth 클라이언트 ID를 입력하세요(…apps.googleusercontent.com):') || '').trim();
      if (cid) {
        localStorage.setItem(CID_KEY, cid);
        CLIENT_ID = cid;
      }
    }
    if (cid && cid !== CLIENT_ID) CLIENT_ID = cid;
    return cid && !cid.includes('REPLACE_WITH') ? cid : '';
  }

  // ====== GIS 로드 ======
  async function loadGis(){
    if (window.google?.accounts?.oauth2) return;
    await new Promise((res, rej)=>{
      const s=document.createElement('script');
      s.src='https://accounts.google.com/gsi/client';
      s.async=true; s.defer=true; s.onload=res; s.onerror=rej;
      document.head.appendChild(s);
    });
  }

  // ====== (보조) Token Client: 무소음만 조용히 시도 ======
  function initTokenClient(){
    if (window._tokenClient) return;
    const cid = resolveClientId(false);
    if (!cid) return;
    window._tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: cid, scope: SCOPE, prompt: '', callback: ()=>{}
    });
  }
  async function trySilentToken(){
    try{
      initTokenClient();
      if (!window._tokenClient) return null;
      const t = await new Promise((resolve,reject)=>{
        window._tokenClient.callback = (resp)=>{
          if (resp?.access_token){
            saveState({
              access_token: resp.access_token,
              expires_at: Math.floor(Date.now()/1000)+(resp.expires_in||3600)
            });
            return resolve(resp.access_token);
          }
          return reject(new Error(resp?.error||'silent_failed'));
        };
        window._tokenClient.requestAccessToken({ prompt:'none' });
      });
      return t||null;
    }catch{ return null; }
  }

  // ====== Code + PKCE ======
  function b64url(uint8){
    return btoa(String.fromCharCode(...new Uint8Array(uint8)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  async function createPkce(){
    const arr=new Uint8Array(64); crypto.getRandomValues(arr);
    const verifier=b64url(arr);
    const digest=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge=b64url(new Uint8Array(digest));
    sessionStorage.setItem(PKCE_KEY, verifier);
    return { verifier, challenge };
  }
  function initCodeClient(challenge){
    const cid = resolveClientId(true);
    if (!cid) {
      window.toast && window.toast('CLIENT_ID가 필요합니다. 다시 시도해 주세요.', 'error');
      throw new Error('Missing CLIENT_ID');
    }
    console.log('[OAuth] redirect_uri:', REDIRECT_URI);
    return window.google.accounts.oauth2.initCodeClient({
      client_id: cid,
      scope: SCOPE,
      ux_mode: 'redirect',
      redirect_uri: REDIRECT_URI,
      prompt: 'consent',
      access_type: 'offline',
      include_granted_scopes: true,
      state: 'ytapp-'+Math.random().toString(36).slice(2),
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
  }
  async function startPkceLogin(){
    warnIfFileOrigin();
    await loadGis();
    const { challenge } = await createPkce();
    try{ sessionStorage.setItem(RETURN_TO_KEY, location.href); }catch{}
    initCodeClient(challenge).requestCode(); // → oauth-callback.html 로 리디렉트
  }

  // ====== 리프레시 토큰 갱신 ======
  async function refreshAccessToken(){
    const st=loadState(); const rt=st.refresh_token;
    if (!rt) return null;
    const cid = resolveClientId(true);
    const body=new URLSearchParams({
      client_id: cid, grant_type:'refresh_token', refresh_token: rt
    });
    const res=await fetch('https://oauth2.googleapis.com/token',{
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body
    });
    if (!res.ok){ console.warn('리프레시 갱신 실패', await res.text()); return null; }
    const j=await res.json();
    saveState({
      access_token: j.access_token,
      expires_at: Math.floor(Date.now()/1000)+(j.expires_in||3600),
      refresh_token: rt
    });
    return j.access_token||null;
  }

  // ====== 퍼블릭 API ======
  async function initOAuthManager(){
    warnIfFileOrigin();
    await loadGis();

    // 헤더의 “채널 연동” 버튼(#btn-oauth-connect)이 있다면 자동 연결
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('btn-oauth-connect') || document.getElementById('btn-oauth-signin');
      if (btn && !btn.dataset.bound){
        btn.dataset.bound = '1';
        btn.addEventListener('click', (e)=>{ e.preventDefault(); oauthSignIn(); });
      }
    });

    const st=loadState();
    if (st.access_token && secLeft(st.expires_at)>60) return;
    if (st.refresh_token){
      const t=await refreshAccessToken(); if (t) return;
    }
    // 조용히만 시도(실패해도 무시)
    await trySilentToken();
    console.log('oauth-manager.js 로딩 완료');
  }

  async function oauthSignIn(){ await startPkceLogin(); } // 리디렉트

  function oauthSignOut(){ clearState(); window.toast && window.toast('Google 로그아웃 완료', 'info'); }

  function getAccessToken(){
    const st=loadState();
    return (st.access_token && secLeft(st.expires_at)>10) ? st.access_token : null;
  }

  async function ensureAccessToken(silentOnly=false){
    const cache=getAccessToken(); if (cache) return cache;
    const st=loadState();
    if (st.refresh_token){ const t=await refreshAccessToken(); if (t) return t; }
    if (silentOnly) return null;
    await startPkceLogin(); // 리디렉트 시작
    return null;
  }

  async function oauthFetch(url, init={}){
    const token=await ensureAccessToken(false);
    if (!token) throw new Error('로그인이 필요합니다.');
    const headers=new Headers(init.headers||{}); headers.set('Authorization',`Bearer ${token}`);
    return fetch(url,{...init, headers});
  }

  async function ytAuth(endpoint, params={}){
    const q=new URLSearchParams();
    Object.entries(params).forEach(([k,v])=>{
      if (v===undefined||v===null) return;
      q.set(k, v===true?'true': v===false?'false': String(v));
    });
    const url=`https://www.googleapis.com/youtube/v3/${endpoint}?${q.toString()}`;
    const res=await oauthFetch(url);
    if (!res.ok){ const t=await res.text(); throw new Error(`YouTube API 오류(${res.status}): ${t}`); }
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
