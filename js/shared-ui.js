// js/shared-ui.js

const h = (s)=> (s??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m]));
const num = (n)=> Number(n||0);

/**
 * 공통 영상 카드 컴포넌트를 생성합니다.
 * @param {object} v - 비디오 데이터 객체
 * @param {object} options - 카드 옵션 { showDoneButton: boolean, isDone: boolean }
 * @returns {HTMLElement} 생성된 카드 Element
 */
export function createVideoCard(v, options = { showDoneButton: false, isDone: false }) {
  const { showDoneButton, isDone } = options;
  
  const doneButtonHtml = `
    <button 
      class="btn btn-sm ${isDone ? 'btn-outline' : 'btn-success'} btn-toggle-done" 
      style="${!showDoneButton ? 'display: none;' : ''}"
    >
      ${isDone ? '완료취소' : '작업완료'}
    </button>
  `;

  const card = document.createElement('div');
  card.className = `video-card ${isDone ? 'is-done' : ''}`;
  card.innerHTML = `
    <div class="thumb-wrap">
      <a href="https://youtu.be/${h(v.id)}" target="_blank" rel="noopener">
        <img class="thumb" src="https://i.ytimg.com/vi/${h(v.id)}/mqdefault.jpg" alt="${h(v.title)}">
      </a>
    </div>
    <div class="video-body">
      <div class="title">${h(v.title)}</div>
      <div class="meta">
        <a href="https://www.youtube.com/channel/${h(v.channel.id)}" target="_blank" rel="noopener">
          <img src="${h(v.channel.thumb)}" alt="${h(v.channel.name)}">
        </a>
        <span>${h(v.channel.name)}</span>
        <span class="muted" style="margin-left: auto;">${num(v.channel.subs).toLocaleString()}명</span>
      </div>
      <div class="v-meta">
        <div class="v-meta-top">
          <span class="mutant-indicator">지수: ${v.mutant.toFixed(1)}</span>
          <span>조회수 ${num(v.views).toLocaleString()}회</span>
          <span class="muted">${new Date(v.publishedAt).toLocaleDateString('ko-KR')}</span>
        </div>
      </div>
    </div>
    <div class="video-actions" style="flex-wrap: wrap; justify-content: flex-start; gap: 6px;">
      <button class="btn btn-sm btn-outline btn-copy-thumb">썸복사</button>
      <button class="btn btn-sm btn-outline btn-download-thumb">썸다운</button>
      <button class="btn btn-sm btn-outline btn-copy-title">제목</button>
      <button class="btn btn-sm btn-outline btn-copy-info">정보</button>
      ${doneButtonHtml}
    </div>
  `;
  
  return card;
}