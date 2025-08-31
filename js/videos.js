// js/videos.js
import { kvGet, kvSet, channelsAll } from './indexedStore.js';
import { ytApi } from './youtube.js';

const CONFIG = {
  perPage: 6,
  minViews: 10000,
  period: '1m', // '1w'|'2w'|'1m'|'all'
  longformSec: 181,
};

const state = {
  mode: 'mutant',      // 'latest' | 'mutant'
  sortBy: 'mutant_desc', // 'views_desc' | 'mutant_desc' | 'publishedAt_desc' | 'subs_desc'
  page: 1,
  filtered: [],
  cached: [],
  doneIds: new Set(),
  _busy: false,
};

function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
const h = (s)=> (s??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const num = (n)=> Number(n||0);

async function runLimited(tasks, limit=5){
  const out = []; let i=0; const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async ()=>{
    while(i < tasks.length){ const my = i++; out[my] = await tasks[my](); }
  });
  await Promise.all(workers);
  return out;
}

function secFromISO(iso){
  if (!iso || typeof iso !== 'string') return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const hours = parseInt(m[1] || 0, 10);
  const minutes = parseInt(m[2] || 0, 10);
  const seconds = parseInt(m[3] || 0, 10);
  return (hours * 3600) + (minutes * 60) + seconds;
}

function withinPeriod(dateStr){
  if (CONFIG.period === 'all') return true;
  const d = new Date(dateStr);
  const now = new Date();
  const days = {'1w':7, '2w':14, '1m':30}[CONFIG.period] || 9999;
  return (now - d) / (1000*60*60*24) <= days;
}

// [수정] 특정 채널의 플레이리스트를 찾지 못해도 전체 프로세스가 중단되지 않도록 예외 처리
async function fetchLatestVideoIds(ch, max=25){
  if (!ch.uploadsPlaylistId) return [];
  try {
    const j = await ytApi('playlistItems', { part:'contentDetails', playlistId:ch.uploadsPlaylistId, maxResults:max });
    return j.items?.map(it=>it.contentDetails.videoId) || [];
  } catch (e) {
    console.warn(`'${ch.title}' 채널(${ch.id})의 영상 목록을 가져오는 데 실패했습니다. 채널이 삭제되었거나 비공개일 수 있습니다.`, e.message);
    return []; // 오류 발생 시 빈 배열을 반환하여 다른 채널 분석을 계속 진행
  }
}

async function fetchVideosDetails(ids){
  const out = [];
  for(let i=0; i < ids.length; i+=50){
    const idChunk = ids.slice(i, i+50);
    const j = await ytApi('videos', { part:'snippet,statistics,contentDetails', id:idChunk.join(',') });
    out.push(...(j.items||[]));
  }
  return out;
}

function filterRankFromRaw(videos){
  const filtered = videos.filter(v=>{
    if (v.secs < CONFIG.longformSec) return false;
    if (v.views < CONFIG.minViews) return false;
    if (!withinPeriod(v.publishedAt)) return false;
    if (state.mode==='mutant' && v.mutant < 2.0) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (a.isDone && !b.isDone) return 1;
    if (!a.isDone && b.isDone) return -1;

    switch (state.sortBy) {
      case 'mutant_desc':
        return b.mutant - a.mutant;
      case 'publishedAt_desc':
        return new Date(b.publishedAt) - new Date(a.publishedAt);
      case 'subs_desc':
        return b.channel.subs - a.channel.subs;
      case 'views_desc':
      default:
        return b.views - a.views;
    }
  });
}

async function loadSnapshot(){ try{return await kvGet('videos:cache');}catch{return null;} }
async function saveSnapshot(items){ await kvSet('videos:cache', items); }
async function loadDoneIds() { const ids = await kvGet('videos:done_ids') || []; state.doneIds = new Set(ids); }
async function saveDoneIds() { await kvSet('videos:done_ids', Array.from(state.doneIds)); }


function renderAndBindToolbar(toolbarContainer, contentContainer) {
  toolbarContainer.innerHTML = '';
  const tb = el(`
    <div class="toolbar">
      <div class="group">
        <span class="chip ${state.mode==='latest'?'active':''}" data-mode="latest">최신영상</span>
        <span class="chip ${state.mode==='mutant'?'active':''}" data-mode="mutant">돌연변이</span>
      </div>
      <div class="group" style="margin-left: 16px;">
        <span class="chip ${CONFIG.minViews===10000?'active':''}" data-views="10000">1만</span>
        <span class="chip ${CONFIG.minViews===30000?'active':''}" data-views="30000">3만</span>
        <span class="chip ${CONFIG.minViews===50000?'active':''}" data-views="50000">5만</span>
      </div>
      <div class="group" style="margin-left: 16px;">
        <span class="chip ${CONFIG.period==='1w'?'active':''}" data-period="1w">1주</span>
        <span class="chip ${CONFIG.period==='2w'?'active':''}" data-period="2w">2주</span>
        <span class="chip ${CONFIG.period==='1m'?'active':''}" data-period="1m">한달</span>
        <span class="chip ${CONFIG.period==='all'?'active':''}" data-period="all">전체</span>
      </div>
      <div class="group" style="margin-left: 16px;">
        <select id="video-sort-select" class="btn btn-outline" style="height:34px; padding-right:32px;">
          <option value="views_desc" ${state.sortBy === 'views_desc' ? 'selected' : ''}>조회수 순</option>
          <option value="mutant_desc" ${state.sortBy === 'mutant_desc' ? 'selected' : ''}>돌연변이 지수 순</option>
          <option value="publishedAt_desc" ${state.sortBy === 'publishedAt_desc' ? 'selected' : ''}>최신 업로드 순</option>
          <option value="subs_desc" ${state.sortBy === 'subs_desc' ? 'selected' : ''}>채널 구독자 순</option>
        </select>
      </div>
      <div class="group" style="margin-left:auto">
        <span id="sync-badge" class="chip" style="pointer-events:none;display:none">업데이트 중…</span>
        <button id="btn-reload" class="btn btn-primary btn-sm">다시불러오기</button>
      </div>
    </div>
  `);
  toolbarContainer.appendChild(tb);

  const sortSelect = tb.querySelector('#video-sort-select');

  tb.querySelectorAll('[data-mode]').forEach(x=> x.onclick = ()=>{ 
    state.mode=x.dataset.mode;
    state.sortBy = state.mode === 'latest' ? 'publishedAt_desc' : 'mutant_desc';
    sortSelect.value = state.sortBy;
    tb.querySelectorAll('[data-mode]').forEach(n=>n.classList.toggle('active',n===x)); 
    state.page=1; 
    applyFiltersAndRender(contentContainer); 
  });
  
  tb.querySelectorAll('[data-views]').forEach(x=> x.onclick = ()=>{ CONFIG.minViews=Number(x.dataset.views); tb.querySelectorAll('[data-views]').forEach(n=>n.classList.toggle('active',n===x)); state.page=1; applyFiltersAndRender(contentContainer); });
  tb.querySelectorAll('[data-period]').forEach(x=> x.onclick = ()=>{ CONFIG.period=x.dataset.period; tb.querySelectorAll('[data-period]').forEach(n=>n.classList.toggle('active',n===x)); state.page=1; applyFiltersAndRender(contentContainer); });
  
  sortSelect.onchange = () => {
    state.sortBy = sortSelect.value;
    state.page = 1;
    applyFiltersAndRender(contentContainer);
  };

  tb.querySelector('#btn-reload').onclick = () => reload(contentContainer, { force:true });
}

function renderLoadingState(container) {
  if (container) container.innerHTML = `<div class="loading-state">영상 데이터를 분석하고 있습니다...</div>`;
}

function renderEmptyState(container) {
  if (container) container.innerHTML = `
    <div class="empty-state">
      분석할 채널이 없습니다.<br>
      먼저 '채널관리' 탭으로 이동하여 분석하고 싶은 채널을 등록해주세요.
    </div>
  `;
}

function applyFiltersAndRender(root){
  if (!root) return;
  state.filtered = filterRankFromRaw(state.cached);
  renderList(root);
}

function copyText(t){ navigator.clipboard.writeText(t).then(()=>window.toast('복사 완료', 'success', 800)).catch(()=>window.toast('복사 실패', 'error')); }
async function copyImageBlob(blob){ try { await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]); window.toast('썸네일 복사 완료','success', 900); } catch(e){ console.error(e); window.toast('썸네일 복사 실패','error'); } }
function convertBlobToPngBlob(blob) { return new Promise((ok,rej)=>{ const i=new Image(); const c=document.createElement('canvas'); const x=c.getContext('2d'); i.onload=()=>{ c.width=i.width; c.height=i.height; x.drawImage(i,0,0); c.toBlob(ok,'image/png'); }; i.onerror=rej; i.src=URL.createObjectURL(blob); }); }
async function copyThumbnailImage(videoId){ const r = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`); const blob = await r.blob(); if (!blob.type.startsWith('image/')) throw new Error('not an image'); const pngBlob = await convertBlobToPngBlob(blob); copyImageBlob(pngBlob); }

function renderList(root){
  root.innerHTML = '';

  if (state.filtered.length === 0) {
    root.innerHTML = `<div class="empty-state">조건에 맞는 영상이 없습니다. 필터 설정을 변경해보세요.</div>`;
    return;
  }
  
  const total = state.filtered.length;
  const pages = Math.ceil(total / CONFIG.perPage);
  const start = (state.page-1) * CONFIG.perPage;
  const items = state.filtered.slice(start, start + CONFIG.perPage);
  
  const grid = el('<div class="video-grid"></div>');
  items.forEach(v=>{
    const doneButtonText = v.isDone ? '완료취소' : '작업완료';
    const doneButtonClass = v.isDone ? 'btn-outline' : 'btn-success';

    const card = el(`
      <div class="video-card">
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
              <span class="muted">${new Date(v.publishedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div class="video-actions">
          <button class="btn btn-sm btn-outline btn-copy-thumb">썸네일</button>
          <button class="btn btn-sm btn-outline btn-copy-info">정보</button>
          <button class="btn btn-sm ${doneButtonClass} btn-toggle-done">${doneButtonText}</button>
        </div>
      </div>
    `);
    
    card.classList.toggle('is-done', v.isDone);
    
    card.querySelector('.btn-copy-info').onclick = () => {
      const infoText = `제목 : ${v.title}\n구독자수 : ${num(v.channel.subs).toLocaleString()}명\n조회수 : ${num(v.views).toLocaleString()}회\n업로드 일: ${new Date(v.publishedAt).toLocaleDateString()}`;
      copyText(infoText);
    };
    
    card.querySelector('.btn-toggle-done').onclick = () => {
      if (state.doneIds.has(v.id)) {
        state.doneIds.delete(v.id);
        v.isDone = false;
      } else {
        state.doneIds.add(v.id);
        v.isDone = true;
      }
      saveDoneIds();
      applyFiltersAndRender(root);
    };

    card.querySelector('.btn-copy-thumb').onclick = ()=>copyThumbnailImage(v.id);
    grid.appendChild(card);
  });
  root.appendChild(grid);

  if (pages > 1) {
    const pg = el('<nav class="pagination"></nav>');
    for (let i=1; i<=pages; i++){
      const btn = el(`<button class="btn ${i===state.page?'active':''}">${i}</button>`);
      btn.onclick = ()=> { state.page=i; renderList(root); };
      pg.appendChild(btn);
    }
    root.appendChild(pg);
  }
}

async function buildRawItems(){
  const channels = await channelsAll();
  const chMap = new Map(channels.map(c=>[c.id, c]));
  
  const idTasks = channels.map(c=> ()=>fetchLatestVideoIds(c));
  const videoIdChunks = await runLimited(idTasks);
  const allVideoIds = [...new Set(videoIdChunks.flat())];
  const allVideos = await fetchVideosDetails(allVideoIds);
  
  return allVideos.map(v=>{
    const ch = chMap.get(v.snippet.channelId);
    if (!ch) return null;
    const views = num(v.statistics.viewCount);
    const subs = num(ch.subscriberCount);
    return {
      id: v.id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      views,
      secs: secFromISO(v.contentDetails?.duration),
      channel: { id:ch.id, name:ch.title, subs, thumb:ch.thumbnail },
      mutant: subs > 1000 ? views/subs : 0,
      isDone: state.doneIds.has(v.id),
    };
  }).filter(Boolean);
}

async function reload(container, { force=false } = {}){
  if (!container) {
    console.error("Reload target container is not found.");
    return;
  }
  if (state._busy) {
    window.toast('이미 데이터를 불러오고 있습니다.');
    return;
  }

  state._busy = true;
  const syncBadge = document.getElementById('sync-badge');
  if (syncBadge) syncBadge.style.display = 'inline-flex';
  renderLoadingState(container);

  try {
    await loadDoneIds();
    const fromCache = await loadSnapshot();
    if (fromCache && !force) {
      state.cached = fromCache.map(v => ({...v, isDone: state.doneIds.has(v.id)}));
    } else {
      const items = await buildRawItems();
      await saveSnapshot(items);
      state.cached = items;
      window.toast('최신 영상 정보를 업데이트 했습니다.', 'success');
    }
    applyFiltersAndRender(container);
  } catch (e) {
    console.error('reload failed', e);
    window.toast(`데이터 로딩 실패: ${e.message}`, 'error');
    if (container) container.innerHTML = `<div class="empty-state error">데이터를 불러오는 데 실패했습니다.<br>${h(e.message)}</div>`;
  } finally {
    if (syncBadge) syncBadge.style.display = 'none';
    state._busy = false;
  }
}

export async function initVideos({ mount }){
  const root = document.querySelector(mount);
  root.innerHTML = `
    <div id="videos-toolbar-container"></div>
    <div id="videos-content-container"></div>
  `;
  
  const toolbarContainer = root.querySelector('#videos-toolbar-container');
  const contentContainer = root.querySelector('#videos-content-container');

  renderAndBindToolbar(toolbarContainer, contentContainer);

  const channels = await channelsAll();
  if (channels.length === 0) {
    renderEmptyState(contentContainer);
    return;
  }
  
  reload(contentContainer, { force: false });
}

export async function warmUpVideosCache(){
  const channels = await channelsAll();
  if (!channels || channels.length === 0) return;
  await loadDoneIds();
  const items = await buildRawItems();
  await saveSnapshot(items);
}