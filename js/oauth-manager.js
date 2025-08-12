// YouTube 채널 모니터 - OAuth 인증 관리
console.log('oauth-manager.js 로딩 시작');

// ============================================================================
// OAuth 2.0 설정
// ============================================================================
const OAUTH_CONFIG = {
  // 실제 구현시 여기에 실제 Client ID를 입력하세요
  clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  
  // 리다이렉트 URI (실제 도메인에 맞게 수정 필요)
  redirectUri: window.location.origin + '/oauth-callback.html',
  
  // YouTube API 스코프들
  scopes: [
    'https://www.googleapis.com/auth/youtube.readonly',           // 기본 YouTube 데이터
    'https://www.googleapis.com/auth/yt-analytics.readonly',      // Analytics 데이터  
    'https://www.googleapis.com/auth/yt-analytics-monetary.readonly' // 수익 데이터
  ],
  
  // Google OAuth 엔드포인트
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  
  // API 엔드포인트들
  youtubeApiBase: 'https://www.googleapis.com/youtube/v3',
  analyticsApiBase: 'https://youtubeanalytics.googleapis.com/v2'
};

// ============================================================================
// OAuth 상태 관리
// ============================================================================
window.oAuthState = {
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  tokenExpiry: null,
  userInfo: null,
  currentChannelId: null,
  authenticatedChannels: new Map(), // channelId -> tokenData
  pendingAuthentication: false
};

// ============================================================================
// 유틸리티 함수들
// ============================================================================

// 랜덤 state 생성 (CSRF 방지)
function generateRandomState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// URL 파라미터 파싱
function parseUrlParams(url = window.location.href) {
  const params = new URLSearchParams(url.split('?')[1] || '');
  const result = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

// 토큰 만료 확인
function isTokenExpired(tokenData) {
  if (!tokenData || !tokenData.expires_at) return true;
  return Date.now() >= tokenData.expires_at;
}

// 안전한 토큰 저장 (암호화는 실제 구현시 추가)
function secureTokenStorage(action, key, data = null) {
  const storageKey = `oauth_${key}`;
  
  switch (action) {
    case 'save':
      localStorage.setItem(storageKey, JSON.stringify(data));
      break;
    case 'load':
      try {
        const stored = localStorage.getItem(storageKey);
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        console.error('토큰 로드 실패:', e);
        return null;
      }
    case 'remove':
      localStorage.removeItem(storageKey);
      break;
  }
}

// ============================================================================
// OAuth 인증 플로우
// ============================================================================

// 1단계: Google OAuth 로그인 시작
function startOAuthFlow(forceConsent = false) {
  console.log('OAuth 인증 시작');
  
  // 이미 인증 진행중이면 중단
  if (window.oAuthState.pendingAuthentication) {
    console.warn('이미 OAuth 인증이 진행중입니다.');
    return;
  }
  
  // CSRF 방지를 위한 state 생성 및 저장
  const state = generateRandomState();
  sessionStorage.setItem('oauth_state', state);
  
  // OAuth 파라미터 구성
  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scopes.join(' '),
    response_type: 'code',
    state: state,
    access_type: 'offline', // refresh token을 받기 위해 필수
    prompt: forceConsent ? 'consent' : 'select_account'
  });
  
  // 인증 URL 생성 및 이동
  const authUrl = `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
  
  console.log('OAuth URL로 리다이렉트:', authUrl);
  window.oAuthState.pendingAuthentication = true;
  
  // 팝업 또는 전체 페이지 리다이렉트 선택
  if (window.innerWidth > 768) {
    // 데스크톱: 팝업 사용
    openOAuthPopup(authUrl);
  } else {
    // 모바일: 전체 페이지 리다이렉트
    window.location.href = authUrl;
  }
}

// OAuth 팝업 창 관리
function openOAuthPopup(authUrl) {
  const popup = window.open(
    authUrl,
    'oauth_popup',
    'width=500,height=600,scrollbars=yes,resizable=yes'
  );
  
  if (!popup) {
    // 팝업이 차단된 경우 전체 페이지로 리다이렉트
    console.warn('팝업이 차단됨. 전체 페이지로 리다이렉트합니다.');
    window.location.href = authUrl;
    return;
  }
  
  // 팝업 모니터링
  const checkClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkClosed);
      window.oAuthState.pendingAuthentication = false;
      
      // 팝업이 닫혔을 때 토큰 확인
      setTimeout(checkForNewTokens, 1000);
    }
  }, 1000);
  
  // 타임아웃 처리 (5분)
  setTimeout(() => {
    if (!popup.closed) {
      popup.close();
      clearInterval(checkClosed);
      window.oAuthState.pendingAuthentication = false;
      
      if (typeof window.toast === 'function') {
        window.toast('OAuth 인증이 시간 초과되었습니다.', 'warning');
      }
    }
  }, 300000);
}

// 2단계: 인증 코드로 액세스 토큰 교환
async function exchangeCodeForTokens(authCode, state) {
  console.log('토큰 교환 시작');
  
  // State 검증 (CSRF 방지)
  const savedState = sessionStorage.getItem('oauth_state');
  if (state !== savedState) {
    throw new Error('State 불일치. CSRF 공격 가능성.');
  }
  
  // 토큰 교환 요청
  const tokenData = {
    client_id: OAUTH_CONFIG.clientId,
    code: authCode,
    grant_type: 'authorization_code',
    redirect_uri: OAUTH_CONFIG.redirectUri
  };
  
  try {
    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(tokenData).toString()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`토큰 교환 실패: ${error.error_description || error.error}`);
    }
    
    const tokens = await response.json();
    
    // 토큰 만료 시간 계산
    tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
    
    // 상태 업데이트
    window.oAuthState.accessToken = tokens.access_token;
    window.oAuthState.refreshToken = tokens.refresh_token;
    window.oAuthState.tokenExpiry = tokens.expires_at;
    window.oAuthState.isAuthenticated = true;
    window.oAuthState.pendingAuthentication = false;
    
    // 토큰 저장
    secureTokenStorage('save', 'tokens', tokens);
    
    console.log('토큰 교환 성공');
    return tokens;
    
  } catch (error) {
    console.error('토큰 교환 실패:', error);
    window.oAuthState.pendingAuthentication = false;
    throw error;
  }
}

// 3단계: 사용자 정보 및 채널 정보 가져오기
async function fetchUserAndChannelInfo(accessToken) {
  console.log('사용자 정보 가져오기 시작');
  
  try {
    // 인증된 사용자의 채널 정보 가져오기
    const channelResponse = await fetch(
      `${OAUTH_CONFIG.youtubeApiBase}/channels?part=snippet,statistics,contentDetails&mine=true`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!channelResponse.ok) {
      throw new Error(`채널 정보 가져오기 실패: ${channelResponse.status}`);
    }
    
    const channelData = await channelResponse.json();
    
    if (!channelData.items || channelData.items.length === 0) {
      throw new Error('연결된 YouTube 채널이 없습니다.');
    }
    
    const channel = channelData.items[0];
    
    // 사용자 정보 설정
    window.oAuthState.userInfo = {
      channelId: channel.id,
      channelTitle: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
      subscriberCount: channel.statistics.subscriberCount,
      viewCount: channel.statistics.viewCount,
      videoCount: channel.statistics.videoCount
    };
    
    window.oAuthState.currentChannelId = channel.id;
    
    console.log('사용자 정보 가져오기 성공:', channel.snippet.title);
    return channel;
    
  } catch (error) {
    console.error('사용자 정보 가져오기 실패:', error);
    throw error;
  }
}

// ============================================================================
// 토큰 관리
// ============================================================================

// 액세스 토큰 갱신
async function refreshAccessToken() {
  console.log('액세스 토큰 갱신 시작');
  
  if (!window.oAuthState.refreshToken) {
    throw new Error('Refresh token이 없습니다. 재인증이 필요합니다.');
  }
  
  const refreshData = {
    client_id: OAUTH_CONFIG.clientId,
    refresh_token: window.oAuthState.refreshToken,
    grant_type: 'refresh_token'
  };
  
  try {
    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(refreshData).toString()
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`토큰 갱신 실패: ${error.error_description || error.error}`);
    }
    
    const tokens = await response.json();
    
    // 토큰 만료 시간 계산
    tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
    
    // 상태 업데이트
    window.oAuthState.accessToken = tokens.access_token;
    window.oAuthState.tokenExpiry = tokens.expires_at;
    
    // Refresh token은 보통 새로 발급되지 않음, 있으면 업데이트
    if (tokens.refresh_token) {
      window.oAuthState.refreshToken = tokens.refresh_token;
    }
    
    // 토큰 저장
    const fullTokens = {
      access_token: tokens.access_token,
      refresh_token: window.oAuthState.refreshToken,
      expires_at: tokens.expires_at
    };
    secureTokenStorage('save', 'tokens', fullTokens);
    
    console.log('토큰 갱신 성공');
    return tokens.access_token;
    
  } catch (error) {
    console.error('토큰 갱신 실패:', error);
    
    // 갱신 실패시 로그아웃 처리
    logout();
    throw error;
  }
}

// 유효한 액세스 토큰 가져오기 (자동 갱신 포함)
async function getValidAccessToken() {
  if (!window.oAuthState.isAuthenticated) {
    throw new Error('인증되지 않은 상태입니다.');
  }
  
  const tokenData = {
    access_token: window.oAuthState.accessToken,
    expires_at: window.oAuthState.tokenExpiry
  };
  
  if (isTokenExpired(tokenData)) {
    console.log('토큰이 만료됨. 갱신 시도...');
    return await refreshAccessToken();
  }
  
  return window.oAuthState.accessToken;
}

// ============================================================================
// YouTube Analytics API 호출
// ============================================================================

// 인증된 YouTube API 호출
async function authenticatedYouTubeAPI(endpoint, params = {}) {
  const accessToken = await getValidAccessToken();
  
  const url = new URL(`${OAUTH_CONFIG.youtubeApiBase}/${endpoint}`);
  Object.keys(params).forEach(key => {
    url.searchParams.append(key, params[key]);
  });
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`YouTube API 호출 실패: ${error.error?.message || response.statusText}`);
  }
  
  return response.json();
}

// YouTube Analytics API 호출
async function youTubeAnalyticsAPI(params = {}) {
  const accessToken = await getValidAccessToken();
  
  const url = new URL(`${OAUTH_CONFIG.analyticsApiBase}/reports`);
  Object.keys(params).forEach(key => {
    url.searchParams.append(key, params[key]);
  });
  
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Analytics API 호출 실패: ${error.error?.message || response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// 고급 분석 데이터 수집
// ============================================================================

// 상세 채널 분석 데이터 가져오기
async function getDetailedChannelAnalytics(channelId, startDate, endDate) {
  console.log('상세 채널 분석 시작:', channelId);
  
  try {
    // 기본 채널 정보
    const channelInfo = await authenticatedYouTubeAPI('channels', {
      part: 'snippet,statistics,contentDetails',
      id: channelId
    });
    
    // Analytics 데이터 (지난 30일)
    const analyticsData = await youTubeAnalyticsAPI({
      ids: `channel==${channelId}`,
      startDate: startDate,
      endDate: endDate,
      metrics: 'views,estimatedMinutesWatched,subscribersGained,estimatedRevenue,grossRevenue,adImpressions,cpm,playbackBasedCpm',
      dimensions: 'day'
    });
    
    // 트래픽 소스 분석
    const trafficSources = await youTubeAnalyticsAPI({
      ids: `channel==${channelId}`,
      startDate: startDate,
      endDate: endDate,
      metrics: 'views',
      dimensions: 'trafficSourceType',
      sort: '-views'
    });
    
    // 시청자 분석 (연령/성별)
    const demographics = await youTubeAnalyticsAPI({
      ids: `channel==${channelId}`,
      startDate: startDate,
      endDate: endDate,
      metrics: 'viewerPercentage',
      dimensions: 'ageGroup,gender',
      sort: '-viewerPercentage'
    });
    
    // 상위 동영상
    const topVideos = await youTubeAnalyticsAPI({
      ids: `channel==${channelId}`,
      startDate: startDate,
      endDate: endDate,
      metrics: 'views,estimatedMinutesWatched,likes,comments',
      dimensions: 'video',
      sort: '-views',
      maxResults: 10
    });
    
    return {
      channelInfo: channelInfo.items[0],
      analytics: analyticsData,
      trafficSources: trafficSources,
      demographics: demographics,
      topVideos: topVideos
    };
    
  } catch (error) {
    console.error('상세 분석 데이터 가져오기 실패:', error);
    throw error;
  }
}

// 실시간 통계 가져오기 (오늘)
async function getTodayStats(channelId) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const todayData = await youTubeAnalyticsAPI({
      ids: `channel==${channelId}`,
      startDate: today,
      endDate: today,
      metrics: 'views,subscribersGained,estimatedMinutesWatched,estimatedRevenue'
    });
    
    return todayData;
  } catch (error) {
    console.error('오늘 통계 가져오기 실패:', error);
    throw error;
  }
}

// ============================================================================
// 인증 상태 관리
// ============================================================================

// 저장된 토큰으로 자동 로그인
async function autoLogin() {
  console.log('자동 로그인 시도');
  
  const savedTokens = secureTokenStorage('load', 'tokens');
  if (!savedTokens) {
    console.log('저장된 토큰이 없음');
    return false;
  }
  
  try {
    // 토큰 상태 복원
    window.oAuthState.accessToken = savedTokens.access_token;
    window.oAuthState.refreshToken = savedTokens.refresh_token;
    window.oAuthState.tokenExpiry = savedTokens.expires_at;
    window.oAuthState.isAuthenticated = true;
    
    // 토큰 유효성 확인 및 사용자 정보 가져오기
    const accessToken = await getValidAccessToken();
    const channelInfo = await fetchUserAndChannelInfo(accessToken);
    
    console.log('자동 로그인 성공:', channelInfo.snippet.title);
    return true;
    
  } catch (error) {
    console.error('자동 로그인 실패:', error);
    
    // 실패시 저장된 토큰 삭제
    secureTokenStorage('remove', 'tokens');
    logout();
    return false;
  }
}

// 로그아웃
function logout() {
  console.log('로그아웃 실행');
  
  // 상태 초기화
  window.oAuthState = {
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null,
    userInfo: null,
    currentChannelId: null,
    authenticatedChannels: new Map(),
    pendingAuthentication: false
  };
  
  // 저장된 토큰 삭제
  secureTokenStorage('remove', 'tokens');
  
  // Google에서 토큰 무효화 (선택사항)
  // revokeToken();
  
  console.log('로그아웃 완료');
}

// 토큰 무효화 (Google에서)
async function revokeToken() {
  if (!window.oAuthState.accessToken) return;
  
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${window.oAuthState.accessToken}`, {
      method: 'POST'
    });
    console.log('토큰 무효화 성공');
  } catch (error) {
    console.warn('토큰 무효화 실패:', error);
  }
}

// ============================================================================
// OAuth 콜백 처리
// ============================================================================

// URL에서 OAuth 콜백 확인 및 처리
function handleOAuthCallback() {
  const params = parseUrlParams();
  
  if (params.code && params.state) {
    console.log('OAuth 콜백 감지');
    
    // 인증 코드를 토큰으로 교환
    exchangeCodeForTokens(params.code, params.state)
      .then(tokens => {
        return fetchUserAndChannelInfo(tokens.access_token);
      })
      .then(channelInfo => {
        console.log('OAuth 인증 완료:', channelInfo.snippet.title);
        
        // 성공 메시지
        if (typeof window.toast === 'function') {
          window.toast(`✅ "${channelInfo.snippet.title}" 채널이 연동되었습니다!`, 'success');
        }
        
        // URL에서 OAuth 파라미터 제거
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        // 내채널 섹션으로 이동
        if (typeof window.showSection === 'function') {
          window.showSection('my-channels');
        }
        
        return true;
      })
      .catch(error => {
        console.error('OAuth 콜백 처리 실패:', error);
        
        if (typeof window.toast === 'function') {
          window.toast(`❌ 채널 연동 실패: ${error.message}`, 'error');
        }
        
        return false;
      });
  } else if (params.error) {
    console.error('OAuth 오류:', params.error, params.error_description);
    
    if (typeof window.toast === 'function') {
      window.toast(`❌ 인증 오류: ${params.error_description || params.error}`, 'error');
    }
    
    window.oAuthState.pendingAuthentication = false;
  }
}

// 새로운 토큰 확인 (팝업 닫힌 후)
function checkForNewTokens() {
  const savedTokens = secureTokenStorage('load', 'tokens');
  const currentTokens = window.oAuthState.accessToken;
  
  if (savedTokens && savedTokens.access_token !== currentTokens) {
    console.log('새로운 토큰 감지됨');
    autoLogin();
  }
}

// ============================================================================
// 전역 함수 노출
// ============================================================================
window.startOAuthFlow = startOAuthFlow;
window.logout = logout;
window.autoLogin = autoLogin;
window.getValidAccessToken = getValidAccessToken;
window.authenticatedYouTubeAPI = authenticatedYouTubeAPI;
window.youTubeAnalyticsAPI = youTubeAnalyticsAPI;
window.getDetailedChannelAnalytics = getDetailedChannelAnalytics;
window.getTodayStats = getTodayStats;
window.handleOAuthCallback = handleOAuthCallback;

// OAuth 매니저 API 객체
window.oAuthManager = {
  startOAuthFlow,
  logout,
  autoLogin,
  getValidAccessToken,
  isAuthenticated: () => window.oAuthState.isAuthenticated,
  getCurrentUser: () => window.oAuthState.userInfo,
  getCurrentChannelId: () => window.oAuthState.currentChannelId
};

// ============================================================================
// 초기화
// ============================================================================

// DOM 로드 완료시 초기화
document.addEventListener('DOMContentLoaded', function() {
  console.log('OAuth 매니저 초기화');
  
  // OAuth 콜백 확인
  handleOAuthCallback();
  
  // 자동 로그인 시도 (1초 후)
  setTimeout(() => {
    autoLogin().then(success => {
      if (success) {
        console.log('OAuth: 자동 로그인 성공');
      } else {
        console.log('OAuth: 자동 로그인 실패 또는 저장된 토큰 없음');
      }
    });
  }, 1000);
});

console.log('oauth-manager.js 로딩 완료');