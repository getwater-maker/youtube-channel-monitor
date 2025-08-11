// 유틸리티 함수들
const qs = id => document.getElementById(id);
const fmt = n => { 
  const x = parseInt(n || '0', 10); 
  return isNaN(x) ? '0' : x.toLocaleString(); 
};
const seconds = iso => moment.duration(iso).asSeconds();

// 불용어 목록
const stopWords = new Set([
  '은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '도', '로', '으로',
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'but', 'with', 'about',
  '에서', '같은', '뿐', '위해', '합니다', '했다', '하는', '하기', '진짜', '무너졌다', 'into'
]);

function toast(msg, ms = 1800) { 
  const t = qs('toast'); 
  t.textContent = msg; 
  t.style.display = 'block'; 
  setTimeout(() => t.style.display = 'none', ms); 
}

function showError(elementId, message) { 
  qs(elementId).innerHTML = `<div class="error-message">${message}</div>`; 
}

function showSuccess(elementId, message) { 
  qs(elementId).innerHTML = `<div class="success-message">${message}</div>`; 
}

function extractKeywords(text) {
  const freq = new Map();
  if (!text) return [];
  
  text.replace(/[#"'.!?()/\-:;[\]{}|<>~^%$@*&+=]/g, ' ')
    .split(/\s+/)
    .forEach(w => {
      w = w.trim().toLowerCase(); 
      const hasKo = /[가-힣]/.test(w);
      if (!w) return;
      if ((hasKo && w.length < 2) || (!hasKo && w.length < 3)) return;
      if (stopWords.has(w)) return;
      freq.set(w, (freq.get(w) || 0) + 1);
    });
    
  // 1회만 등장한 키워드 제외
  return [...freq.entries()]
    .filter(([word, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);
}

// 텍스트 줄이기 (말줄임표)
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// 페이지네이션 렌더링
function renderPagination(containerId, currentPage, totalItems, itemsPerPage, onPageChange) {
  const container = qs(containerId);
  if (!container) return;
  
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  container.innerHTML = '';
  
  // 이전 페이지 버튼
  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '이전';
    prevBtn.onclick = () => onPageChange(currentPage - 1);
    container.appendChild(prevBtn);
  }
  
  // 페이지 번호 버튼들
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) {
      btn.className = 'active';
    }
    btn.onclick = () => onPageChange(i);
    container.appendChild(btn);
  }
  
  // 다음 페이지 버튼
  if (currentPage < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '다음';
    nextBtn.onclick = () => onPageChange(currentPage + 1);
    container.appendChild(nextBtn);
  }
}
