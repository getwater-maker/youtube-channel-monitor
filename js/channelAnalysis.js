// js/channelAnalysis.js
// 채널 전용 분석 섹션
// - 최신영상: 최근 1개월 이내, 업로드 최신순(내림차순)
// - 돌연변이: 롱폼(>=181초)만, 돌연변이 지수 내림차순
// - 채널전체: 모든 영상, 조회수 내림차순, 50개 단위 로드(더 불러오기)
// - 영상카드: 썸네일 복사, 정보 복사, 작업완료 토글
// - ✅ 페이지네이션(등록 채널과 동일 UX)
// - ✅ 키워드 → 검색창(한 줄, 카드 1장 폭) → 영상카드 순서 고정
// - ✅ channel.js 호환을 위한 renderChannelAnalysis export + window 바인딩 제공

import { channelsAll, kvGet, kvSet } from './indexedStore.js';
import { ytApi } from './youtube.js';

const LONGFORM_SEC = 181;

const state = {
  channel: null,
  mode: 'mutant',         // 'latest' | 'mutant' | 'all'
  sortBy: 'mutant_desc',  // latest: publishedAt_desc, mutant: mutant_desc, all: views_desc

  items: [],              // 현재 화면에 표시 가능한 모든 비디오(필터링 이전)
  pageToken: '',          // '채널전체'에서 playlistItems pageToken
  loading: false,

  // UI
  page: 1,
  perPage: 8,
  searchQuery: '',

  // 작업완료
  doneIds: new Set(),

  // 내부 캐시
  _lastItemsForRender: [],
  _lastShowLoadMore: false,
};

// ───────────────────────── 유틸 ─────────────────────────
const el = (h)=>{ const t=document.createElement('template'); t.innerHTML=h.trim(); return t.content.firstElementChild; };
const h = (s)=> (s??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const num = (n)=> Number(n||0);
const fmt = (n)=> Number(n||0).toLocaleString('ko-KR');

function secFromISO(iso){
  if (!iso || typeof iso !== 'string') return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const hh = parseInt(m[1] || 0, 10);
  const mm = parseInt(m[2] || 0, 10);
  const ss = parseInt(m[3] || 0, 10);
  return (hh*3600)+(mm*60)+ss;
}
function within1Month(dateStr){
  const d = new Date(dateStr), now = new Date();
  return (now - d) / (1000*60*60*24) <= 31;
}

// 클립보드/썸네일 도구
async function copyImageBlob(blob){
  try { await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]); window.toast?.('썸네일 복사 완료','success', 900); }
  catch(e){ console.error(e); window.toast?.('썸네일 복사 실패','error'); }
}
function convertBlobToPngBlob(blob) {
  return new Promise((ok,rej)=>{
    const i=new Image(); const c=document.createElement('canvas'); const x=c.getContext('2d');
    i.onload=()=>{ c.width=i.width; c.height=i.height; x.drawImage(i,0,0); c.toBlob(ok,'image/png'); };
    i.onerror=rej; i.src=URL.createObjectURL(blob);
  });
}
async function copyThumbnailImage(videoId){
  const r = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
  const blob = await r.blob();
  if (!blob.type.startsWith('image/')) throw new Error('not an image');
  const pngBlob = await convertBlobToPngBlob(blob);
  copyImageBlob(pngBlob);
}
function copyText(t){
  navigator.clipboard.writeText(t)
  .then(()=>window.toast?.('복사 완료', 'success', 800))
  .catch(()=>window.toast?.('복사 실패', 'error'));
}

// 작업완료 저장/불러오기
async function loadDoneIds() { const ids = await kvGet('videos:done_ids') || []; state.doneIds = new Set(ids); }
async function saveDoneIds() { await kvSet('videos:done_ids', Array.from(state.doneIds)); }

// ───────────────────────── API 헬퍼 ─────────────────────────
async function fetchLatestVideoIdsFromUploads(uploadsPlaylistId, max=50, pageToken=''){
  const j = await ytApi('playlistItems', { part:'contentDetails', playlistId:uploadsPlaylistId, maxResults:max, ...(pageToken?{pageToken}:{}) });
  const ids = j.items?.map(it=>it.contentDetails.videoId) || [];
  return { ids, nextPageToken: j.nextPageToken || '' };
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

// ───────────────────────── 렌더 ─────────────────────────
function renderHeader(root, ch, latestLongformDate){
  const header = el(`
    <div class="section" style="padding:0; overflow:hidden; position:relative; margin-bottom:16px;">
      <div style="width:100%; aspect-ratio: 6/1; ${ch.bannerUrl?`background-image:url(${ch.bannerUrl}); background-size:cover; background-position:center;`:'background:var(--card);'}"></div>
      <div style="position:absolute; left:16px; bottom:12px; display:flex; align-items:center; gap:10px;">
        <img src="${h(ch.thumbnail)}" alt="${h(ch.title)}" style="width:56px; height:56px; border-radius:50%; border:3px solid rgba(0,0,0,.25); box-shadow:0 4px 10px rgba(0,0,0,.3);" />
        <div style="font-weight:900; font-size:18px; text-shadow:0 2px 6px rgba(0,0,0,.6)">${h(ch.title)}</div>
      </div>
      <div style="position:absolute; right:16px; bottom:12px; display:flex; gap:12px; flex-wrap:wrap;">
        <div class="chip" style="backdrop-filter: blur(4px);">${fmt(ch.subscriberCount)} 구독자</div>
        <div class="chip" style="backdrop-filter: blur(4px);">${fmt(ch.videoCount)} 동영상</div>
        <div class="chip" style="backdrop-filter: blur(4px);">${fmt(ch.viewCount)} 총조회수</div>
        <div class="chip" style="backdrop-filter: blur(4px);">${latestLongformDate ? `최근 롱폼: ${latestLongformDate}` : '롱폼 없음'}</div>
      </div>
    </div>
  `);
  root.appendChild(header);
}

// --- [수정된 부분 시작] ---
function videoCard(v){
  const done = state.doneIds.has(v.id);
  const doneButtonText = done ? '완료취소' : '작업완료';
  const doneButtonClass = done ? 'btn-outline' : 'btn-success';

  const card = el(`
    <div class="video-card ${done ? 'is-done' : ''}">
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
          <span class="muted" style="margin-left:auto;">${fmt(v.channel.subs)}명</span>
        </div>
        <div class="v-meta">
          <div class="v-meta-top">
            <span class="mutant-indicator">지수: ${v.mutant.toFixed(1)}</span>
            <span>조회수 ${fmt(v.views)}회</span>
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

  card.querySelector('.btn-copy-thumb').onclick = ()=> copyThumbnailImage(v.id);
  card.querySelector('.btn-copy-info').onclick = ()=>{
    const info = `제목 : ${v.title}\n구독자수 : ${fmt(v.channel.subs)}명\n조회수 : ${fmt(v.views)}회\n업로드 일: ${new Date(v.publishedAt).toLocaleDateString('ko-KR')}`;
    copyText(info);
  };
  
  card.querySelector('.btn-toggle-done').onclick = async () => {
    const isDone = state.doneIds.has(v.id);
    if (isDone) {
      state.doneIds.delete(v.id);
    } else {
      state.doneIds.add(v.id);
    }
    await saveDoneIds();

    const itemInState = state.items.find(item => item.id === v.id);
    if (itemInState) {
      itemInState.isDone = !isDone;
    }
    
    // 렌더링을 다시 하되, 방금 클릭한 비디오가 있는 페이지로 점프하도록 ID를 전달
    applySearchAndRender({ videoIdToFind: v.id });
  };

  return card;
}
// --- [수정된 부분 끝] ---

function renderToolbar(root){
  const tb = el(`
    <div id="ca-toolbar" class="toolbar">
      <div class="group">
        <button id="btn-latest" class="chip">최신영상</button>
        <button id="btn-mutant" class="chip active">돌연변이</button>
        <button id="btn-all"    class="chip">채널전체</button>
      </div>
      <div class="group" style="margin-left:auto">
        <span id="sync-badge" class="chip" style="display:none; pointer-events:none;">업데이트 중…</span>
      </div>
    </div>
  `);
  root.appendChild(tb);
  tb.querySelector('#btn-latest').onclick = ()=> switchMode('latest');
  tb.querySelector('#btn-mutant').onclick = ()=> switchMode('mutant');
  tb.querySelector('#btn-all').onclick    = ()=> switchMode('all');
  return tb;
}

function markActiveButton(tb){
  tb.querySelectorAll('.chip').forEach(b=>b.classList.remove('active'));
  if (state.mode==='latest') tb.querySelector('#btn-latest')?.classList.add('active');
  else if (state.mode==='mutant') tb.querySelector('#btn-mutant')?.classList.add('active');
  else tb.querySelector('#btn-all')?.classList.add('active');
}

function renderPaginationForVideos(root, totalItems){
  const totalPages = Math.ceil(totalItems / state.perPage);
  const existing = root.querySelector('.pagination');
  if (existing) existing.remove();
  if (totalPages <= 1) return;

  const makeBtn = (label, page, disabled=false, active=false)=>{
    const b = el(`<button class="btn ${active ? 'active' : ''}">${label}</button>`);
    if (disabled) b.disabled = true;
    b.onclick = async ()=>{
      state.page = page;
      // 페이지 버튼 클릭 시에는 페이지 점프가 아닌, 현재 페이지를 유지하며 렌더링
      applySearchAndRender({ preservePage: true });
      root.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    };
    return b;
  };
  const nav = el('<nav class="pagination"></nav>');
  nav.appendChild(makeBtn('이전', Math.max(1, state.page - 1), state.page === 1));
  const windowSize = 5;
  let start = Math.max(1, state.page - Math.floor(windowSize/2));
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
  for (let i=start; i<=end; i++){
    nav.appendChild(makeBtn(String(i), i, false, i===state.page));
  }
  nav.appendChild(makeBtn('이후', Math.min(totalPages, state.page + 1), state.page === totalPages));
  root.appendChild(nav);
}

function renderSearchBox(){
  const mount = document.getElementById('ca-search-wrap');
  if (!mount) return;
  let box = document.getElementById('ca-search');
  if (!box){
    box = el(`
      <div id="ca-search" style="margin:10px 0;">
        <div class="search-row" style="display:flex; gap:8px; width:min(100%, 360px);">
          <input id="ca-search-input" type="search" placeholder="제목으로 검색..."
                 style="flex:1; height:36px; padding:0 12px; border:1px solid var(--border); border-radius:8px; background:var(--card); color:var(--text);" />
          <button id="ca-search-clear" class="btn btn-outline btn-sm" style="height:36px;">지우기</button>
        </div>
      </div>
    `);
    mount.replaceChildren(box);
    box.querySelector('#ca-search-input').addEventListener('input', (e)=>{
      state.searchQuery = (e.target.value||'').trim().toLowerCase();
      applySearchAndRender();
    });
    box.querySelector('#ca-search-clear').onclick = ()=>{
      state.searchQuery = '';
      box.querySelector('#ca-search-input').value = '';
      applySearchAndRender();
    };
  }
}

function renderList(root, items, showLoadMore=false){
  root.innerHTML = '';
  if (!items || items.length===0){
    root.innerHTML = `<div class="empty-state">표시할 영상이 없습니다.</div>`;
    return;
  }
  state._lastItemsForRender = items;
  state._lastShowLoadMore = showLoadMore;
  const total = items.length;
  const start = (state.page - 1) * state.perPage;
  const slice = items.slice(start, start + state.perPage);
  const grid = el('<div class="video-grid"></div>');
  slice.forEach(v => grid.appendChild(videoCard(v)));
  root.appendChild(grid);
  renderPaginationForVideos(root, total);
  if (showLoadMore){
    const more = el(`<div style="display:flex; justify-content:center; margin-top:16px;"><button id="btn-load-more" class="btn btn-primary">더 불러오기</button></div>`);
    more.querySelector('#btn-load-more').onclick = ()=> loadMoreAll(root);
    root.appendChild(more);
  }
}

function renderKeywordsContainer(items){
  const wrap = document.getElementById('ca-keywords');
  if (!wrap) return null;
  wrap.innerHTML = '';
  const wordCounts = new Map();
  const stop = new Set(['shorts', '그리고', '있는', '것은', '이유', '방법', '영상', '공개', '구독', '좋아요']);
  items.forEach(v=>{
    const words = (v.title||'').replace(/[\[\]\(\)\{\}\.,!?#&`'"]/g, ' ').toLowerCase().split(/\s+/).filter(w => w.length > 1 && !stop.has(w) && !/^\d+$/.test(w));
    words.forEach(w => wordCounts.set(w, (wordCounts.get(w) || 0) + 1));
  });
  const sorted = [...wordCounts.entries()].sort((a,b)=> b[1]-a[1]).slice(0, 30);
  if (sorted.length === 0){
    wrap.innerHTML = `<div class="empty-state" style="padding:16px;">분석할 키워드가 없습니다.</div>`;
    return wrap;
  }
  const box = el('<div class="keywords"></div>');
  sorted.forEach(([word, count])=>{ box.appendChild(el(`<span class="kw">${h(word)} <strong>${count}</strong></span>`)); });
  wrap.appendChild(box);
  return wrap;
}

async function switchMode(mode){
  if (state.loading) return;
  state.mode = mode;
  state.page = 1;
  const host = document.querySelector('#ca-list');
  const tb = document.querySelector('#ca-toolbar');
  markActiveButton(tb);
  if (mode === 'latest') {
    state.sortBy = 'publishedAt_desc'; await loadLatest(host);
  } else if (mode === 'mutant') {
    state.sortBy = 'mutant_desc'; await loadMutant(host);
  } else {
    state.sortBy = 'views_desc'; state.items = []; state.pageToken = ''; await loadAllFirst(host);
  }
  renderKeywordsContainer(state.items);
  renderSearchBox();
  applySearchAndRender();
}

// --- [수정된 부분 시작] ---
function applySearchAndRender(opts = {}){
  const host = document.querySelector('#ca-list');
  if (!host) return;

  // 1. 현재 `state.items`를 `sortItems` 함수를 이용해 새로 정렬
  const sortedItems = sortItems(state.items || []);
  state.items = sortedItems; // 정렬된 순서를 state에 영구 반영

  // 2. 검색 필터 적용
  const filtered = state.searchQuery
    ? state.items.filter(v => (v.title||'').toLowerCase().includes(state.searchQuery))
    : state.items;
  
  // 3. 페이지 계산
  if (opts.videoIdToFind) {
    // 특정 비디오 ID가 어느 페이지에 있는지 찾아서 state.page를 업데이트
    const newIndex = filtered.findIndex(v => v.id === opts.videoIdToFind);
    if (newIndex > -1) {
      state.page = Math.floor(newIndex / state.perPage) + 1;
    }
  } else if (opts.preservePage !== true) {
    // 옵션이 없으면 (필터 변경 등) 1페이지로 리셋
    state.page = 1; 
  }

  const showMore = state.mode === 'all' && !!state.pageToken;
  renderList(host, filtered, showMore);
}
// --- [수정된 부분 끝] ---

function normalizeVideo(raw, channel){
  const secs = secFromISO(raw.contentDetails?.duration);
  const views = Number(raw.statistics?.viewCount || 0);
  const title = raw.snippet?.title || '';
  const publishedAt = raw.snippet?.publishedAt || '';
  const longform = secs >= LONGFORM_SEC;
  const subs = Number(channel.subscriberCount || 0);
  const mutant = subs > 0 ? (views / subs) * 10 : 0;
  return {
    id: raw.id, title, publishedAt, views, secs, longform, mutant,
    channel: { id: channel.id, name: channel.title, subs: subs, thumb: channel.thumbnail },
    isDone: state.doneIds.has(raw.id),
  };
}

function sortItems(items){
  return items.slice().sort((a,b)=>{
    if (a.isDone && !b.isDone) return 1;
    if (!a.isDone && b.isDone) return -1;
    if (state.sortBy === 'publishedAt_desc') return new Date(b.publishedAt) - new Date(a.publishedAt);
    if (state.sortBy === 'mutant_desc') return b.mutant - a.mutant;
    if (state.sortBy === 'views_desc') return b.views - a.views;
    return 0;
  });
}

async function loadLatest(host){
  const ch = state.channel;
  if (!ch?.uploadsPlaylistId) { host.innerHTML = `<div class="empty-state">업로드 목록이 없는 채널입니다.</div>`; return; }
  host.innerHTML = `<div class="loading-state">최신 영상을 불러오는 중...</div>`;
  const { ids } = await fetchLatestVideoIdsFromUploads(ch.uploadsPlaylistId, 50);
  const details = await fetchVideosDetails(ids);
  state.items = details.map(v => normalizeVideo(v, ch)).filter(v => within1Month(v.publishedAt));
}

async function loadMutant(host){
  const ch = state.channel;
  if (!ch?.uploadsPlaylistId) { host.innerHTML = `<div class="empty-state">업로드 목록이 없는 채널입니다.</div>`; return; }
  host.innerHTML = `<div class="loading-state">돌연변이 영상을 분석 중...</div>`;
  const { ids } = await fetchLatestVideoIdsFromUploads(ch.uploadsPlaylistId, 50);
  const details = await fetchVideosDetails(ids);
  state.items = details.map(v => normalizeVideo(v, ch)).filter(v => v.longform);
}

async function loadAllFirst(host){
  const ch = state.channel;
  if (!ch?.uploadsPlaylistId) { host.innerHTML = `<div class="empty-state">업로드 목록이 없는 채널입니다.</div>`; return; }
  host.innerHTML = `<div class="loading-state">전체 영상을 불러오는 중...</div>`;
  const first = await ytApi('playlistItems', { part:'contentDetails', playlistId:ch.uploadsPlaylistId, maxResults:50 });
  state.pageToken = first.nextPageToken || '';
  const ids = (first.items||[]).map(it=>it.contentDetails?.videoId).filter(Boolean);
  const details = await fetchVideosDetails(ids);
  state.items = details.map(v => normalizeVideo(v, ch));
}

async function loadMoreAll(host){
  if (!state.pageToken || state.loading) return;
  state.loading = true;
  try{
    const ch = state.channel;
    const j = await ytApi('playlistItems', { part:'contentDetails', playlistId:ch.uploadsPlaylistId, maxResults:50, pageToken:state.pageToken });
    state.pageToken = j.nextPageToken || '';
    const ids = (j.items||[]).map(it=>it.contentDetails?.videoId).filter(Boolean);
    const details = await fetchVideosDetails(ids);
    const more = details.map(v => normalizeVideo(v, ch));
    state.items = state.items.concat(more);
    applySearchAndRender({ preservePage: true }); // 더 불러올 때는 현재 페이지 유지
  }finally{
    state.loading = false;
  }
}

export async function openChannelAnalysis({ mount, channelId }){
  await loadDoneIds();
  const root = document.querySelector(mount);
  if (!root) throw new Error('channelAnalysis mount element not found');
  root.innerHTML = `
    <div id="ca-root">
      <div id="ca-header"></div>
      <div id="ca-toolbar-wrap"></div>
      <div id="ca-keywords" class="section" style="margin-top:10px;"></div>
      <div id="ca-search-wrap" style="margin:10px 0;"></div>
      <div id="ca-list" class="section" style="margin-top:10px;"></div>
    </div>
  `;
  const all = await channelsAll();
  const ch = all.find(c => c.id === channelId);
  if (!ch){
    document.querySelector('#ca-list').innerHTML = `<div class="empty-state">채널 정보를 찾을 수 없습니다.</div>`;
    return;
  }
  state.channel = ch;
  renderHeader(document.querySelector('#ca-header'), ch, null);
  renderToolbar(document.querySelector('#ca-toolbar-wrap'));
  await switchMode('mutant');
}

export async function renderChannelAnalysis(opts) {
  const { mount } = opts || {};
  const channelId = opts?.channelId || opts?.channel?.id || opts?.id || opts?.channelID;
  return openChannelAnalysis({ mount, channelId });
}

window.renderChannelAnalysis = renderChannelAnalysis;
export { openChannelAnalysis as default };