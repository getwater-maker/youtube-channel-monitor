// YouTube 채널 모니터 - 네비게이션 관리
console.log('navigation.js 로딩 시작');

// ============================================================================
// 네비게이션 상태 관리
// ============================================================================
window.navigationState = {
  currentSection: 'my-channels', // 기본 섹션을 내채널로 변경
  initialized: false
};

// ============================================================================
// 섹션 전환 함수
// ============================================================================
function showSection(sectionName) {
  console.log('섹션 전환:', sectionName);
  
  // 현재 상태 업데이트
  window.navigationState.currentSection = sectionName;
  
  // 모든 섹션 숨기기
  const sections = document.querySelectorAll('.section');
  sections.forEach(section => {
    section.style.display = 'none';
  });
  
  // 선택된 섹션만 보이기
  const targetSection = document.getElementById(`section-${sectionName}`);
  if (targetSection) {
    targetSection.style.display = 'block';
  }
  
  // 네비게이션 버튼 상태 업데이트
  updateNavButtons(sectionName);
  
  // 섹션별 데이터 로드
  loadSectionData(sectionName);
}

// 네비게이션 버튼 상태 업데이트
function updateNavButtons(activeSectionName) {
  const navButtons = document.querySelectorAll('.nav-section');
  navButtons.forEach(btn => {
    btn.classList.remove('active');
  });
  
  // 내채널 섹션의 경우 btn-my-channels 버튼을 활성화
  let activeButtonId = `btn-${activeSectionName}`;
  if (activeSectionName === 'my-channels') {
    activeButtonId = 'btn-my-channels';
  }
  
  const activeButton = document.getElementById(activeButtonId);
  if (activeButton) {
    activeButton.classList.add('active');
  }
}

// 섹션별 데이터 로드
function loadSectionData(sectionName) {
  console.log('섹션 데이터 로드:', sectionName);
  
  switch (sectionName) {
    case 'my-channels':
      // 내채널 초기화
      if (typeof window.initializeMyChannels === 'function') {
        window.initializeMyChannels();
      } else {
        console.warn('initializeMyChannels 함수를 찾을 수 없습니다. my-channels.js가 로드되었는지 확인하세요.');
      }
      break;
    case 'channels':
      if (typeof window.refreshChannels === 'function') {
        window.refreshChannels();
      }
      break;
    case 'mutant':
      if (typeof window.refreshMutant === 'function') {
        window.refreshMutant();
      }
      break;
    case 'latest':
      if (typeof window.refreshLatest === 'function') {
        window.refreshLatest();
      }
      break;
    default:
      console.warn('알 수 없는 섹션:', sectionName);
  }
}

// ============================================================================
// 네비게이션 이벤트 바인딩
// ============================================================================
function bindNavigationEvents() {
  console.log('네비게이션 이벤트 바인딩 시작');
  
  // 섹션 버튼들에 이벤트 리스너 추가
  const sectionButtons = [
    { id: 'btn-my-channels', section: 'my-channels' },
    { id: 'btn-channels', section: 'channels' },
    { id: 'btn-mutant', section: 'mutant' },
    { id: 'btn-latest', section: 'latest' }
  ];
  
  sectionButtons.forEach(({ id, section }) => {
    const button = document.getElementById(id);
    if (button && !button.dataset.navBound) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        
        // API 키 체크 (내채널과 채널관리 제외)
        if (section !== 'my-channels' && section !== 'channels') {
          if (!window.hasKeys || !window.hasKeys()) {
            if (window.toast) {
              window.toast('먼저 API 키를 설정해주세요.\n우상단의 🔑 API 키 버튼을 클릭하세요.', 'warning');
            }
            return;
          }
        }
        
        showSection(section);
      });
      button.dataset.navBound = '1';
      console.log(`${id} 버튼 이벤트 바인딩 완료`);
    } else if (!button) {
      console.warn(`버튼을 찾을 수 없음: ${id}`);
    }
  });
}

// ============================================================================
// 초기화
// ============================================================================
function initializeNavigation() {
  console.log('네비게이션 초기화 시작');
  
  if (window.navigationState.initialized) {
    console.log('네비게이션이 이미 초기화됨');
    return;
  }
  
  // 이벤트 바인딩
  bindNavigationEvents();
  
  // 초기 섹션 표시 (내채널을 기본으로)
  showSection('my-channels');
  
  // 초기화 완료 표시
  window.navigationState.initialized = true;
  
  console.log('네비게이션 초기화 완료');
}

// ============================================================================
// 페이지 히스토리 관리 (브라우저 뒤로가기/앞으로가기)
// ============================================================================
function initializeHistoryManagement() {
  // URL 해시 기반 섹션 관리
  function handleHashChange() {
    const hash = window.location.hash.substring(1); // # 제거
    const validSections = ['my-channels', 'channels', 'mutant', 'latest'];
    
    if (validSections.includes(hash)) {
      showSection(hash);
    } else if (!hash) {
      showSection('my-channels'); // 기본 섹션
    }
  }
  
  // 해시 변경 이벤트 리스너
  window.addEventListener('hashchange', handleHashChange);
  
  // 초기 로드시 해시 확인
  handleHashChange();
}

// 섹션 변경시 URL 해시 업데이트
function updateUrlHash(sectionName) {
  if (window.history && window.history.pushState) {
    const newHash = `#${sectionName}`;
    if (window.location.hash !== newHash) {
      window.history.pushState(null, null, newHash);
    }
  }
}

// showSection 함수에 URL 업데이트 추가
const originalShowSection = showSection;
showSection = function(sectionName) {
  originalShowSection(sectionName);
  updateUrlHash(sectionName);
};

// ============================================================================
// 반응형 네비게이션 (모바일 지원)
// ============================================================================
function initializeResponsiveNavigation() {
  // 모바일에서 네비게이션 버튼 축약
  function updateNavigationForScreenSize() {
    const navButtons = document.querySelector('.nav-buttons');
    if (!navButtons) return;
    
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // 모바일에서는 텍스트 축약
      const buttons = navButtons.querySelectorAll('.nav-section');
      buttons.forEach(btn => {
        const text = btn.textContent.trim();
        if (text.includes('내채널들')) btn.textContent = '👥';
        if (text.includes('채널관리')) btn.textContent = '📺';
        if (text.includes('돌연변이')) btn.textContent = '🚀';
        if (text.includes('최신')) btn.textContent = '📱';
      });
    } else {
      // 데스크톱에서는 전체 텍스트
      const myChannelsBtn = document.getElementById('btn-my-channels');
      const channelsBtn = document.getElementById('btn-channels');
      const mutantBtn = document.getElementById('btn-mutant');
      const latestBtn = document.getElementById('btn-latest');
      
      if (myChannelsBtn && myChannelsBtn.textContent.trim() === '👥') {
        myChannelsBtn.textContent = '👥 내채널들';
      }
      if (channelsBtn && channelsBtn.textContent.trim() === '📺') {
        channelsBtn.textContent = '📺 채널관리';
      }
      if (mutantBtn && mutantBtn.textContent.trim() === '🚀') {
        mutantBtn.textContent = '🚀 돌연변이';
      }
      if (latestBtn && latestBtn.textContent.trim() === '📱') {
        latestBtn.textContent = '📱 최신';
      }
    }
  }
  
  // 리사이즈 이벤트 리스너
  window.addEventListener('resize', updateNavigationForScreenSize);
  
  // 초기 실행
  updateNavigationForScreenSize();
}

// ============================================================================
// 섹션 전환 애니메이션
// ============================================================================
function initializeSectionAnimations() {
  const originalShowSection = showSection;
  
  showSection = function(sectionName) {
    // 현재 활성 섹션에 fade-out 효과
    const currentSection = document.querySelector('.section[style*="block"]');
    if (currentSection) {
      currentSection.style.opacity = '0.5';
      currentSection.style.transform = 'translateY(-10px)';
    }
    
    // 섹션 전환
    originalShowSection(sectionName);
    
    // 새 섹션에 fade-in 효과
    const newSection = document.getElementById(`section-${sectionName}`);
    if (newSection) {
      newSection.style.opacity = '0';
      newSection.style.transform = 'translateY(10px)';
      
      // 애니메이션 실행
      setTimeout(() => {
        newSection.style.transition = 'all 0.3s ease';
        newSection.style.opacity = '1';
        newSection.style.transform = 'translateY(0)';
      }, 50);
      
      // 애니메이션 정리
      setTimeout(() => {
        newSection.style.transition = '';
      }, 350);
    }
    
    // URL 해시 업데이트
    updateUrlHash(sectionName);
  };
}

// ============================================================================
// 네비게이션 상태 저장/복구
// ============================================================================
function saveNavigationState() {
  localStorage.setItem('lastActiveSection', window.navigationState.currentSection);
}

function restoreNavigationState() {
  const savedSection = localStorage.getItem('lastActiveSection');
  const validSections = ['my-channels', 'channels', 'mutant', 'latest'];
  
  // URL 해시가 있으면 우선, 없으면 저장된 섹션, 그것도 없으면 내채널
  const hash = window.location.hash.substring(1);
  let targetSection = 'my-channels';
  
  if (validSections.includes(hash)) {
    targetSection = hash;
  } else if (validSections.includes(savedSection)) {
    targetSection = savedSection;
  }
  
  return targetSection;
}

// 페이지 떠날 때 상태 저장
window.addEventListener('beforeunload', saveNavigationState);

// ============================================================================
// 네비게이션 디버그 도구
// ============================================================================
function addNavigationDebugInfo() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 개발 환경에서만 디버그 정보 표시
    const debugInfo = document.createElement('div');
    debugInfo.id = 'nav-debug';
    debugInfo.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 9999;
    `;
    
    function updateDebugInfo() {
      debugInfo.textContent = `현재 섹션: ${window.navigationState.currentSection}`;
    }
    
    updateDebugInfo();
    document.body.appendChild(debugInfo);
    
    // 섹션 변경시 디버그 정보 업데이트
    const originalShowSection = showSection;
    showSection = function(sectionName) {
      originalShowSection(sectionName);
      updateDebugInfo();
    };
  }
}

// ============================================================================
// 전역 함수 노출
// ============================================================================
window.showSection = showSection;
window.updateNavButtons = updateNavButtons;
window.loadSectionData = loadSectionData;
window.bindNavigationEvents = bindNavigationEvents;
window.initializeNavigation = initializeNavigation;
window.saveNavigationState = saveNavigationState;
window.restoreNavigationState = restoreNavigationState;

// ============================================================================
// 통합 초기화 함수
// ============================================================================
function initializeNavigationSystem() {
  console.log('네비게이션 시스템 통합 초기화 시작');
  
  // 기본 네비게이션 초기화
  initializeNavigation();
  
  // 히스토리 관리 초기화
  initializeHistoryManagement();
  
  // 반응형 네비게이션 초기화
  initializeResponsiveNavigation();
  
  // 섹션 애니메이션 초기화 (선택사항)
  // initializeSectionAnimations();
  
  // 디버그 정보 추가 (개발 환경에서만)
  addNavigationDebugInfo();
  
  // 저장된 네비게이션 상태 복구
  const initialSection = restoreNavigationState();
  showSection(initialSection);
  
  console.log('네비게이션 시스템 초기화 완료');
}

// ============================================================================
// 자동 초기화 (DOM이 준비되면)
// ============================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNavigationSystem);
} else {
  // 이미 DOM이 로드된 경우 즉시 실행
  initializeNavigationSystem();
}

// ============================================================================
// 네비게이션 유틸리티 함수들
// ============================================================================

// 현재 활성 섹션 가져오기
function getCurrentSection() {
  return window.navigationState.currentSection;
}

// 섹션이 활성화되어 있는지 확인
function isSectionActive(sectionName) {
  return window.navigationState.currentSection === sectionName;
}

// 다음/이전 섹션으로 이동
function navigateToNextSection() {
  const sections = ['my-channels', 'channels', 'mutant', 'latest'];
  const currentIndex = sections.indexOf(window.navigationState.currentSection);
  const nextIndex = (currentIndex + 1) % sections.length;
  showSection(sections[nextIndex]);
}

function navigateToPreviousSection() {
  const sections = ['my-channels', 'channels', 'mutant', 'latest'];
  const currentIndex = sections.indexOf(window.navigationState.currentSection);
  const prevIndex = currentIndex === 0 ? sections.length - 1 : currentIndex - 1;
  showSection(sections[prevIndex]);
}

// 키보드 네비게이션 (화살표 키)
function initializeKeyboardNavigation() {
  document.addEventListener('keydown', function(e) {
    // Alt + 좌우 화살표로 섹션 이동
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      navigateToNextSection();
    } else if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateToPreviousSection();
    }
    
    // Alt + 숫자 키로 직접 섹션 이동
    if (e.altKey && e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      const sections = ['my-channels', 'channels', 'mutant', 'latest'];
      const sectionIndex = parseInt(e.key) - 1;
      if (sections[sectionIndex]) {
        showSection(sections[sectionIndex]);
      }
    }
  });
}

// 초기화에 키보드 네비게이션 추가
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initializeKeyboardNavigation, 1000);
});

// 전역 유틸리티 함수 노출
window.getCurrentSection = getCurrentSection;
window.isSectionActive = isSectionActive;
window.navigateToNextSection = navigateToNextSection;
window.navigateToPreviousSection = navigateToPreviousSection;

console.log('navigation.js 로딩 완료');