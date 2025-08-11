// 통합된 비디오 렌더링 함수
function renderVideoList(videos, listId, keywordsId, paginationId, currentPage = 1) {
  const itemsPerPage = CONFIG.PAGINATION.VIDEOS;
  const totalItems = videos.length;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedVideos = videos.slice(startIndex, endIndex);
  
  const wrap = qs(listId);
  if (!wrap) return;
  
  if (!videos.length) { 
    wrap.innerHTML = '<p class="muted">표시할 영상이 없습니다.</p>'; 
    if (keywordsId) qs(keywordsId).innerHTML = '';
    if (paginationId) qs(paginationId).innerHTML = '';
    return; 
  }
  
  wrap.innerHTML = '';
  
  paginatedVideos.forEach(v => {
    const card = document.createElement('div'); 
    card.className = 'video-card';
    
    const channelName = v.__ch?.title || v.snippet?.channelTitle || '알 수 없음';
    const uploadDate = moment(v.publishedAt).format('MM-DD');
    const subscriberCount = fmt(v.__ch?.subscriberCount || 0);
    const mutantIndex = v.mutantIndex || '0.00';
    
    card.innerHTML = `
      <a class="video-link" target="_blank" href="https://www.youtube.com/watch?v=${v.id}">
        <div class="thumb-wrap">
          <img class="thumb" src="${v.thumbnail}" alt="">
        </div>
        <div class="v-title">${v.title}</div>
        <div class="v-meta">
          <div class="v-meta-top">
            <span title="${channelName}">${truncateText(channelName, 12)}</span>
            <span>${uploadDate}</span>
            <span>${subscriberCount}</span>
          </div>
          <div class="v-meta-bottom">
            ${parseFloat(mutantIndex) >= CONFIG.MUTANT_THRESHOLD ? 
              `<div class="mutant-badge">${mutantIndex}</div>` : 
              `<div></div>`
            }
            <label class="video-done-checkbox">
              <input type="checkbox" data-done="${v.id}"/> 완료
            </label>
          </div>
        </div>
      </a>`;
    
    // 완료 상태 복원
    idbGet('doneVideos', [v.__ch?.channelId || v.snippet?.channelId || '', v.id])
      .then(rec => {
        if (rec) {
          const cb = card.querySelector(`[data-done='${v.id}']`);
          if (cb) cb.checked = true;
        }
      });
    
    // 완료 상태 변경 이벤트
    card.addEventListener('change', async (e) => {
      if (e.target && e.target.matches(`[data-done='${v.id}']`)) {
        const channelId = v.__ch?.channelId || v.snippet?.channelId || '';
        if (e.target.checked) {
          await idbPut('doneVideos', {
            channelId: channelId,
            videoId: v.id,
            done: true,
            ts: Date.now()
          });
        } else {
          await idbDel('doneVideos', [channelId, v.id]);
        }
      }
    });
    
    wrap.appendChild(card);
  });
  
  // 키워드 렌더링
  if (keywordsId) {
    const keywords = extractKeywords(videos.map(v => v.title || '').join(' '));
    const top = keywords.slice(0, 12);
    qs(keywordsId).innerHTML = top.map(([w, c]) => `<span class="kw">${w} ${c}회</span>`).join('');
  }
  
  // 페이지네이션 렌더링
  if (paginationId) {
    renderPagination(paginationId, currentPage, totalItems, itemsPerPage, (page) => {
      renderVideoList(videos, listId, keywordsId, paginationId, page);
    });
  }
}

function sortVideoCards(list, mode) {
  if (mode === 'views') list.sort((a, b) => b.viewCount - a.viewCount);
  else if (mode === 'subscribers') list.sort((a, b) => b.__ch.subscriberCount - a.__ch.subscriberCount);
  else if (mode === 'latest') list.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  else list.sort((a, b) => parseFloat(b.mutantIndex || 0) - parseFloat(a.mutantIndex || 0));
}
