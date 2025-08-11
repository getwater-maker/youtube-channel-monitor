// UI 관련 함수들
function openModal(id) { 
  qs(id).style.display = 'flex'; 
}

function closeModal(id) { 
  qs(id).style.display = 'none'; 
}

function initDrag() { 
  const el = qs('main-content'); 
  const saved = localStorage.getItem('colOrder'); 
  
  if (saved) { 
    saved.split(',').forEach(k => { 
      const sec = el.querySelector(`[data-col="${k}"]`); 
      if (sec) el.appendChild(sec); 
    }); 
  } 
  
  Sortable.create(el, {
    animation: 150,
    handle: '.col-head',
    onSort: () => {
      const keys = [...el.children].map(n => n.getAttribute('data-col')); 
      localStorage.setItem('colOrder', keys.join(','));
    }
  }); 
}

function showHome(forceReload = false) {
  if (forceReload) { 
    location.reload(); 
    return; 
  }
  
  const container = document.body.querySelector('.container');
  const analysisSection = qs('analysis-section');
  if (analysisSection) analysisSection.remove();
  
  let mainContent = qs('main-content');
  state.currentView = 'home';
  
  if (!mainContent) {
    mainContent = document.createElement('div');
    mainContent.id = 'main-content';
    mainContent.className = 'three-col';
    container.appendChild(mainContent);
  } else {
    mainContent.innerHTML = '';
    mainContent.style.display = '';
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  refreshAll();
}

function toggleTheme() {
  const body = document.body;
  const btn = qs('btn-toggle-theme');
  
  if (body.classList.contains('dark')) {
    body.classList.remove('dark');
    body.classList.add('light');
    btn.textContent = '다크 모드';
    localStorage.setItem('theme', 'light');
  } else {
    body.classList.remove('light');
    body.classList.add('dark');
    btn.textContent = '라이트 모드';
    localStorage.setItem('theme', 'dark');
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark'; // 기본값을 dark로 변경
  document.body.classList.add(savedTheme);
  qs('btn-toggle-theme').textContent = savedTheme === 'dark' ? '라이트 모드' : '다크 모드';
}

// 전체 갱신
async function refreshAll(which) {
  if (!hasKeys()) { 
    toast('API 키를 설정해주세요.'); 
    return; 
  }
  
  if (state.currentView === 'home') {
    if (!which || which === 'channels') await refreshChannels();
    if (!which || which === 'mutant') await refreshMutant();
    if (!which || which === 'latest') await refreshLatest();
  }
}
