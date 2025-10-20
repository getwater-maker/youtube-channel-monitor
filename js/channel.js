// js/channel.js
import { channelsAll, channelsPut, channelsRemove } from './indexedStore.js';
import { ytApi } from './youtube.js';

const state = {
  page: 1,
  perPage: 8,
  sortBy: 'mutant', // 'mutant', 'subscribers', 'views', 'videos'
};

function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function h(str){ return (str??'').replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s])); }

function formatNum(n) {
  const num = Number(n||0);
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}억`;
  if (num >= 10000) return `${(num / 10000).toFixed(0)}만`;
  return num.toLocaleString('ko-KR');
}

async function fetchChannelExtra(id){
  const j = await ytApi('channels', { part:'snippet,contentDetails,statistics,brandingSettings', id });
  const c = j.items?.[0]; if (!c) throw new Error(`채널 ID(${id}) 정보를 찾을 수 없습니다.`);
  return {
    id,
    title: c.snippet?.title || '',
    description: c.snippet?.description || '',
    publishedAt: c.snippet?.publishedAt || null, // 채널 개설일 추가
    thumbnail: c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url || '',
    uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads || null,
    subscriberCount: Number(c.statistics?.subscriberCount||0),
    videoCount: Number(c.statistics?.videoCount||0),
    viewCount: Number(c.statistics?.viewCount||0),
    bannerUrl: c.brandingSettings?.image?.bannerExternalUrl || null
  };
}

/** 카드: 등록된 채널에는 왼쪽 ‘분석’, 오른쪽 ‘삭제’ 버튼을 배치 */
function createChannelCard(ch, isRegistered = false) {
  const actionsHtml = isRegistered
    ? `<div class="card-actions" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
         <button class="btn btn-md btn-analyze btn-analyze--accent" title="이 채널만 분석">📊 분석</button>
         <button class="btn btn-sm btn-danger btn-remove">삭제</button>
       </div>`
    : `<div class="card-actions">
         <button class="btn btn-sm btn-primary btn-register">등록</button>
       </div>`;

  // 개설일 표시를 위한 HTML 추가
  const publishedAtHtml = ch.publishedAt 
    ? `<div class="stat-item"><strong>${ch.publishedAt.slice(0, 10)}</strong><span>개설일</span></div>`
    : '';

  return el(`
    <div class="channel-card" data-id="${h(ch.id)}">
      <div class="card-banner" style="${ch.bannerUrl ? `background-image:url(${ch.bannerUrl})` : ''}">
        <img class="card-avatar" src="${h(ch.thumbnail)}" alt="${h(ch.title)} 프로필">
      </div>
      <div class="card-body">
        <a href="https://www.youtube.com/channel/${h(ch.id)}" target="_blank" rel="noopener" class="card-title-link">
          <div class="card-title">${h(ch.title)}</div>
        </a>
        <div class="card-stats" style="flex-wrap: wrap; justify-content: space-between;">
          <div class="stat-item"><strong>${formatNum(ch.subscriberCount)}</strong><span>구독자</span></div>
          <div class="stat-item"><strong>${formatNum(ch.videoCount)}</strong><span>동영상</span></div>
          <div class="stat-item"><strong>${formatNum(ch.viewCount)}</strong><span>총 조회수</span></div>
          ${publishedAtHtml}
        </div>
        <p class="card-description">${h(ch.description)}</p>
        ${actionsHtml}
      </div>
    </div>
  `);
}

/** 검색 모달 */
async function showSearchModal() {
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

/** 페이지네이션 */
function renderPagination(root, totalItems) {
  const totalPages = Math.ceil(totalItems / state.perPage);
  const existingPagination = root.querySelector('.pagination');
  if (existingPagination) existingPagination.remove();
  if (totalPages <= 1) return;

  const makeBtn = (label, page, disabled = false, active = false) => {
    const b = el(`<button class="btn ${active ? 'active' : ''}">${label}</button>`);
    if (disabled) b.disabled = true;
    b.onclick = async () => {
      state.page = page;
      await renderRegistered();
    };
    return b;
  };

  const nav = el('<nav class="pagination"></nav>');

  // 이전
  nav.appendChild(makeBtn('이전', Math.max(1, state.page - 1), state.page === 1));

  // 가운데 숫자 5개 윈도우
  const windowSize = 5;
  let start = Math.max(1, state.page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);

  for (let i = start; i <= end; i++) {
    nav.appendChild(makeBtn(String(i), i, false, i === state.page));
  }

  // 이후
  nav.appendChild(makeBtn('이후', Math.min(totalPages, state.page + 1), state.page === totalPages));

  root.appendChild(nav);
}


/** 등록된 채널 렌더 + 정렬 기준 */
let sectionEl;
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

  // 돌연변이 지수 계산 (정렬에 필요)
  list.forEach(c => c._mutant = (Number(c.viewCount||0) && Number(c.subscriberCount||0)) ? Number(c.viewCount)/Number(c.subscriberCount) : 0);
  
  // 상태에 따른 정렬
  list.sort((a, b) => {
    switch (state.sortBy) {
        case 'subscribers':
            return (Number(b.subscriberCount) || 0) - (Number(a.subscriberCount) || 0);
        case 'views':
            return (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0);
        case 'videos':
            return (Number(b.videoCount) || 0) - (Number(a.videoCount) || 0);
        case 'mutant':
        default:
            return (b._mutant || 0) - (a._mutant || 0);
    }
  });


  const start = (state.page - 1) * state.perPage;
  const end = start + state.perPage;
  const paginatedItems = list.slice(start, end);

  paginatedItems.forEach(c => {
    const card = createChannelCard(c, true);

    // [분석] → 같은 탭 내 하단 섹션에 채널분석 렌더
    const analyzeBtn = card.querySelector('.btn-analyze');
    if (analyzeBtn) {
      analyzeBtn.onclick = async () => {
        try {
          const mod = await import('./channelAnalysis.js');
          await mod.renderChannelAnalysis({ mount: '#channel-analysis-root', channel: c });
          document.querySelector('#channel-analysis-root')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
          console.error(e);
          window.toast?.('채널 분석을 시작할 수 없습니다.', 'error');
        }
      };
    }

    // 삭제
    card.querySelector('.btn-remove').onclick = async () => {
      if (confirm(`'${c.title}' 채널을 정말 삭제하시겠습니까?`)) {
        await channelsRemove(c.id);
        const totalItems = (await channelsAll()).length;
        const totalPages = Math.ceil(totalItems / state.perPage);
        if (state.page > totalPages && totalPages > 0) state.page = totalPages;
        await renderRegistered();
      }
    };
    wrap.appendChild(card);
  });

  renderPagination(sectionEl, list.length);

  // 분석 섹션 앵커가 없다면 추가
  if (!document.querySelector('#channel-analysis-root')) {
    const analysisSection = el(`
      <div id="channel-analysis-root" class="section" style="margin-top: 20px;">
        <div class="empty-state">채널 카드의 <strong>분석</strong> 버튼을 눌러 채널별 분석을 시작하세요.</div>
      </div>
    `);
    sectionEl.parentElement.appendChild(analysisSection);
  }
}

export async function initChannel({ mount }){
  const root = document.querySelector(mount);
  root.innerHTML = `
    <div class="section">
      <div class="section-header">
        <div class="section-title">등록된 채널</div>
        <div id="channel-sort-controls" class="section-actions" style="margin-left: 16px;">
            <span class="chip active" data-sort="mutant">돌연변이 지수</span>
            <span class="chip" data-sort="subscribers">구독자</span>
            <span class="chip" data-sort="views">총 조회수</span>
            <span class="chip" data-sort="videos">영상 수</span>
        </div>
        <div class="section-actions" style="margin-left: auto;">
          <button id="btn-import" class="btn btn-outline btn-sm">가져오기</button>
          <button id="btn-export" class="btn btn-outline btn-sm">내보내기</button>
          <button id="btn-show-search-modal" class="btn btn-primary">채널 추가</button>
        </div>
      </div>
      <div id="registered" class="channel-grid"></div>
    </div>
  `;

  sectionEl = root.querySelector('.section');

  // 정렬 버튼 이벤트 리스너
  const sortControls = root.querySelector('#channel-sort-controls');
  sortControls.addEventListener('click', (e) => {
      if (e.target.matches('.chip[data-sort]')) {
          const sortBy = e.target.dataset.sort;
          if (state.sortBy === sortBy) return;

          state.sortBy = sortBy;
          state.page = 1;

          sortControls.querySelectorAll('.chip').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.sort === sortBy);
          });

          renderRegistered();
      }
  });


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
        let ok = 0; const failed = [];

        await Promise.all(arr.map(async (c) => {
          if (!c?.id) return;
          try {
            const fresh = await fetchChannelExtra(c.id);
            await channelsPut(fresh);
            ok++;
          } catch (e) {
            failed.push({ id:c.id, title:c.title||'N/A', error:e.message });
            console.error('Import failed:', c.id, e);
          }
        }));

        window.toast?.(`완료: ${ok}개 성공${failed.length?`, ${failed.length}개 실패(콘솔 확인)`:''}`, failed.length? 'warning':'success');
        renderRegistered();
      } catch(e) {
        console.error(e);
        window.toast?.('JSON 파일을 처리하는 데 실패했습니다.', 'error');
      }
    };
    inp.click();
  };

  renderRegistered();
}
