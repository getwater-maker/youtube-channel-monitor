// js/channelAnalysis.js
// 채널 전용 분석 섹션
// - 최신영상: 최근 1개월 이내, 업로드 최신순(내림차순)  ← (요청 반영)
// - 돌연변이: 롱폼(>=181초)만, 돌연변이 지수 내림차순
// - 채널전체: 모든 영상, 조회수 내림차순, 20개 단위 로드(더 불러오기)
// - 영상카드: 영상분석과 동일 버튼(썸네일복사, 정보복사, 작업완료)

import { channelsAll, kvGet, kvSet } from './indexedStore.js';
import { ytApi } from './youtube.js';

const LONGFORM_SEC = 181;

const state = {
  channel: null,
  // 기본 모드/정렬
  mode: 'mutant',         // 'latest' | 'mutant' | 'all'
  sortBy: 'mutant_desc',  // latest: publishedAt_desc (자동 전환), mutant: mutant_desc, all: views_desc
  // 데이터
  items: [],              // 현재 화면에 표시 중인 비디오들(모드 전환 시 재계산)
  pageToken: '',          // 채널전체에서 playlistItems pageToken
  loading: false,
  // 작업완료 체크
  doneIds: new Set(),
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

// 썸네일 복사
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
async function fetchLatestVideoIdsFromUploads(uploadsPlaylistId, max=25, pageToken=''){
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
  // 채널 카드처럼 보이는 헤더 (배너 위에 좌하단 채널명, 우하단 통계)
  const header = el(`
    <div class="section" style="padding:0; overflow:hidden; position:relative; margin-bottom:16px;">
      <div style="width:100%; aspect-ratio: 6/1; ${ch.bannerUrl?`background-image:url(${ch.bannerUrl}); background-size:cover; background-position:center;`:'background:var(--card);'}"></div>
      <!-- 좌하단 채널명 -->
      <div style="position:absolute; left:16px; bottom:12px; display:flex; align-items:center; gap:10px;">
        <img src="${h(ch.thumbnail)}" alt="${h(ch.title)}" style="width:56px; height:56px; border-radius:50%; border:3px solid rgba(0,0,0,.25); box-shadow:0 4px 10px rgba(0,0,0,.3);" />
        <div style="font-weight:900; font-size:18px; text-shadow:0 2px 6px rgba(0,0,0,.6)">${h(ch.title)}</div>
      </div>
      <!-- 우하단 통계 -->
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

function videoCard(v){
  const doneButtonText = state.doneIds.has(v.id) ? '완료취소' : '작업완료';
  const doneButtonClass = state.doneIds.has(v.id) ? 'btn-outline' : 'btn-success';

  const card = el(`
    <div class="video-card ${state.doneIds.has(v.id) ? 'is-done' : ''}">
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
  card.querySelector('.btn-toggle-done').onclick = ()=>{
    if (state.doneIds.has(v.id)) { state.doneIds.delete(v.id); }
    else { state.doneIds.add(v.id); }
    saveDoneIds();
    // 버튼/상태 즉시 반영
    card.classList.toggle('is-done', state.doneIds.has(v.id));
    card.querySelector('.btn-toggle-done').textContent = state.doneIds.has(v.id) ? '완료취소' : '작업완료';
    card.querySelector('.btn-toggle-done').classList.toggle('btn-outline', state.doneIds.has(v.id));
    card.querySelector('.btn-toggle-done').classList.toggle('btn-success', !state.doneIds.has(v.id));
  };

  return card;
}

function renderToolbar(root){
  const tb = el(`
    <div class="toolbar">
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

  // 버튼 핸들러
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

function renderList(root, items, showLoadMore=false){
  root.innerHTML = '';
  if (!items || items.length===0){
    root.innerHTML = `<div class="empty-state">표시할 영상이 없습니다.</div>`;
    return;
  }
  const grid = el('<div class="video-grid"></div>');
  items.forEach(v => grid.appendChild(videoCard(v)));
  root.appendChild(grid);

  if (showLoadMore){
    const more = el(`<div style="display:flex; justify-content:center; margin-top:16px;"><button id="btn-load-more" class="btn btn-primary">더 불러오기</button></div>`);
    more.querySelector('#btn-load-more').onclick = ()=> loadMoreAll(root);
    root.appendChild(more);
  }
}

// ───────────────────────── 모드 전환/로딩 ─────────────────────────
async function switchMode(mode){
  if (state.loading) return;
  state.mode = mode;

  const host = document.querySelector('#ca-list');
  const keywords = document.querySelector('#ca-keywords');
  const tb = document.querySelector('#ca-toolbar');

  markActiveButton(tb);

  // 모드 별 로딩
  if (mode === 'latest') {
    state.sortBy = 'publishedAt_desc'; // ← 최신영상은 업로드 최신순 (요청 반영)
    await loadLatest(host);
  } else if (mode === 'mutant') {
    state.sortBy = 'mutant_desc';
    await loadMutant(host);
  } else {
    state.sortBy = 'views_desc';
    state.items = [];  // 채널전체는 accumulate
    state.pageToken = '';
    await loadAllFirst(host);
  }

  // 키워드 분석(간단한 워드카운트)
  renderKeywords(keywords, state.items);
}

function sortItems(items){
  const s = state.sortBy;
  return [...items].sort((a,b)=>{
    if (s === 'publishedAt_desc') return new Date(b.publishedAt) - new Date(a.publishedAt);
    if (s === 'mutant_desc') return b.mutant - a.mutant;
    return b.views - a.views; // views_desc
  });
}

function renderKeywords(container, videos){
  const wordCounts = new Map();
  const stop = new Set(['shorts','그리고','있는','것은','이유','방법','영상','공개','구독','좋아요']);
  videos.forEach(v=>{
    String(v.title).replace(/[\[\]\(\)\{\}\.,!?#&`'"]/g, ' ')
      .toLowerCase().split(/\s+/)
      .filter(w=>w.length>1 && !stop.has(w) && !/^\d+$/.test(w))
      .forEach(w=>wordCounts.set(w, (wordCounts.get(w)||0)+1));
  });
  const sorted = [...wordCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30);
  container.innerHTML = '';
  if (sorted.length===0){ container.innerHTML = `<div class="empty-state" style="padding:16px;">분석할 키워드가 없습니다.</div>`; return; }
  const wrap = el(`<div class="keywords"></div>`);
  sorted.forEach(([w,c])=> wrap.appendChild(el(`<span class="kw">${h(w)} <strong>${c}</strong></span>`)));
  container.appendChild(wrap);
}

// 최신영상(최근 1개월, 업로드 최신순)
async function loadLatest(host){
  const ch = state.channel;
  if (!ch?.uploadsPlaylistId) { host.innerHTML = `<div class="empty-state">업로드 재생목록이 없습니다.</div>`; return; }

  state.loading = true;
  document.getElementById('sync-badge').style.display='inline-flex';
  host.innerHTML = `<div class="loading-state">최신 영상을 불러오는 중...</div>`;

  try {
    // 최근 업로드 50개 정도만 가져와도 1개월 범위는 충분한 경우가 많음
    const { ids } = await fetchLatestVideoIdsFromUploads(ch.uploadsPlaylistId, 50);
    const details = await fetchVideosDetails(ids);

    const items = details.map(v=>{
      const views = num(v.statistics?.viewCount);
      const subs  = num(ch.subscriberCount);
      const secs  = secFromISO(v.contentDetails?.duration);
      return {
        id: v.id,
        title: v.snippet?.title || '',
        publishedAt: v.snippet?.publishedAt || '',
        views, secs,
        channel: { id:ch.id, name:ch.title, subs, thumb:ch.thumbnail },
        mutant: subs>0 ? views/subs : 0,
      };
    }).filter(v=> within1Month(v.publishedAt)); // 1개월 이내만

    state.items = sortItems(items); // publishedAt_desc
    renderList(host, state.items, false);
  } catch(e){
    console.error(e);
    host.innerHTML = `<div class="empty-state error">불러오기 실패: ${h(e.message)}</div>`;
  } finally {
    state.loading = false;
    document.getElementById('sync-badge').style.display='none';
  }
}

// 돌연변이(롱폼, 지수 내림차순)
async function loadMutant(host){
  const ch = state.channel;
  if (!ch?.uploadsPlaylistId) { host.innerHTML = `<div class="empty-state">업로드 재생목록이 없습니다.</div>`; return; }

  state.loading = true;
  document.getElementById('sync-badge').style.display='inline-flex';
  host.innerHTML = `<div class="loading-state">돌연변이 영상을 불러오는 중...</div>`;

  try {
    const { ids } = await fetchLatestVideoIdsFromUploads(ch.uploadsPlaylistId, 50); // 최근 50개로 충분히 상위 지수 확인
    const details = await fetchVideosDetails(ids);

    const items = details.map(v=>{
      const views = num(v.statistics?.viewCount);
      const subs  = num(ch.subscriberCount);
      const secs  = secFromISO(v.contentDetails?.duration);
      return {
        id: v.id,
        title: v.snippet?.title || '',
        publishedAt: v.snippet?.publishedAt || '',
        views, secs,
        channel: { id:ch.id, name:ch.title, subs, thumb:ch.thumbnail },
        mutant: subs>0 ? views/subs : 0,
      };
    }).filter(v=> v.secs >= LONGFORM_SEC)
      .sort((a,b)=> b.mutant - a.mutant);

    state.items = items;
    renderList(host, state.items, false);
  } catch(e){
    console.error(e);
    host.innerHTML = `<div class="empty-state error">불러오기 실패: ${h(e.message)}</div>`;
  } finally {
    state.loading = false;
    document.getElementById('sync-badge').style.display='none';
  }
}

// 채널전체(조회수 내림차순, 20개 단위 로드)
async function loadAllFirst(host){
  await loadMoreAll(host, true);
}
async function loadMoreAll(host, first=false){
  const ch = state.channel;
  if (!ch?.uploadsPlaylistId) { host.innerHTML = `<div class="empty-state">업로드 재생목록이 없습니다.</div>`; return; }
  if (state.loading) return;

  state.loading = true;
  document.getElementById('sync-badge').style.display='inline-flex';
  if (first) host.innerHTML = `<div class="loading-state">영상을 불러오는 중...</div>`;

  try {
    const { ids, nextPageToken } = await fetchLatestVideoIdsFromUploads(ch.uploadsPlaylistId, 20, state.pageToken);
    state.pageToken = nextPageToken;

    const details = await fetchVideosDetails(ids);
    const newItems = details.map(v=>{
      const views = num(v.statistics?.viewCount);
      const subs  = num(ch.subscriberCount);
      const secs  = secFromISO(v.contentDetails?.duration);
      return {
        id: v.id,
        title: v.snippet?.title || '',
        publishedAt: v.snippet?.publishedAt || '',
        views, secs,
        channel: { id:ch.id, name:ch.title, subs, thumb:ch.thumbnail },
        mutant: subs>0 ? views/subs : 0,
      };
    });

    state.items = sortItems([...state.items, ...newItems]); // views_desc
    renderList(host, state.items, Boolean(state.pageToken));
  } catch(e){
    console.error(e);
    host.innerHTML = `<div class="empty-state error">불러오기 실패: ${h(e.message)}</div>`;
  } finally {
    state.loading = false;
    document.getElementById('sync-badge').style.display='none';
  }
}

// ───────────────────────── 외부 진입 ─────────────────────────
export async function renderChannelAnalysis({ mount, channel }){
  await loadDoneIds();

  // channel이 충분치 않으면 등록 목록에서 보정
  if (!channel) {
    const all = await channelsAll();
    channel = all?.[0] || null;
  }
  if (!channel) {
    document.querySelector(mount).innerHTML = `<div class="empty-state error">분석할 채널을 찾을 수 없습니다.</div>`;
    return;
  }
  state.channel = channel;

  // 가장 최근 롱폼 업로드일 계산(배너 표시용)
  let latestLongformDate = '';
  try {
    const { ids } = await fetchLatestVideoIdsFromUploads(channel.uploadsPlaylistId, 25);
    const details = await fetchVideosDetails(ids);
    const longform = details
      .map(v=>({ publishedAt:v.snippet?.publishedAt, secs: secFromISO(v.contentDetails?.duration) }))
      .filter(v=> v.secs >= LONGFORM_SEC)
      .sort((a,b)=> new Date(b.publishedAt) - new Date(a.publishedAt));
    latestLongformDate = longform[0]?.publishedAt ? new Date(longform[0].publishedAt).toLocaleDateString('ko-KR') : '';
  } catch(e){ /* 배너용 보조 정보 실패는 무시 */ }

  // 루트 마크업
  const root = document.querySelector(mount);
  root.innerHTML = '';
  renderHeader(root, channel, latestLongformDate);

  // 툴바
  const tbWrap = el(`<div id="ca-toolbar"></div>`);
  root.appendChild(tbWrap);
  const tb = renderToolbar(tbWrap);

  // 키워드 섹션
  const kw = el(`
    <div class="section" style="margin-top: 18px;">
      <div class="section-header" style="padding-bottom:0;">
        <div class="section-title">키워드 분석</div>
      </div>
      <div id="ca-keywords"><div class="empty-state" style="padding:16px;">필터 조건에 맞는 영상이 없습니다.</div></div>
    </div>
  `);
  root.appendChild(kw);

  // 리스트 섹션
  const list = el(`<div id="ca-list" style="margin-top: 18px;"></div>`);
  root.appendChild(list);

  // 기본 진입은 ‘돌연변이’
  markActiveButton(tb);
  await loadMutant(list);
  renderKeywords(document.querySelector('#ca-keywords'), state.items);
}
