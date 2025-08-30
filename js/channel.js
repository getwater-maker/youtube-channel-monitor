// js/channel.js
import { kvGet, kvSet, channelsAll, channelsPut, channelsRemove } from './indexedStore.js';
import { ytApi } from './youtube.js';

// [추가] 채널 탭 상태 관리
const state = {
  page: 1,
  perPage: 8,
};

function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function h(str){ return (str??'').replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s])); }

function formatNum(n) {
  const num = Number(n);
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}억`;
  if (num >= 10000) return `${(num / 10000).toFixed(0)}만`;
  return num.toLocaleString('ko-KR');
}

async function fetchChannelExtra(id){
  const j = await ytApi('channels', { part:'snippet,contentDetails,statistics,brandingSettings', id });
  const c = j.items?.[0]; if (!c) throw new Error(`채널 ID(${id}) 정보를 찾을 수 없습니다.`);
  return { id, title: c.snippet?.title || '', description: c.snippet?.description || '', thumbnail: c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url || '', uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads || null, subscriberCount: Number(c.statistics?.subscriberCount||0), videoCount: Number(c.statistics?.videoCount||0), viewCount: Number(c.statistics?.viewCount||0), bannerUrl: c.brandingSettings?.image?.bannerExternalUrl || null };
}

function createChannelCard(ch, isRegistered = false) {
  const actionBtn = isRegistered
    ? `<button class="btn btn-sm btn-danger btn-remove">삭제</button>`
    : `<button class="btn btn-sm btn-primary btn-register">등록</button>`;
  return el(`<div class="channel-card" data-id="${h(ch.id)}"><div class="card-banner" style="${ch.bannerUrl ? `background-image:url(${ch.bannerUrl})` : ''}"><img class="card-avatar" src="${h(ch.thumbnail)}" alt="${h(ch.title)} 프로필"></div><div class="card-body"><a href="https://www.youtube.com/channel/${h(ch.id)}" target="_blank" rel="noopener" class="card-title-link"><div class="card-title">${h(ch.title)}</div></a><div class="card-stats"><div class="stat-item"><strong>${formatNum(ch.subscriberCount)}</strong><span>구독자</span></div><div class="stat-item"><strong>${formatNum(ch.videoCount)}</strong><span>동영상</span></div><div class="stat-item"><strong>${formatNum(ch.viewCount)}</strong><span>총 조회수</span></div></div><p class="card-description">${h(ch.description)}</p><div class="card-actions">${actionBtn}</div></div></div>`);
}

async function showSearchModal(renderRegisteredCallback) {
  document.getElementById('channel-search-modal')?.remove();

  const overlay = el(`
    <div class="sp-modal-overlay" id="channel-search-modal">
      <div class="sp-modal" style="max-width: 1100px;">
        <div class="sp-modal-head">
          <div class="sp-modal-title">채널 검색 및 추가</div>
          <button class="sp-modal-close">&times;</button>
        </div>
        <div class="sp-modal-body">
          <div class="toolbar">
            <input id="modal-q" type="search" placeholder="채널명으로 검색..." style="flex-grow:1; max-width:none;" />
            <button id="modal-btn-search" class="btn btn-primary">검색</button>
          </div>
          <div id="modal-search-results" class="channel-grid" style="min-height: 400px;">
             <div class="empty-state">검색어를 입력하고 '검색' 버튼을 누르세요.</div>
          </div>
        </div>
        <div class="sp-modal-footer">
            <button id="modal-btn-prev" class="btn btn-outline" disabled>‹ 이전</button>
            <button id="modal-btn-next" class="btn btn-outline" disabled>다음 ›</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);

  const closeModal = () => overlay.remove();
  overlay.querySelector('.sp-modal-close').onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  let nextToken = '', prevToken = '';

  const searchInModal = async (token = '') => {
    const q = overlay.querySelector('#modal-q').value.trim();
    if (!q) return;
    const resultsWrap = overlay.querySelector('#modal-search-results');
    try {
      resultsWrap.innerHTML = '<div class="loading-state">검색 중...</div>';
      const params = { part: 'snippet', type: 'channel', q, maxResults: 6 };
      if (token) params.pageToken = token;
      
      const j = await ytApi('search', params);
      nextToken = j.nextPageToken || '';
      prevToken = j.prevPageToken || '';
      overlay.querySelector('#modal-btn-next').disabled = !nextToken;
      overlay.querySelector('#modal-btn-prev').disabled = !prevToken;

      const channelIds = (j.items || []).map(it => it.id?.channelId).filter(Boolean);
      if (!channelIds.length) {
        resultsWrap.innerHTML = '<div class="empty-state">검색 결과가 없습니다.</div>';
        return;
      }

      resultsWrap.innerHTML = '<div class="loading-state">채널 상세 정보 불러오는 중...</div>';
      const detailedChannels = await Promise.all(channelIds.map(id => fetchChannelExtra(id).catch(e => { console.error(e); return null; })));

      resultsWrap.innerHTML = '';
      for (const ch of detailedChannels) {
        if (!ch) continue;
        const card = createChannelCard(ch, false);
        card.querySelector('.btn-register').onclick = async () => {
          try {
            card.querySelector('.btn-register').textContent = '등록 중...';
            card.querySelector('.btn-register').disabled = true;
            const latestChInfo = await fetchChannelExtra(ch.id);
            await channelsPut(latestChInfo);
            window.toast?.(`'${latestChInfo.title}' 채널을 등록했습니다.`, 'success');
            document.dispatchEvent(new CustomEvent('channelsUpdated'));
            closeModal();
          } catch(e) {
            console.error(e); window.toast?.('등록 실패: ' + e.message, 'error');
            card.querySelector('.btn-register').textContent = '등록';
            card.querySelector('.btn-register').disabled = false;
          }
        };
        resultsWrap.appendChild(card);
      }
    } catch(e) {
      console.error(e); window.toast?.(e.message, 'error', 2600);
      resultsWrap.innerHTML = `<div class="empty-state error">${e.message}</div>`;
    }
  };

  overlay.querySelector('#modal-btn-search').onclick = () => searchInModal('');
  overlay.querySelector('#modal-q').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); searchInModal(''); } };
  overlay.querySelector('#modal-btn-next').onclick = () => nextToken && searchInModal(nextToken);
  overlay.querySelector('#modal-btn-prev').onclick = () => prevToken && searchInModal(prevToken);
}

// [추가] 페이지네이션 렌더링 함수
function renderPagination(root, totalItems) {
  const totalPages = Math.ceil(totalItems / state.perPage);
  const existingPagination = root.querySelector('.pagination');
  if (existingPagination) existingPagination.remove();

  if (totalPages <= 1) return;

  let paginationHtml = `<nav class="pagination">`;
  for (let i = 1; i <= totalPages; i++) {
    paginationHtml += `<button class="btn ${i === state.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  paginationHtml += `</nav>`;
  
  const paginationEl = el(paginationHtml);

  paginationEl.querySelectorAll('.btn[data-page]').forEach(btn => {
    btn.onclick = async () => {
      state.page = Number(btn.dataset.page);
      await renderRegistered();
    };
  });

  root.appendChild(paginationEl);
}

let sectionEl; // 섹션 엘리먼트를 저장할 변수

async function renderRegistered(){
  if (!sectionEl) return;
  const list = await channelsAll();
  const wrap = document.getElementById('registered');
  wrap.innerHTML = '';
  
  if (!list.length) {
    wrap.innerHTML = '<div class="empty-state">등록된 채널이 없습니다. \'채널 추가\' 버튼을 눌러 채널을 추가하세요.</div>';
    renderPagination(sectionEl, 0);
    return;
  }

  list.sort((a,b) => b.subscriberCount - a.subscriberCount);
  
  const start = (state.page - 1) * state.perPage;
  const end = start + state.perPage;
  const paginatedItems = list.slice(start, end);

  paginatedItems.forEach(c => {
    const card = createChannelCard(c, true);
    card.querySelector('.btn-remove').onclick = async () => {
      if (confirm(`'${c.title}' 채널을 정말 삭제하시겠습니까?`)) { 
        await channelsRemove(c.id);
        const totalItems = (await channelsAll()).length;
        const totalPages = Math.ceil(totalItems / state.perPage);
        if (state.page > totalPages && totalPages > 0) {
            state.page = totalPages;
        }
        await renderRegistered(); 
      }
    };
    wrap.appendChild(card);
  });
  
  renderPagination(sectionEl, list.length);
}

export async function initChannel({ mount }){
  const root = document.querySelector(mount);
  root.innerHTML = `
    <div class="section">
      <div class="section-header">
        <div class="section-title">등록된 채널</div>
        <div class="section-actions">
          <button id="btn-import" class="btn btn-outline btn-sm">가져오기</button>
          <button id="btn-export" class="btn btn-outline btn-sm">내보내기</button>
          <button id="btn-show-search-modal" class="btn btn-primary">채널 추가</button>
        </div>
      </div>
      <div id="registered" class="channel-grid"></div>
    </div>
  `;

  sectionEl = root.querySelector('.section');

  document.getElementById('btn-show-search-modal').onclick = () => showSearchModal();
  
  document.addEventListener('channelsUpdated', () => {
    state.page = 1;
    renderRegistered();
  });
  
  document.getElementById('btn-export').onclick = async ()=>{
    const list = await channelsAll();
    const blob = new Blob([JSON.stringify(list, null, 2)], {type:'application/json;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `channels_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };
  
  document.getElementById('btn-import').onclick = ()=>{
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = async ()=>{
      const f = inp.files?.[0]; if (!f) return;
      try{
        const text = await f.text();
        const arr = JSON.parse(text);
        let ok = 0, failed = 0;
        await Promise.all(arr.map(async (c) => {
          if (!c?.id) return;
          try {
            const freshData = await fetchChannelExtra(c.id);
            await channelsPut(freshData);
            ok++;
          } catch (e) {
            console.error(`Import failed for channel ID ${c.id}:`, e);
            failed++;
          }
        }));
        window.toast?.(`${ok}개 채널 가져오기 완료 (실패: ${failed}개)`, 'success');
        renderRegistered();
      }catch(e){ console.error(e); window.toast?.('JSON 파일을 처리하는 데 실패했습니다.', 'error'); }
    };
    inp.click();
  };
  
  renderRegistered();
}