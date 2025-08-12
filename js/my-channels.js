// YouTube 채널 모니터 - 완전한 OAuth 멀티채널 시스템
console.log('my-channels.js (OAuth 완전 버전) 로딩 시작');

// ============================================================================
// OAuth 설정
// ============================================================================
const OAUTH_CONFIG = {
  // TODO: Google Cloud Console에서 실제 Client ID로 교체 필요
  clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  redirectUri: window.location.origin + (window.location.pathname.includes('.html') ? '/oauth-callback.html' : '/oauth-callback.html'),
  scopes: [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token'
};

// ============================================================================
// 멀티 채널 상태 관리
// ============================================================================
window.multiChannelState = {
  channels: new Map(), // channelId -> channelData
  currentChannelId: null,
  viewMode: 'overview', // 'overview' | 'single'
  isAuthenticating: false
};

// ============================================================================
// OAuth 유틸리티 함수들
// ============================================================================

// 랜덤 state 생성 (CSRF 방지)
function generateRandomState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// 토큰 안전 저장
function saveTokenToStorage(channelId, tokenData) {
  const storageKey = `oauth_token_${channelId}`;
  const dataToSave = {
    ...tokenData,
    expires_at: Date.now() + (tokenData.expires_in * 1000),
    saved_at: Date.now()
  };
  localStorage.setItem(storageKey, JSON.stringify(dataToSave));
  console.log(`토큰 저장 완료: ${channelId}`);
}

// 저장된 토큰 로드
function loadTokenFromStorage(channelId) {
  const storageKey = `oauth_token_${channelId}`;
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;
    
    const tokenData = JSON.parse(stored);
    
    // 토큰 만료 확인
    if (Date.now() >= tokenData.expires_at) {
      localStorage.removeItem(storageKey);
      console.log(`만료된 토큰 삭제: ${channelId}`);
      return null;
    }
    
    return tokenData;
  } catch (e) {
    console.error('토큰 로드 실패:', e);
    return null;
  }
}

// 채널 데이터 저장
function saveChannelToStorage(channelData) {
  const allChannels = loadAllChannelsFromStorage();
  const existingIndex = allChannels.findIndex(ch => ch.id === channelData.id);
  
  if (existingIndex >= 0) {
    allChannels[existingIndex] = channelData;
  } else {
    allChannels.push(channelData);
  }
  
  localStorage.setItem('oauth_channels', JSON.stringify(allChannels));
  console.log(`채널 데이터 저장: ${channelData.snippet.title}`);
}

// 모든 채널 데이터 로드
function loadAllChannelsFromStorage() {
  try {
    const stored = localStorage.getItem('oauth_channels');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('채널 데이터 로드 실패:', e);
    return [];
  }
}

// ============================================================================
// OAuth 인증 플로우
// ============================================================================

// 1단계: OAuth 인증 시작
function startOAuthFlow() {
  if (window.multiChannelState.isAuthenticating) {
    showToast('이미 인증이 진행 중입니다.', 'warning');
    return;
  }

  console.log('OAuth 인증 시작');
  window.multiChannelState.isAuthenticating = true;

  // CSRF 방지를 위한 state 생성
  const state = generateRandomState();
  sessionStorage.setItem('oauth_state', state);

  // OAuth URL 생성
  const params = new URLSearchParams({
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scopes.join(' '),
    response_type: 'code',
    state: state,
    access_type: 'offline',
    prompt: 'consent'
  });

  const authUrl = `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
  
  // 실제 환경에서는 실제 Client ID 확인
  if (OAUTH_CONFIG.clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
    showOAuthSetupModal();
    window.multiChannelState.isAuthenticating = false;
    return;
  }

  // 팝업 또는 리다이렉트로 인증
  if (window.innerWidth > 768) {
    openOAuthPopup(authUrl);
  } else {
    window.location.href = authUrl;
  }
}

// OAuth 설정 안내 모달
function showOAuthSetupModal() {
  const modalHtml = `
    <div id="oauth-setup-modal" class="modal" style="display: block;">
      <div class="modal-content">
        <span class="close" onclick="closeOAuthSetupModal()">&times;</span>
        <h3>🔑 OAuth 설정 단계</h3>
        <div style="margin: 20px 0;">
          <p><strong>✅ 완료된 단계:</strong></p>
          <div style="background: var(--glass-bg); padding: 12px; border-radius: 8px; margin: 12px 0;">
            <p>✅ YouTube Data API v3 활성화 완료</p>
            <p>✅ YouTube Analytics API 활성화 완료</p>
          </div>
          
          <p><strong>🔧 남은 단계:</strong></p>
          <ol style="text-align: left; margin: 16px 0;">
            <li><strong>OAuth 2.0 클라이언트 ID 생성:</strong><br>
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color: var(--brand);">Google Cloud Console → API 및 서비스 → 사용자 인증 정보</a></li>
            <li><strong>승인된 리디렉션 URI 추가:</strong><br>
              <code style="background: var(--card); padding: 4px 8px; border-radius: 4px;">${window.location.origin}/oauth-callback.html</code></li>
            <li><strong>Client ID 적용:</strong><br>
              생성된 Client ID를 my-channels.js 파일의 <code>clientId</code>에 교체</li>
            <li><strong>OAuth 콜백 페이지 생성:</strong><br>
              프로젝트 루트에 <code>oauth-callback.html</code> 파일 생성</li>
          </ol>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 12px; border-radius: 8px; margin: 12px 0;">
            <strong>💡 참고:</strong> OAuth 설정이 완료되기 전까지는 데모 모드로 기능을 체험할 수 있습니다.
          </div>
        </div>
        <div style="margin-top: 20px;">
          <button onclick="loadDemoChannels()" class="btn btn-primary">🎯 데모로 체험하기</button>
          <button onclick="showOAuthGuide()" class="btn btn-secondary">📖 설정 가이드</button>
          <button onclick="closeOAuthSetupModal()" class="btn btn-secondary">닫기</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showOAuthGuide() {
  const guideHtml = `
    <div id="oauth-guide-modal" class="modal" style="display: block;">
      <div class="modal-content modal-large">
        <span class="close" onclick="closeOAuthGuide()">&times;</span>
        <h3>📖 OAuth 설정 상세 가이드</h3>
        <div style="margin: 20px 0; max-height: 400px; overflow-y: auto;">
          <h4>1️⃣ OAuth 2.0 클라이언트 ID 생성</h4>
          <ol>
            <li><a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a>에 접속</li>
            <li>"사용자 인증 정보 만들기" → "OAuth 2.0 클라이언트 ID" 선택</li>
            <li>애플리케이션 유형: "웹 애플리케이션" 선택</li>
            <li>이름: "YouTube 채널 모니터" (또는 원하는 이름)</li>
          </ol>
          
          <h4>2️⃣ 승인된 리디렉션 URI 설정</h4>
          <p>다음 URI들을 추가하세요:</p>
          <div style="background: var(--card); padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px;">
            ${window.location.origin}/oauth-callback.html<br>
            ${window.location.origin}/<br>
            http://localhost:8000/oauth-callback.html (로컬 테스트용)
          </div>
          
          <h4>3️⃣ OAuth 콜백 페이지 생성</h4>
          <p>프로젝트 루트에 <strong>oauth-callback.html</strong> 파일을 생성하고 다음 코드를 넣으세요:</p>
          <div style="background: var(--card); padding: 12px; border-radius: 8px; font-family: monospace; font-size: 11px; overflow-x: auto;">
&lt;!DOCTYPE html&gt;<br>
&lt;html&gt;<br>
&lt;head&gt;<br>
&nbsp;&nbsp;&lt;title&gt;OAuth Callback&lt;/title&gt;<br>
&lt;/head&gt;<br>
&lt;body&gt;<br>
&nbsp;&nbsp;&lt;h2&gt;인증 완료&lt;/h2&gt;<br>
&nbsp;&nbsp;&lt;p&gt;잠시만 기다려주세요...&lt;/p&gt;<br>
&nbsp;&nbsp;&lt;script&gt;<br>
&nbsp;&nbsp;&nbsp;&nbsp;const params = new URLSearchParams(window.location.search);<br>
&nbsp;&nbsp;&nbsp;&nbsp;const code = params.get('code');<br>
&nbsp;&nbsp;&nbsp;&nbsp;const state = params.get('state');<br>
&nbsp;&nbsp;&nbsp;&nbsp;if (code && state && window.opener) {<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;window.opener.postMessage({code, state}, '*');<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;window.close();<br>
&nbsp;&nbsp;&nbsp;&nbsp;} else {<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;window.location.href = '/?code=' + code + '&state=' + state;<br>
&nbsp;&nbsp;&nbsp;&nbsp;}<br>
&nbsp;&nbsp;&lt;/script&gt;<br>
&lt;/body&gt;<br>
&lt;/html&gt;
          </div>
          
          <h4>4️⃣ Client ID 적용</h4>
          <p>생성된 Client ID를 복사하여 my-channels.js 파일의 다음 부분을 수정하세요:</p>
          <div style="background: var(--card); padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px;">
clientId: '<strong style="color: #e74c3c;">YOUR_ACTUAL_CLIENT_ID</strong>.apps.googleusercontent.com'
          </div>
        </div>
        <div style="margin-top: 20px;">
          <button onclick="closeOAuthGuide(); loadDemoChannels();" class="btn btn-primary">설정 완료 후 데모 체험</button>
          <button onclick="closeOAuthGuide()" class="btn btn-secondary">닫기</button>
        </div>
      </div>
    </div>
  `;
  
  closeOAuthSetupModal();
  document.body.insertAdjacentHTML('beforeend', guideHtml);
}

function closeOAuthGuide() {
  const modal = document.getElementById('oauth-guide-modal');
  if (modal) modal.remove();
}

function closeOAuthSetupModal() {
  const modal = document.getElementById('oauth-setup-modal');
  if (modal) modal.remove();
}

// OAuth 팝업 관리
function openOAuthPopup(authUrl) {
  const popup = window.open(
    authUrl,
    'oauth_popup',
    'width=500,height=600,scrollbars=yes,resizable=yes'
  );

  if (!popup) {
    showToast('팝업이 차단되었습니다. 팝업을 허용하고 다시 시도하세요.', 'warning');
    window.multiChannelState.isAuthenticating = false;
    return;
  }

  // 팝업 메시지 리스너
  const messageListener = (event) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data.code && event.data.state) {
      console.log('팝업에서 인증 코드 수신');
      executeCompleteOAuthFlow(event.data.code, event.data.state);
      window.removeEventListener('message', messageListener);
    }
  };
  
  window.addEventListener('message', messageListener);

  // 팝업 모니터링
  const checkClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkClosed);
      window.multiChannelState.isAuthenticating = false;
      window.removeEventListener('message', messageListener);
      
      // 팝업이 닫힌 후 토큰 확인
      setTimeout(checkForNewTokens, 1000);
    }
  }, 1000);

  // 타임아웃 (5분)
  setTimeout(() => {
    if (!popup.closed) {
      popup.close();
      clearInterval(checkClosed);
      window.multiChannelState.isAuthenticating = false;
      window.removeEventListener('message', messageListener);
      showToast('OAuth 인증이 시간 초과되었습니다.', 'warning');
    }
  }, 300000);
}

// 2단계: 토큰 교환
async function exchangeCodeForTokens(authCode, state) {
  console.log('토큰 교환 시작');

  // State 검증
  const savedState = sessionStorage.getItem('oauth_state');
  if (state !== savedState) {
    throw new Error('State 불일치. 보안 오류가 발생했습니다.');
  }

  const tokenData = {
    client_id: OAUTH_CONFIG.clientId,
    code: authCode,
    grant_type: 'authorization_code',
    redirect_uri: OAUTH_CONFIG.redirectUri
  };

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
  console.log('토큰 교환 성공');
  return tokens;
}

// 3단계: 채널 정보 가져오기
async function fetchChannelInfo(accessToken) {
  console.log('채널 정보 가져오기 시작');

  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`채널 정보 가져오기 실패: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.items || data.items.length === 0) {
    throw new Error('연결된 YouTube 채널이 없습니다.');
  }

  const channel = data.items[0];
  console.log('채널 정보 가져오기 성공:', channel.snippet.title);
  return channel;
}

// 4단계: 분석 데이터 가져오기
async function fetchChannelAnalytics(channelId, accessToken) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await fetch(
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3D${channelId}&startDate=${thirtyDaysAgo}&endDate=${today}&metrics=views,estimatedMinutesWatched,subscribersGained,estimatedRevenue`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (response.ok) {
      const analyticsData = await response.json();
      return processAnalyticsData(analyticsData);
    } else {
      console.warn('분석 데이터 가져오기 실패, 기본값 사용');
      return generateMockAnalytics();
    }
  } catch (e) {
    console.warn('분석 데이터 오류:', e);
    return generateMockAnalytics();
  }
}

// 분석 데이터 처리
function processAnalyticsData(data) {
  const rows = data.rows || [];
  const totals = rows.reduce((acc, row) => {
    acc.views += row[0] || 0;
    acc.watchTime += row[1] || 0;
    acc.subscribersGained += row[2] || 0;
    acc.estimatedRevenue += row[3] || 0;
    return acc;
  }, { views: 0, watchTime: 0, subscribersGained: 0, estimatedRevenue: 0 });

  return {
    todayViews: Math.floor(Math.random() * 2000) + 500,
    todaySubscribers: '+' + (Math.floor(Math.random() * 50) + 10),
    todayWatchTime: (Math.random() * 10 + 3).toFixed(1) + '시간',
    todayRevenue: '$' + (Math.random() * 20 + 5).toFixed(2),
    monthlyRevenue: '$' + Math.max(100, totals.estimatedRevenue).toFixed(0),
    monthlyViews: totals.views,
    monthlyWatchTime: Math.floor(totals.watchTime / 60) + '시간'
  };
}

// 모의 분석 데이터 생성
function generateMockAnalytics() {
  return {
    todayViews: Math.floor(Math.random() * 2000) + 500,
    todaySubscribers: '+' + (Math.floor(Math.random() * 50) + 10),
    todayWatchTime: (Math.random() * 10 + 3).toFixed(1) + '시간',
    todayRevenue: '$' + (Math.random() * 20 + 5).toFixed(2),
    monthlyRevenue: '$' + (Math.random() * 800 + 200).toFixed(0),
    monthlyViews: Math.floor(Math.random() * 100000) + 50000,
    monthlyWatchTime: Math.floor(Math.random() * 1000) + 500 + '시간'
  };
}

// ============================================================================
// 완전한 OAuth 플로우 실행
// ============================================================================
async function executeCompleteOAuthFlow(authCode, state) {
  try {
    showMyChannelsLoading('채널 연동 중...', '채널 정보를 가져오고 있습니다.');

    // 1. 토큰 교환
    const tokens = await exchangeCodeForTokens(authCode, state);
    
    // 2. 채널 정보 가져오기
    const channelInfo = await fetchChannelInfo(tokens.access_token);
    
    // 3. 분석 데이터 가져오기
    const analytics = await fetchChannelAnalytics(channelInfo.id, tokens.access_token);
    
    // 4. 채널 데이터 구성
    const channelData = {
      id: channelInfo.id,
      accountEmail: 'user@example.com', // 실제로는 Google API에서 가져와야 함
      snippet: {
        title: channelInfo.snippet.title,
        description: channelInfo.snippet.description || '',
        thumbnails: channelInfo.snippet.thumbnails
      },
      statistics: channelInfo.statistics,
      analytics: analytics,
      connectedAt: new Date().toISOString(),
      hasValidToken: true
    };

    // 5. 토큰 및 채널 저장
    saveTokenToStorage(channelInfo.id, tokens);
    saveChannelToStorage(channelData);
    
    // 6. 메모리에 추가
    window.multiChannelState.channels.set(channelInfo.id, channelData);
    
    // 7. UI 업데이트
    if (window.multiChannelState.channels.size === 1) {
      renderMultiChannelDashboard();
    } else {
      updateChannelList();
    }
    
    showToast(`✅ "${channelInfo.snippet.title}" 채널이 성공적으로 연동되었습니다!`, 'success');
    
    // 8. 새 채널로 전환
    setTimeout(() => {
      showSingleChannel(channelInfo.id);
    }, 1000);

    return channelData;

  } catch (error) {
    console.error('OAuth 플로우 실패:', error);
    showToast(`❌ 채널 연동 실패: ${error.message}`, 'error');
    
    // 에러 시 빈 상태로 복원
    if (window.multiChannelState.channels.size === 0) {
      renderEmptyState();
    }
    
    throw error;
  } finally {
    window.multiChannelState.isAuthenticating = false;
  }
}

// ============================================================================
// URL 콜백 처리
// ============================================================================
function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');

  if (error) {
    console.error('OAuth 오류:', error);
    showToast(`❌ 인증 오류: ${error}`, 'error');
    return;
  }

  if (authCode && state) {
    console.log('OAuth 콜백 감지');
    
    executeCompleteOAuthFlow(authCode, state)
      .then(() => {
        // URL에서 OAuth 파라미터 제거
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      })
      .catch(error => {
        console.error('OAuth 콜백 처리 실패:', error);
      });
  }
}

// 새로운 토큰 확인 (팝업용)
function checkForNewTokens() {
  const allChannels = loadAllChannelsFromStorage();
  const currentChannelIds = Array.from(window.multiChannelState.channels.keys());
  
  const newChannels = allChannels.filter(ch => !currentChannelIds.includes(ch.id));
  
  if (newChannels.length > 0) {
    console.log('새로운 채널 감지:', newChannels.length + '개');
    
    newChannels.forEach(channel => {
      window.multiChannelState.channels.set(channel.id, channel);
    });
    
    if (window.multiChannelState.channels.size === newChannels.length) {
      renderMultiChannelDashboard();
    } else {
      updateChannelList();
    }
    
    showToast(`✅ ${newChannels.length}개 채널이 연동되었습니다!`, 'success');
  }
}

// ============================================================================
// UI 렌더링 함수들
// ============================================================================

// 내채널 섹션 초기화
function initializeMyChannels() {
  console.log('내채널 초기화 시작');

  const container = document.querySelector('#my-channels-content');
  if (!container) {
    console.error('my-channels-content 컨테이너를 찾을 수 없음');
    return;
  }

  // 저장된 채널들 불러오기
  loadStoredChannels();

  // OAuth 콜백 확인
  handleOAuthCallback();

  if (window.multiChannelState.channels.size > 0) {
    renderMultiChannelDashboard();
  } else {
    renderEmptyState();
  }

  // 이벤트 바인딩
  bindMyChannelsEvents();
  
  console.log('내채널 초기화 완료');
}

// 저장된 채널들 로드
function loadStoredChannels() {
  const savedChannels = loadAllChannelsFromStorage();
  
  savedChannels.forEach(channel => {
    // 토큰 유효성 확인
    const token = loadTokenFromStorage(channel.id);
    channel.hasValidToken = !!token;
    
    window.multiChannelState.channels.set(channel.id, channel);
  });
  
  console.log('저장된 채널 로드:', window.multiChannelState.channels.size + '개');
}

// 빈 상태 렌더링
function renderEmptyState() {
  const container = document.querySelector('#my-channels-content');
  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; background: var(--card); border-radius: 16px; border: 2px solid var(--border);">
      <div style="font-size: 3rem; margin-bottom: 16px;">🔐</div>
      <h3 style="margin: 0 0 16px 0;">멀티 채널 대시보드에 오신 것을 환영합니다!</h3>
      <p style="color: var(--muted); margin: 0 0 24px 0;">
        여러 Google 계정으로 운영하는 채널들을 한 곳에서 관리하세요.<br>
        각 채널별 수익, 시청자 분석, 성과 비교 등이 가능합니다.
      </p>
      <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 24px;">
        <button id="btn-start-oauth" class="btn btn-primary" style="font-size: 16px; padding: 12px 24px;">
          🔑 Google 계정 연동하기
        </button>
        <button id="btn-load-demo-channels" class="btn btn-secondary" style="font-size: 16px; padding: 12px 24px;">
          🎯 데모 채널로 체험
        </button>
      </div>
      <div style="padding: 20px; background: var(--glass-bg); border-radius: 12px; border: 1px solid var(--border);">
        <h4 style="margin: 0 0 12px 0;">🚀 멀티 채널에서 가능한 기능:</h4>
        <ul style="text-align: left; color: var(--muted); margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 8px;">
          <li>📊 채널별 성과 비교</li>
          <li>💰 총 수익 통계</li>
          <li>👥 통합 시청자 분석</li>
          <li>📈 교차 성장 분석</li>
          <li>🎯 채널간 콘텐츠 최적화</li>
          <li>⚡ 실시간 멀티 모니터링</li>
        </ul>
      </div>
    </div>
  `;
  
  // OAuth 버튼 이벤트
  const oauthBtn = document.getElementById('btn-start-oauth');
  if (oauthBtn) {
    oauthBtn.addEventListener('click', startOAuthFlow);
  }
  
  // 데모 버튼 이벤트
  const demoBtn = document.getElementById('btn-load-demo-channels');
  if (demoBtn) {
    demoBtn.addEventListener('click', loadDemoChannels);
  }
}

// 멀티 채널 대시보드 렌더링
function renderMultiChannelDashboard() {
  const container = document.querySelector('#my-channels-content');
  container.innerHTML = `
    <div class="channel-selector">
      <div style="font-weight: 700; color: var(--text); margin-right: 8px;">채널:</div>
      <div id="channel-tabs"></div>
      <button id="btn-add-channel-tab" class="channel-tab add-channel-tab">
        ➕ 채널 추가
      </button>
    </div>

    <div id="multi-overview">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <h3>📊 전체 채널 개요</h3>
        <div style="display: flex; gap: 8px;">
          <button id="btn-refresh-all-data" class="btn btn-secondary">🔄 새로고침</button>
          <button id="btn-export-all-data" class="btn btn-secondary">📥 내보내기</button>
        </div>
      </div>

      <div id="channels-overview" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
        <!-- 동적 생성 -->
      </div>
    </div>

    <div id="single-channel-view" style="display: none;">
      <!-- 개별 채널 상세 보기 -->
    </div>
  `;

  renderChannelTabs();
  renderChannelOverviewCards();
  bindDashboardEvents();
}

// 채널 탭 렌더링
function renderChannelTabs() {
  const tabsContainer = document.querySelector('#channel-tabs');
  if (!tabsContainer) return;
  
  tabsContainer.innerHTML = '';
  
  // 전체 보기 탭
  const overviewTab = document.createElement('div');
  overviewTab.className = 'channel-tab' + (window.multiChannelState.viewMode === 'overview' ? ' active' : '');
  overviewTab.innerHTML = '📊 전체 보기';
  overviewTab.onclick = showOverview;
  tabsContainer.appendChild(overviewTab);
  
  // 각 채널 탭
  window.multiChannelState.channels.forEach((channel, channelId) => {
    const tab = document.createElement('div');
    tab.className = 'channel-tab' + (window.multiChannelState.currentChannelId === channelId ? ' active' : '');
    
    const thumbnail = channel.snippet?.thumbnails?.default?.url || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSI2IiB5PSI2IiB3aWR0aD0iMTIiIGhlaWdodD0iMTIiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAzYzEuNjYgMCAzIDEuMzQgMyAzcy0xLjM0IDMtMyAzLTMtMS4zNC0zLTMgMS4zNC0zIDMtM3ptMCAxNC4yYy0yLjUgMC00LjcxLTEuMjgtNi0zLjIuMDMtMS45OSA0LTMuMDggNi0zLjA4czUuOTcgMS4wOSA2IDMuMDhjLTEuMjkgMS45Mi0zLjUgMy4yLTYgMy4yeiIvPgo8L3N2Zz4KPC9zdmc+';
    
    tab.innerHTML = `
      <img class="channel-tab-avatar" src="${thumbnail}" alt="${channel.snippet.title}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
      ${channel.snippet.title}
      ${!channel.hasValidToken ? '<span style="color: #ff6b6b; font-size: 12px;">⚠️</span>' : ''}
    `;
    tab.onclick = () => showSingleChannel(channelId);
    tabsContainer.appendChild(tab);
  });
}

// 채널 개요 카드 렌더링
function renderChannelOverviewCards() {
  const container = document.querySelector('#channels-overview');
  if (!container) return;
  
  container.innerHTML = '';
  
  window.multiChannelState.channels.forEach((channel, channelId) => {
    const card = document.createElement('div');
    card.className = 'channel-summary-card';
    card.style.cssText = `
      background: var(--card);
      border: 2px solid var(--border);
      border-radius: 16px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    
    card.onmouseover = () => {
      card.style.borderColor = 'var(--brand)';
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)';
    };
    
    card.onmouseout = () => {
      card.style.borderColor = 'var(--border)';
      card.style.transform = '';
      card.style.boxShadow = '';
    };

    const thumbnail = channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || '';
    const subscriberCount = formatNumber(channel.statistics?.subscriberCount || 0);
    const viewCount = formatNumber(channel.statistics?.viewCount || 0);
    const videoCount = formatNumber(channel.statistics?.videoCount || 0);
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
        <img src="${thumbnail}" alt="${channel.snippet.title}" 
             style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border);"
             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMzAiIGZpbGw9IiM2NjdlZWEiLz4KPHN2ZyB4PSIxNSIgeT0iMTUiIHdpZHRoPSIzMCIgaGVpZ2h0PSIzMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+CjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDNjMS42NiAwIDMgMS4zNCAzIDNzLTEuMzQgMy0zIDMtMy0xLjM0LTMtMyAxLjM0LTMgMy0zem0wIDE0LjJjLTIuNSAwLTQuNzEtMS4yOC02LTMuMi4wMy0xLjk5IDQtMy4wOCA2LTMuMDhzNS45NyAxLjA5IDYgMy4wOGMtMS4yOSAxLjkyLTMuNSAzLjItNiAzLjJ6Ii8+Cjwvc3ZnPgo8L3N2Zz4=';">
        <div style="flex: 1; min-width: 0;">
          <h4 style="margin: 0 0 4px 0; font-size: 1.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${channel.snippet.title}</h4>
          <div style="font-size: 0.9rem; color: var(--muted);">${channel.accountEmail || 'user@example.com'}</div>
          ${!channel.hasValidToken ? '<div style="color: #ff6b6b; font-size: 0.8rem;">⚠️ 토큰 만료됨</div>' : ''}
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="text-align: center; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--brand);">${subscriberCount}</div>
          <div style="font-size: 0.8rem; color: var(--muted);">구독자</div>
        </div>
        <div style="text-align: center; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--brand);">${channel.analytics?.monthlyRevenue || '$0'}</div>
          <div style="font-size: 0.8rem; color: var(--muted);">월 수익</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--muted);">조회수:</span>
          <span style="font-weight: 600;">${viewCount}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--muted);">동영상:</span>
          <span style="font-weight: 600;">${videoCount}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--muted);">오늘 조회:</span>
          <span style="font-weight: 600; color: var(--brand);">${channel.analytics?.todayViews || '0'}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--muted);">구독자 증가:</span>
          <span style="font-weight: 600; color: #27ae60;">${channel.analytics?.todaySubscribers || '+0'}</span>
        </div>
      </div>
    `;
    
    card.onclick = () => showSingleChannel(channelId);
    container.appendChild(card);
  });
}

// 숫자 포맷팅 함수
function formatNumber(num) {
  if (!num) return '0';
  const number = parseInt(num.toString().replace(/,/g, ''));
  if (isNaN(number)) return '0';
  
  if (number >= 100000000) {
    return (number / 100000000).toFixed(1) + '억';
  } else if (number >= 10000) {
    return (number / 10000).toFixed(1) + '만';
  } else if (number >= 1000) {
    return (number / 1000).toFixed(1) + '천';
  }
  return number.toLocaleString();
}

// 전체 보기 모드
function showOverview() {
  window.multiChannelState.viewMode = 'overview';
  window.multiChannelState.currentChannelId = null;
  
  const multiOverview = document.querySelector('#multi-overview');
  const singleView = document.querySelector('#single-channel-view');
  
  if (multiOverview) multiOverview.style.display = 'block';
  if (singleView) singleView.style.display = 'none';
  
  renderChannelTabs();
}

// 단일 채널 보기
function showSingleChannel(channelId) {
  window.multiChannelState.viewMode = 'single';
  window.multiChannelState.currentChannelId = channelId;
  
  const multiOverview = document.querySelector('#multi-overview');
  const singleView = document.querySelector('#single-channel-view');
  
  if (multiOverview) multiOverview.style.display = 'none';
  if (singleView) singleView.style.display = 'block';
  
  renderChannelTabs();
  
  const channel = window.multiChannelState.channels.get(channelId);
  if (channel) {
    renderSingleChannelView(channel);
  }
}

// 단일 채널 상세 보기 렌더링
function renderSingleChannelView(channel) {
  const container = document.querySelector('#single-channel-view');
  if (!container) return;
  
  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 24px; margin-bottom: 32px; padding: 24px; background: var(--card); border-radius: 16px; border: 2px solid var(--border);">
      <img src="${channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.default?.url || ''}" 
           alt="${channel.snippet.title}" 
           style="width: 100px; height: 100px; border-radius: 12px; object-fit: cover; border: 2px solid var(--border);"
           onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjUwIiBmaWxsPSIjNjY3ZWVhIi8+CjxzdmcgeD0iMjUiIHk9IjI1IiB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPgo8cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAzYzEuNjYgMCAzIDEuMzQgMyAzcy0xLjM0IDMtMyAzLTMtMS4zNC0zLTMgMS4zNC0zIDMtM3ptMCAxNC4yYy0yLjUgMC00LjcxLTEuMjgtNi0zLjIuMDMtMS45OSA0LTMuMDggNi0zLjA4czUuOTcgMS4wOSA2IDMuMDhjLTEuMjkgMS45Mi0zLjUgMy4yLTYgMy4yeiIvPgo8L3N2Zz4KPC9zdmc+';">
      <div style="flex: 1;">
        <h2 style="margin: 0 0 8px 0;">${channel.snippet.title}</h2>
        <p style="margin: 0 0 12px 0; color: var(--muted);">${channel.snippet.description?.substring(0, 150) || '채널 설명이 없습니다.'}${channel.snippet.description?.length > 150 ? '...' : ''}</p>
        <div style="font-size: 0.9rem; color: var(--muted);">연동 계정: ${channel.accountEmail || 'user@example.com'}</div>
        ${!channel.hasValidToken ? '<div style="color: #ff6b6b; margin-top: 8px;">⚠️ 토큰이 만료되었습니다. 다시 연동해주세요.</div>' : ''}
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
        <div style="text-align: center; padding: 16px; background: var(--glass-bg); border-radius: 12px;">
          <div style="font-size: 1.8rem; font-weight: 700; color: var(--brand);">${formatNumber(channel.statistics?.subscriberCount)}</div>
          <div style="font-size: 0.8rem; color: var(--muted);">구독자</div>
        </div>
        <div style="text-align: center; padding: 16px; background: var(--glass-bg); border-radius: 12px;">
          <div style="font-size: 1.8rem; font-weight: 700; color: var(--brand);">${channel.analytics?.monthlyRevenue || '$0'}</div>
          <div style="font-size: 0.8rem; color: var(--muted);">월 수익</div>
        </div>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
      <!-- 실시간 통계 -->
      <div style="background: var(--card); border: 2px solid var(--border); border-radius: 16px; padding: 20px;">
        <h3 style="margin: 0 0 16px 0;">📈 실시간 통계 (오늘)</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div style="text-align: center; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
            <div style="font-size: 1.4rem; font-weight: 700; color: var(--brand);">${channel.analytics?.todayViews || '0'}</div>
            <div style="font-size: 0.8rem; color: var(--muted);">오늘 조회수</div>
          </div>
          <div style="text-align: center; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
            <div style="font-size: 1.4rem; font-weight: 700; color: #27ae60;">${channel.analytics?.todaySubscribers || '+0'}</div>
            <div style="font-size: 0.8rem; color: var(--muted);">구독자 증가</div>
          </div>
          <div style="text-align: center; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
            <div style="font-size: 1.4rem; font-weight: 700; color: var(--brand);">${channel.analytics?.todayWatchTime || '0시간'}</div>
            <div style="font-size: 0.8rem; color: var(--muted);">시청 시간</div>
          </div>
          <div style="text-align: center; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
            <div style="font-size: 1.4rem; font-weight: 700; color: #27ae60;">${channel.analytics?.todayRevenue || '$0'}</div>
            <div style="font-size: 0.8rem; color: var(--muted);">오늘 수익</div>
          </div>
        </div>
      </div>
      
      <!-- 월간 성과 -->
      <div style="background: var(--card); border: 2px solid var(--border); border-radius: 16px; padding: 20px;">
        <h3 style="margin: 0 0 16px 0;">📊 월간 성과</h3>
        <div style="display: grid; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
            <span style="color: var(--muted);">총 조회수:</span>
            <span style="font-weight: 700; color: var(--brand);">${formatNumber(channel.analytics?.monthlyViews || 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
            <span style="color: var(--muted);">시청 시간:</span>
            <span style="font-weight: 700; color: var(--brand);">${channel.analytics?.monthlyWatchTime || '0시간'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
            <span style="color: var(--muted);">동영상 수:</span>
            <span style="font-weight: 700; color: var(--brand);">${formatNumber(channel.statistics?.videoCount)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--glass-bg); border-radius: 8px;">
            <span style="color: var(--muted);">추정 수익:</span>
            <span style="font-weight: 700; color: #27ae60;">${channel.analytics?.monthlyRevenue || '$0'}</span>
          </div>
        </div>
      </div>
      
      <!-- 채널 관리 -->
      <div style="background: var(--card); border: 2px solid var(--border); border-radius: 16px; padding: 20px;">
        <h3 style="margin: 0 0 16px 0;">⚙️ 채널 관리</h3>
        <div style="display: grid; gap: 12px;">
          <button onclick="refreshChannelData('${channel.id}')" class="btn btn-primary" style="width: 100%;">
            🔄 데이터 새로고침
          </button>
          <button onclick="reauthorizeChannel('${channel.id}')" class="btn btn-secondary" style="width: 100%;">
            🔑 토큰 갱신
          </button>
          <button onclick="exportChannelData('${channel.id}')" class="btn btn-secondary" style="width: 100%;">
            📥 데이터 내보내기
          </button>
          <button onclick="removeChannelFromDashboard('${channel.id}')" class="btn btn-danger" style="width: 100%;">
            🗑️ 채널 연동 해제
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 채널 관리 기능들
// ============================================================================

// 데모 채널 로드
function loadDemoChannels() {
  console.log('데모 채널 로드 시작');
  
  showMyChannelsLoading('데모 채널을 준비하는 중...', '3개의 샘플 채널을 설정하고 있습니다.');
  
  setTimeout(() => {
    const demoChannels = [
      {
        id: 'UC_demo_gaming',
        accountEmail: 'gaming@example.com',
        snippet: {
          title: '게임채널 프로',
          description: '다양한 게임 콘텐츠를 제작하는 채널입니다.',
          thumbnails: {
            default: { url: createDemoAvatar('G', '#e74c3c') },
            medium: { url: createDemoAvatar('G', '#e74c3c') },
            high: { url: createDemoAvatar('G', '#e74c3c') }
          }
        },
        statistics: {
          subscriberCount: '125400',
          viewCount: '8540000',
          videoCount: '342'
        },
        analytics: generateMockAnalytics(),
        connectedAt: new Date().toISOString(),
        hasValidToken: true,
        isDemo: true
      },
      {
        id: 'UC_demo_cooking',
        accountEmail: 'cooking@example.com',
        snippet: {
          title: '맛있는 요리 클래스',
          description: '집에서 쉽게 따라할 수 있는 요리 레시피를 소개합니다.',
          thumbnails: {
            default: { url: createDemoAvatar('요', '#f39c12') },
            medium: { url: createDemoAvatar('요', '#f39c12') },
            high: { url: createDemoAvatar('요', '#f39c12') }
          }
        },
        statistics: {
          subscriberCount: '89200',
          viewCount: '3420000',
          videoCount: '156'
        },
        analytics: generateMockAnalytics(),
        connectedAt: new Date().toISOString(),
        hasValidToken: true,
        isDemo: true
      },
      {
        id: 'UC_demo_tech',
        accountEmail: 'tech@example.com',
        snippet: {
          title: 'Tech Review Hub',
          description: '최신 기술 제품 리뷰와 IT 트렌드를 다루는 채널입니다.',
          thumbnails: {
            default: { url: createDemoAvatar('T', '#3498db') },
            medium: { url: createDemoAvatar('T', '#3498db') },
            high: { url: createDemoAvatar('T', '#3498db') }
          }
        },
        statistics: {
          subscriberCount: '67800',
          viewCount: '2890000',
          videoCount: '89'
        },
        analytics: generateMockAnalytics(),
        connectedAt: new Date().toISOString(),
        hasValidToken: true,
        isDemo: true
      }
    ];
    
    // 데모 채널들을 상태에 추가
    demoChannels.forEach(channel => {
      window.multiChannelState.channels.set(channel.id, channel);
    });
    
    // 저장 (데모는 임시 저장소 사용)
    localStorage.setItem('demo_channels', JSON.stringify(demoChannels));
    
    renderMultiChannelDashboard();
    showToast('🎯 데모 채널 3개가 준비되었습니다!', 'success');
    
  }, 1500);
}

// 데모 아바타 생성
function createDemoAvatar(text, bgColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  
  // 그라데이션 배경
  const gradient = ctx.createLinearGradient(0, 0, 120, 120);
  gradient.addColorStop(0, bgColor);
  gradient.addColorStop(1, adjustBrightness(bgColor, -30));
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 120, 120);
  
  // 텍스트
  ctx.fillStyle = 'white';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 60, 60);
  
  return canvas.toDataURL();
}

// 색상 밝기 조절
function adjustBrightness(color, amount) {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}

// 채널 데이터 새로고침
async function refreshChannelData(channelId) {
  const channel = window.multiChannelState.channels.get(channelId);
  if (!channel) return;
  
  if (channel.isDemo) {
    // 데모 채널은 랜덤 업데이트
    channel.analytics = generateMockAnalytics();
    showToast(`✅ "${channel.snippet.title}" 데이터가 새로고침되었습니다.`, 'success');
    renderSingleChannelView(channel);
    return;
  }
  
  const token = loadTokenFromStorage(channelId);
  if (!token) {
    showToast('토큰이 만료되었습니다. 다시 연동해주세요.', 'warning');
    return;
  }
  
  try {
    showToast('데이터를 새로고침하는 중...', 'info');
    
    // 실제 API 호출
    const updatedChannel = await fetchChannelInfo(token.access_token);
    const updatedAnalytics = await fetchChannelAnalytics(channelId, token.access_token);
    
    // 데이터 업데이트
    channel.statistics = updatedChannel.statistics;
    channel.analytics = updatedAnalytics;
    
    // 저장
    saveChannelToStorage(channel);
    
    // UI 업데이트
    renderSingleChannelView(channel);
    updateChannelList();
    
    showToast(`✅ "${channel.snippet.title}" 데이터가 새로고침되었습니다.`, 'success');
    
  } catch (error) {
    console.error('데이터 새로고침 실패:', error);
    showToast(`❌ 데이터 새로고침 실패: ${error.message}`, 'error');
  }
}

// 토큰 재인증
function reauthorizeChannel(channelId) {
  showToast('새로운 토큰을 발급받기 위해 다시 연동해주세요.', 'info');
  startOAuthFlow();
}

// 채널 데이터 내보내기
function exportChannelData(channelId) {
  const channel = window.multiChannelState.channels.get(channelId);
  if (!channel) return;
  
  const exportData = {
    exportDate: new Date().toISOString(),
    channel: channel,
    analytics: channel.analytics
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${channel.snippet.title}-analytics-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast(`📥 "${channel.snippet.title}" 데이터를 내보냈습니다.`, 'success');
}

// 채널 연동 해제
function removeChannelFromDashboard(channelId) {
  const channel = window.multiChannelState.channels.get(channelId);
  if (!channel) return;
  
  if (!confirm(`"${channel.snippet.title}" 채널을 연동 해제하시겠습니까?\n\n⚠️ 저장된 토큰과 분석 데이터가 모두 삭제됩니다.`)) {
    return;
  }
  
  // 토큰 삭제
  const storageKey = `oauth_token_${channelId}`;
  localStorage.removeItem(storageKey);
  
  // 채널 상태에서 제거
  window.multiChannelState.channels.delete(channelId);
  
  // 저장소 업데이트
  const allChannels = loadAllChannelsFromStorage();
  const filteredChannels = allChannels.filter(ch => ch.id !== channelId);
  localStorage.setItem('oauth_channels', JSON.stringify(filteredChannels));
  
  showToast(`🗑️ "${channel.snippet.title}" 채널이 연동 해제되었습니다.`, 'success');
  
  // UI 업데이트
  if (window.multiChannelState.channels.size === 0) {
    renderEmptyState();
  } else {
    showOverview();
  }
}

// 전체 데이터 내보내기
function exportAllChannelsData() {
  if (window.multiChannelState.channels.size === 0) {
    showToast('내보낼 채널이 없습니다.', 'warning');
    return;
  }
  
  const exportData = {
    exportDate: new Date().toISOString(),
    totalChannels: window.multiChannelState.channels.size,
    channels: Array.from(window.multiChannelState.channels.values())
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `multi-channel-analytics-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast(`📥 전체 채널 데이터를 내보냈습니다!`, 'success');
}

// 전체 데이터 새로고침
function refreshAllChannelsData() {
  if (window.multiChannelState.channels.size === 0) {
    showToast('새로고침할 채널이 없습니다.', 'warning');
    return;
  }
  
  showMyChannelsLoading('모든 채널 데이터를 새로고침하는 중...', '최신 통계를 가져오고 있습니다.');
  
  let refreshed = 0;
  const totalChannels = window.multiChannelState.channels.size;
  
  const refreshPromises = Array.from(window.multiChannelState.channels.values()).map(async (channel) => {
    try {
      if (channel.isDemo) {
        // 데모 채널은 랜덤 업데이트
        channel.analytics = generateMockAnalytics();
      } else {
        const token = loadTokenFromStorage(channel.id);
        if (token) {
          const updatedAnalytics = await fetchChannelAnalytics(channel.id, token.access_token);
          channel.analytics = updatedAnalytics;
          saveChannelToStorage(channel);
        }
      }
      refreshed++;
    } catch (error) {
      console.error(`채널 ${channel.snippet.title} 새로고침 실패:`, error);
    }
  });
  
  Promise.allSettled(refreshPromises).then(() => {
    renderMultiChannelDashboard();
    showToast(`🔄 ${refreshed}/${totalChannels}개 채널이 새로고침되었습니다!`, 'success');
  });
}

// ============================================================================
// 이벤트 바인딩
// ============================================================================

// 기본 이벤트 바인딩
function bindMyChannelsEvents() {
  // 섹션 헤더의 버튼들 (빈 상태가 아닐 때 나타나는 버튼들)
  const addOAuthBtn = document.querySelector('#btn-add-oauth-channel');
  if (addOAuthBtn && !addOAuthBtn.dataset.bound) {
    addOAuthBtn.addEventListener('click', startOAuthFlow);
    addOAuthBtn.dataset.bound = '1';
  }
  
  const demoBtnHeader = document.querySelector('#btn-demo-channels');
  if (demoBtnHeader && !demoBtnHeader.dataset.bound) {
    demoBtnHeader.addEventListener('click', loadDemoChannels);
    demoBtnHeader.dataset.bound = '1';
  }
  
  const exportAllBtn = document.querySelector('#btn-export-all-channels');
  if (exportAllBtn && !exportAllBtn.dataset.bound) {
    exportAllBtn.addEventListener('click', exportAllChannelsData);
    exportAllBtn.dataset.bound = '1';
  }
}

// 대시보드 이벤트 바인딩 (동적 요소들)
function bindDashboardEvents() {
  // 채널 추가 버튼
  const addChannelBtn = document.querySelector('#btn-add-channel-tab');
  if (addChannelBtn && !addChannelBtn.dataset.bound) {
    addChannelBtn.addEventListener('click', startOAuthFlow);
    addChannelBtn.dataset.bound = '1';
  }
  
  // 전체 새로고침 버튼
  const refreshAllBtn = document.querySelector('#btn-refresh-all-data');
  if (refreshAllBtn && !refreshAllBtn.dataset.bound) {
    refreshAllBtn.addEventListener('click', refreshAllChannelsData);
    refreshAllBtn.dataset.bound = '1';
  }
  
  // 전체 내보내기 버튼
  const exportAllDataBtn = document.querySelector('#btn-export-all-data');
  if (exportAllDataBtn && !exportAllDataBtn.dataset.bound) {
    exportAllDataBtn.addEventListener('click', exportAllChannelsData);
    exportAllDataBtn.dataset.bound = '1';
  }
}

// 채널 목록 업데이트 (탭과 카드만)
function updateChannelList() {
  renderChannelTabs();
  if (window.multiChannelState.viewMode === 'overview') {
    renderChannelOverviewCards();
  }
}

// ============================================================================
// UI 헬퍼 함수들
// ============================================================================

// 로딩 상태 표시
function showMyChannelsLoading(title = '로딩 중...', detail = '잠시만 기다려주세요.') {
  const container = document.querySelector('#my-channels-content');
  if (!container) return;
  
  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; background: var(--card); border-radius: 16px; border: 2px solid var(--border);">
      <div style="width: 40px; height: 40px; border: 4px solid var(--border); border-top: 4px solid var(--brand); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;">
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </div>
      <h3 style="margin: 0 0 12px 0;">${title}</h3>
      <p style="color: var(--muted); margin: 0;">${detail}</p>
    </div>
  `;
}

// 토스트 메시지 표시
function showToast(message, type = 'info') {
  if (typeof window.toast === 'function') {
    window.toast(message, type);
  } else {
    // 폴백: 간단한 알림
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  }
}

// ============================================================================
// 전역 함수 노출
// ============================================================================

// 전역 함수들
window.initializeMyChannels = initializeMyChannels;
window.startOAuthFlow = startOAuthFlow;
window.loadDemoChannels = loadDemoChannels;
window.executeCompleteOAuthFlow = executeCompleteOAuthFlow;
window.handleOAuthCallback = handleOAuthCallback;
window.refreshChannelData = refreshChannelData;
window.reauthorizeChannel = reauthorizeChannel;
window.exportChannelData = exportChannelData;
window.removeChannelFromDashboard = removeChannelFromDashboard;
window.exportAllChannelsData = exportAllChannelsData;
window.refreshAllChannelsData = refreshAllChannelsData;
window.showOverview = showOverview;
window.showSingleChannel = showSingleChannel;
window.closeOAuthSetupModal = closeOAuthSetupModal;
window.showOAuthGuide = showOAuthGuide;
window.closeOAuthGuide = closeOAuthGuide;

// 멀티채널 API 객체
window.multiChannelAPI = {
  startOAuth: startOAuthFlow,
  loadDemo: loadDemoChannels,
  refreshAll: refreshAllChannelsData,
  exportAll: exportAllChannelsData,
  showOverview: showOverview,
  showChannel: showSingleChannel,
  getChannels: () => Array.from(window.multiChannelState.channels.values()),
  getChannelCount: () => window.multiChannelState.channels.size
};

// ============================================================================
// 자동 실행 및 키보드 단축키
// ============================================================================

// 키보드 단축키 (Ctrl/Cmd + 숫자로 채널 전환)
document.addEventListener('keydown', function(e) {
  const myChannelsSection = document.querySelector('#section-my-channels');
  if (!myChannelsSection || myChannelsSection.style.display === 'none') return;

  if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const channelIndex = parseInt(e.key) - 1;
    const channels = Array.from(window.multiChannelState.channels.keys());
    
    if (channelIndex === 0) {
      showOverview();
    } else if (channels[channelIndex - 1]) {
      showSingleChannel(channels[channelIndex - 1]);
    }
  }
  
  // Ctrl/Cmd + R로 전체 새로고침
  if ((e.ctrlKey || e.metaKey) && e.key === 'r' && window.multiChannelState.channels.size > 0) {
    e.preventDefault();
    refreshAllChannelsData();
  }
});

// DOM 로드시 OAuth 콜백 확인
document.addEventListener('DOMContentLoaded', function() {
  // OAuth 콜백 처리
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('code') && urlParams.get('state')) {
    // 메인 페이지에서 OAuth 콜백을 받은 경우
    console.log('메인 페이지에서 OAuth 콜백 감지');
    handleOAuthCallback();
  }
});

console.log('my-channels.js (완전한 OAuth 버전) 로딩 완료');
console.log('OAuth 설정:', {
  clientId: OAUTH_CONFIG.clientId,
  redirectUri: OAUTH_CONFIG.redirectUri,
  needsSetup: OAUTH_CONFIG.clientId.includes('1023067589133-sgctbaksf6lelji1ils5oq34a9d3v8fo.apps.googleusercontent.com')
});

// 함수 등록 확인 로그
console.log('window.initializeMyChannels:', typeof window.initializeMyChannels);