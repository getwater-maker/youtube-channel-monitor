// YouTube 채널 모니터 - 내채널 관리 (간소화 버전)
console.log('my-channels.js 로딩 시작');

// ============================================================================
// 내채널 상태 관리
// ============================================================================
window.myChannelsState = {
  channels: new Map(),
  currentChannelId: null,
  viewMode: 'overview'
};

// ============================================================================
// 유틸리티 함수들
// ============================================================================

// 숫자 포맷팅
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

// 토스트 메시지
function showToast(message, type = 'info') {
  if (typeof window.toast === 'function') {
    window.toast(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  }
}

// 데모 아바타 생성
function createDemoAvatar(text, bgColor) {
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="40" fill="${bgColor}"/>
      <text x="40" y="50" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">${text}</text>
    </svg>
  `)}`;
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

  if (window.myChannelsState.channels.size > 0) {
    renderChannelDashboard();
  } else {
    renderEmptyState();
  }

  // 이벤트 바인딩
  bindMyChannelsEvents();
  
  console.log('내채널 초기화 완료');
}

// 저장된 채널들 로드
function loadStoredChannels() {
  try {
    // 데모 채널들 로드
    const demoChannels = localStorage.getItem('demo_channels');
    if (demoChannels) {
      const channels = JSON.parse(demoChannels);
      channels.forEach(channel => {
        window.myChannelsState.channels.set(channel.id, channel);
      });
    }
    
    // OAuth 채널들 로드
    const oauthChannels = localStorage.getItem('oauth_channels');
    if (oauthChannels) {
      const channels = JSON.parse(oauthChannels);
      channels.forEach(channel => {
        channel.hasValidToken = true; // 임시로 true 설정
        window.myChannelsState.channels.set(channel.id, channel);
      });
    }
    
    console.log('저장된 채널 로드:', window.myChannelsState.channels.size + '개');
  } catch (e) {
    console.error('채널 로드 실패:', e);
  }
}

// 빈 상태 렌더링
function renderEmptyState() {
  const container = document.querySelector('#my-channels-content');
  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; background: var(--card); border-radius: 16px; border: 2px solid var(--border);">
      <div style="font-size: 3rem; margin-bottom: 16px;">📋</div>
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
  
  // 버튼 이벤트 바인딩
  setTimeout(() => {
    const oauthBtn = document.getElementById('btn-start-oauth');
    if (oauthBtn) {
      oauthBtn.addEventListener('click', startOAuthFlow);
    }
    
    const demoBtn = document.getElementById('btn-load-demo-channels');
    if (demoBtn) {
      demoBtn.addEventListener('click', loadDemoChannels);
    }
  }, 100);
}

// 채널 대시보드 렌더링
function renderChannelDashboard() {
  const container = document.querySelector('#my-channels-content');
  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <h3>📊 내 채널들 (${window.myChannelsState.channels.size}개)</h3>
      <div style="display: flex; gap: 8px;">
        <button id="btn-add-more-channels" class="btn btn-primary">➕ 채널 추가</button>
        <button id="btn-refresh-channels" class="btn btn-secondary">🔄 새로고침</button>
        <button id="btn-export-channels-data" class="btn btn-secondary">📥 내보내기</button>
      </div>
    </div>

    <div id="channels-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
      <!-- 채널 카드들이 여기에 동적으로 생성됩니다 -->
    </div>
  `;

  renderChannelCards();
  bindDashboardEvents();
}

// 채널 카드들 렌더링
function renderChannelCards() {
  const container = document.querySelector('#channels-grid');
  if (!container) return;
  
  container.innerHTML = '';
  
  window.myChannelsState.channels.forEach((channel) => {
    const card = document.createElement('div');
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

    const thumbnail = channel.snippet?.thumbnails?.medium?.url || 
                     channel.snippet?.thumbnails?.default?.url || 
                     createDemoAvatar(channel.snippet?.title?.charAt(0) || 'C', '#667eea');
    const subscriberCount = formatNumber(channel.statistics?.subscriberCount || 0);
    const viewCount = formatNumber(channel.statistics?.viewCount || 0);
    const videoCount = formatNumber(channel.statistics?.videoCount || 0);
    
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
        <img src="${thumbnail}" alt="${channel.snippet?.title || '채널'}" 
             style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border);">
        <div style="flex: 1; min-width: 0;">
          <h4 style="margin: 0 0 4px 0; font-size: 1.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${channel.snippet?.title || '알 수 없는 채널'}</h4>
          <div style="font-size: 0.9rem; color: var(--muted);">${channel.accountEmail || 'user@example.com'}</div>
          ${channel.isDemo ? '<div style="color: #667eea; font-size: 0.8rem;">🎯 데모 채널</div>' : ''}
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
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; margin-bottom: 12px;">
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
      
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn btn-secondary btn-sm" onclick="viewChannelDetails('${channel.id}')" style="font-size: 12px; padding: 6px 12px;">상세보기</button>
        <button class="btn btn-danger btn-sm" onclick="removeChannel('${channel.id}')" style="font-size: 12px; padding: 6px 12px;">제거</button>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// ============================================================================
// 채널 관리 기능들
// ============================================================================

// OAuth 인증 시작
function startOAuthFlow() {
  if (typeof window.oAuthManager?.startOAuthFlow === 'function') {
    window.oAuthManager.startOAuthFlow();
  } else {
    console.warn('OAuth 인증 기능이 준비되지 않았습니다.');
    showToast('OAuth 인증 기능을 준비 중입니다. 데모 채널로 체험해보세요.', 'info');
  }
}

// 데모 채널 로드
function loadDemoChannels() {
  console.log('데모 채널 로드 시작');
  
  showLoading('데모 채널을 준비하는 중...', '3개의 샘플 채널을 설정하고 있습니다.');
  
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
            medium: { url: createDemoAvatar('G', '#e74c3c') }
          }
        },
        statistics: {
          subscriberCount: '125400',
          viewCount: '8540000',
          videoCount: '342'
        },
        analytics: generateMockAnalytics(),
        connectedAt: new Date().toISOString(),
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
            medium: { url: createDemoAvatar('요', '#f39c12') }
          }
        },
        statistics: {
          subscriberCount: '89200',
          viewCount: '3420000',
          videoCount: '156'
        },
        analytics: generateMockAnalytics(),
        connectedAt: new Date().toISOString(),
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
            medium: { url: createDemoAvatar('T', '#3498db') }
          }
        },
        statistics: {
          subscriberCount: '67800',
          viewCount: '2890000',
          videoCount: '89'
        },
        analytics: generateMockAnalytics(),
        connectedAt: new Date().toISOString(),
        isDemo: true
      }
    ];
    
    // 데모 채널들을 상태에 추가
    demoChannels.forEach(channel => {
      window.myChannelsState.channels.set(channel.id, channel);
    });
    
    // 저장
    localStorage.setItem('demo_channels', JSON.stringify(demoChannels));
    
    renderChannelDashboard();
    showToast('🎯 데모 채널 3개가 준비되었습니다!', 'success');
    
  }, 1500);
}

// 채널 상세보기
function viewChannelDetails(channelId) {
  const channel = window.myChannelsState.channels.get(channelId);
  if (!channel) return;
  
  showToast(`"${channel.snippet?.title}" 채널 상세보기 기능은 준비 중입니다.`, 'info');
}

// 채널 제거
function removeChannel(channelId) {
  const channel = window.myChannelsState.channels.get(channelId);
  if (!channel) return;
  
  if (!confirm(`"${channel.snippet?.title}" 채널을 제거하시겠습니까?`)) {
    return;
  }
  
  // 상태에서 제거
  window.myChannelsState.channels.delete(channelId);
  
  // 저장소에서 제거
  if (channel.isDemo) {
    const demoChannels = Array.from(window.myChannelsState.channels.values()).filter(ch => ch.isDemo);
    localStorage.setItem('demo_channels', JSON.stringify(demoChannels));
  }
  
  showToast(`"${channel.snippet?.title}" 채널이 제거되었습니다.`, 'success');
  
  // UI 업데이트
  if (window.myChannelsState.channels.size === 0) {
    renderEmptyState();
  } else {
    renderChannelCards();
  }
}

// 전체 데이터 내보내기
function exportAllChannelsData() {
  if (window.myChannelsState.channels.size === 0) {
    showToast('내보낼 채널이 없습니다.', 'warning');
    return;
  }
  
  const exportData = {
    exportDate: new Date().toISOString(),
    totalChannels: window.myChannelsState.channels.size,
    channels: Array.from(window.myChannelsState.channels.values())
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-channels-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast('📥 채널 데이터를 내보냈습니다!', 'success');
}

// 채널 데이터 새로고침
function refreshChannelsData() {
  if (window.myChannelsState.channels.size === 0) {
    showToast('새로고침할 채널이 없습니다.', 'warning');
    return;
  }
  
  showLoading('채널 데이터를 새로고침하는 중...', '최신 통계를 가져오고 있습니다.');
  
  // 데모 채널들의 분석 데이터 업데이트
  window.myChannelsState.channels.forEach(channel => {
    if (channel.isDemo) {
      channel.analytics = generateMockAnalytics();
    }
  });
  
  setTimeout(() => {
    renderChannelCards();
    showToast('🔄 채널 데이터가 새로고침되었습니다!', 'success');
  }, 1000);
}

// ============================================================================
// UI 헬퍼 함수들
// ============================================================================

// 로딩 상태 표시
function showLoading(title = '로딩 중...', detail = '잠시만 기다려주세요.') {
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

// ============================================================================
// 이벤트 바인딩
// ============================================================================

// 기본 이벤트 바인딩
function bindMyChannelsEvents() {
  console.log('내채널 이벤트 바인딩');
  
  // 헤더 버튼들
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

// 대시보드 이벤트 바인딩
function bindDashboardEvents() {
  const addMoreBtn = document.querySelector('#btn-add-more-channels');
  if (addMoreBtn && !addMoreBtn.dataset.bound) {
    addMoreBtn.addEventListener('click', startOAuthFlow);
    addMoreBtn.dataset.bound = '1';
  }
  
  const refreshBtn = document.querySelector('#btn-refresh-channels');
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.addEventListener('click', refreshChannelsData);
    refreshBtn.dataset.bound = '1';
  }
  
  const exportBtn = document.querySelector('#btn-export-channels-data');
  if (exportBtn && !exportBtn.dataset.bound) {
    exportBtn.addEventListener('click', exportAllChannelsData);
    exportBtn.dataset.bound = '1';
  }
}

// ============================================================================
// 전역 함수 노출
// ============================================================================

// 전역 함수들
window.initializeMyChannels = initializeMyChannels;
window.startOAuthFlow = startOAuthFlow;
window.loadDemoChannels = loadDemoChannels;
window.viewChannelDetails = viewChannelDetails;
window.removeChannel = removeChannel;
window.exportAllChannelsData = exportAllChannelsData;
window.refreshChannelsData = refreshChannelsData;

console.log('my-channels.js 로딩 완료');