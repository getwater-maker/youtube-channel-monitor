// js/videos.js
import { kvGet, kvSet, channelsAll } from './indexedStore.js';

const CONFIG = {
  perPage: 6,
  minViews: 10000,
  period: '1m', // '1w'|'2w'|'1m'|'all'
  longformSec: 181,
};

const state = {
  mode: 'mutant',      // 'latest' | 'mutant'
  page: 1,
  filtered: [],
  cached: [],          // 디스크 캐시에서 즉시 읽어온 원본(필터 전에)
  _busy: false,        // 백그라운드 갱신 잠금
};

function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
const h = (s)=> (s??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const num = (n)=> Number(n||0);

/* ─────────────────────────────────────────────────────────────
 * API & 캐시
 * ────────────────────────────────────────────────────────────*/
async function apiKey(){ return (await kvGet('apiKey')) || ''; }
async function yt(endpoint, params){
  const key = await apiKey();
  if (!key) throw new Error('먼저 API 키를 설정하세요(채널관리 탭).');
  const qs = new URLSearchParams({ ...params, key });
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${qs.toString()}`;
  const r = await fetch(url);
  if (!r.ok){ const t=await r.text(); throw new Error(`${endpoint} 실패 (${r.status}) ${t}`); }
  return r.json();
}

async function runLimited(tasks, limit=5){
  const out = []; let i=0; const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async ()=>{
    while(i < tasks.length){ const my = i++; out[my] = await tasks[my](); }
  });
  await Promise.all(workers);
  return out;
}

function secFromISO(iso){
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso||'');
  return num(m?.[1])*3600 + num(m?.[2])*60 + num(m?.[3]);
}
function withinPeriod(dateStr){
  if (CONFIG.period==='all') return true;
  const t = new Date(dateStr).getTime(), now = Date.now(), w = 7*24*3600*1e3;
  if (CONFIG.period==='1w') return (now-t)<=w;
  if (CONFIG.period==='2w') return (now-t)<=w*2;
  if (CONFIG.period==='1m') return (now-t)<=w*4.35;
  return true;
}

async function fetchLatestVideoIds(ch, max=25){
  const j = await yt('search', { part:'id', channelId: ch.id, type:'video', order:'date', maxResults: Math.min(max,50) });
  const ids = [];
  (j.items||[]).forEach(it=> it.id?.videoId && ids.push(it.id.videoId));
  return ids;
}
async function fetchVideosDetails(ids){
  const chunks = []; for (let i=0;i<ids.length;i+=50) chunks.push(ids.slice(i,i+50));
  const tasks = chunks.map(chunk=> async()=>{
    const j = await yt('videos', { part:'snippet,contentDetails,statistics', id: chunk.join(',') });
    return j.items||[];
  });
  const sets = await runLimited(tasks, 5);
  return sets.flat();
}

function filterRankFromRaw(videos){
  return videos
    .filter(v=>{
      const secs  = v.secs; if (secs < CONFIG.longformSec) return false;
      if (v.views < CONFIG.minViews) return false;
      if (!withinPeriod(v.publishedAt)) return false;
      if (state.mode==='mutant') return v.mutant >= 2.0;
      return true;
    })
    .sort((a,b)=> state.mode==='latest'
      ? (new Date(b.publishedAt)-new Date(a.publishedAt))
      : (b.views - a.views)
    );
}

async function loadSnapshot(){
  return (await kvGet('videos:snapshot')) || null;
}
async function saveSnapshot(items){
  await kvSet('videos:snapshot', { ts: Date.now(), items });
}

/* ─────────────────────────────────────────────────────────────
 * 렌더링
 * ────────────────────────────────────────────────────────────*/
function renderToolbar(root){
  const tb = el(`
    <div class="toolbar">
      <div class="group">
        <span class="chip ${state.mode==='latest'?'active':''}" data-mode="latest">최신영상</span>
        <span class="chip ${state.mode==='mutant'?'active':''}" data-mode="mutant">돌연변이</span>
      </div>
      <div class="group">
        <span class="chip ${CONFIG.minViews===10000?'active':''}" data-views="10000">1만</span>
        <span class="chip ${CONFIG.minViews===30000?'active':''}" data-views="30000">3만</span>
        <span class="chip ${CONFIG.minViews===50000?'active':''}" data-views="50000">5만</span>
      </div>
      <div class="group">
        <span class="chip ${CONFIG.period==='1w'?'active':''}" data-period="1w">1주</span>
        <span class="chip ${CONFIG.period==='2w'?'active':''}" data-period="2w">2주</span>
        <span class="chip ${CONFIG.period==='1m'?'active':''}" data-period="1m">한달</span>
        <span class="chip ${CONFIG.period==='all'?'active':''}" data-period="all">전체</span>
      </div>
      <div class="group" style="margin-left:auto">
        <span id="sync-badge" class="chip" style="pointer-events:none;display:none">업데이트 중…</span>
        <button id="btn-reload" class="btn btn-primary btn-sm">다시불러오기</button>
      </div>
    </div>
  `);
  root.appendChild(tb);

  tb.querySelectorAll('[data-mode]').forEach(x=> x.onclick = ()=>{ state.mode=x.dataset.mode; tb.querySelectorAll('[data-mode]').forEach(n=>n.classList.toggle('active',n===x)); state.page=1; applyFiltersAndRender(root); });
  tb.querySelectorAll('[data-views]').forEach(x=> x.onclick = ()=>{ CONFIG.minViews=Number(x.dataset.views); tb.querySelectorAll('[data-views]').forEach(n=>n.classList.toggle('active',n===x)); state.page=1; applyFiltersAndRender(root); });
  tb.querySelectorAll('[data-period]').forEach(x=> x.onclick = ()=>{ CONFIG.period=x.dataset.period; tb.querySelectorAll('[data-period]').forEach(n=>n.classList.toggle('active',n===x)); state.page=1; applyFiltersAndRender(root); });
  tb.querySelector('#btn-reload').onclick = () => reload(root, { force:true });
}

function applyFiltersAndRender(root){
  state.filtered = filterRankFromRaw(state.cached);
  renderList(root);
}

function copyText(t){ return navigator.clipboard.writeText(String(t||'')); }

async function copyImageBlob(blob){
  if (window.ClipboardItem){
    try{
      await navigator.clipboard.write([ new ClipboardItem({ [blob.type]: blob }) ]);
      return true;
    } catch(e) {
      console.error('Clipboard API Error:', e);
      return false;
    }
  }
  return false;
}

// Blob을 PNG Blob으로 변환하는 캔버스 헬퍼 함수
function convertBlobToPngBlob(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url); // 메모리 정리
        if (pngBlob) {
          resolve(pngBlob);
        } else {
          reject(new Error('Canvas to Blob conversion failed'));
        }
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url); // 메모리 정리
      reject(new Error('Image loading for conversion failed'));
    };
    img.src = url;
  });
}


// 썸네일 복사 로직 (JPG->PNG 변환 포함)
async function copyThumbnailImage(videoId){
  const urls = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  ];
  for (const u of urls){
    try{
      const response = await fetch(u);
      if (!response.ok) continue;

      const sourceBlob = await response.blob();
      let blobToCopy = sourceBlob;

      // JPEG 이미지일 경우, 클립보드 호환성을 위해 PNG로 변환합니다.
      if (sourceBlob.type === 'image/jpeg') {
        try {
          blobToCopy = await convertBlobToPngBlob(sourceBlob);
        } catch (convErr) {
          console.warn('JPG to PNG conversion failed, trying with original JPG', convErr);
        }
      }
      
      const ok = await copyImageBlob(blobToCopy);
      if (ok){
        window.toast?.('썸네일 이미지가 복사되었어요', 'success');
        return; // 성공 시 함수 종료
      }
    } catch(e) {
      console.error(`Thumbnail processing failed for URL: ${u}`, e);
    }
  }
  // 모든 시도가 실패했을 경우에만 URL을 복사합니다.
  await copyText(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
  window.toast?.('이미지 복사가 안 되어 URL을 복사했어요', 'warning');
}

function renderList(root){
  const gridId='video-grid';
  let grid = root.querySelector('#'+gridId);
  if (!grid){ grid = el(`<div id="${gridId}" class="video-grid"></div>`); root.appendChild(grid); }
  grid.innerHTML='';

  const start = (state.page-1)*CONFIG.perPage;
  const items = state.filtered.slice(start, start+CONFIG.perPage);
  if (!items.length){
    grid.appendChild(el(`<div class="empty-state" style="grid-column:1 / -1">표시할 영상이 없습니다.</div>`));
  }

  items.forEach(v=>{
    const card = el(`
      <div class="video-card">
        <a class="video-link" href="https://www.youtube.com/watch?v=${h(v.id)}" target="_blank" rel="noopener">
          <div class="thumb-wrap"><img class="thumb" src="${h(v.thumb)}" alt="${h(v.title)}"></div>
          <div class="video-body">
            <div class="title">${h(v.title)}</div>
            <div class="meta">
              <img src="${h(v.channel.thumb||'')}" alt="">
              <span>${h(v.channel.title)}</span>
            </div>
            <div class="v-meta">
              <div class="v-meta-top">
                <span>조회수 ${v.views.toLocaleString('ko-KR')}</span>
                <span>${new Date(v.publishedAt).toISOString().slice(0,10)}</span>
                ${state.mode==='mutant' ? `<span class="mutant-indicator">지수 ${v.mutant.toFixed(2)}</span>` : ''}
              </div>
            </div>
          </div>
        </a>
        <div class="video-actions">
          <div>
            <button class="btn btn-sm" data-act="thumb">📷 썸네일</button>
            <button class="btn btn-sm" data-act="info">📋 정보</button>
          </div>
          <button class="btn btn-sm btn-outline" data-act="done">작업완료</button>
        </div>
      </div>
    `);
    card.querySelector('[data-act="thumb"]').onclick = ()=> copyThumbnailImage(v.id);
    card.querySelector('[data-act="info"]').onclick  = ()=> copyText(
      `제목: ${v.title}\n업로드: ${new Date(v.publishedAt).toISOString().slice(0,10)}\n구독자: ${v.channel.subs.toLocaleString('ko-KR')}\n조회수: ${v.views.toLocaleString('ko-KR')}\n돌연변이지수: ${v.mutant.toFixed(2)}\nURL: https://www.youtube.com/watch?v=${v.id}`
    ).then(()=> window.toast?.('복사했어요', 'success'));
    card.querySelector('[data-act="done"]').onclick  = ()=>{
      const idx = state.filtered.findIndex(x=>x.id===v.id);
      if (idx>=0){ const [it] = state.filtered.splice(idx,1); state.filtered.push(it); }
      state.page = Math.ceil(state.filtered.length / CONFIG.perPage) || 1;
      renderList(root);
      window.toast?.('마지막 페이지로 이동했어요', 'success');
    };
    grid.appendChild(card);
  });

  let pg = root.querySelector('#pg'); if (!pg){ pg = el(`<div id="pg" class="pagination"></div>`); root.appendChild(pg); }
  pg.innerHTML='';
  const total = Math.ceil(state.filtered.length / CONFIG.perPage) || 1;
  const makeBtn=(n,label=n)=> el(`<button class="btn btn-outline ${state.page===n?'active':''}">${label}</button>`);
  if (state.page>1){ const b=makeBtn(state.page-1,'‹ 이전'); b.onclick=()=>{state.page--; renderList(root);}; pg.appendChild(b); }
  const s = Math.max(1,state.page-2), e = Math.min(total,state.page+2);
  for (let i=s;i<=e;i++){ const b=makeBtn(i); b.onclick=()=>{state.page=i; renderList(root);}; pg.appendChild(b); }
  if (state.page<total){ const b=makeBtn(state.page+1,'다음 ›'); b.onclick=()=>{state.page++; renderList(root);}; pg.appendChild(b); }
}

/* ─────────────────────────────────────────────────────────────
 * 로드/갱신
 * ────────────────────────────────────────────────────────────*/
async function buildRawItems(){
  const channels = await channelsAll();
  if (!channels.length) return [];

  const idTasks = channels.map(ch=> async()=> ({ ch, ids: await fetchLatestVideoIds(ch, 25) }));
  const idSets  = await runLimited(idTasks, 5);
  const allIds  = [...new Set(idSets.flatMap(s=>s.ids))];

  const details = await fetchVideosDetails(allIds);

  const chMap = new Map(channels.map(c=>[c.id, c]));
  const items = details.map(v=>{
    const ch = chMap.get(v.snippet?.channelId);
    if (!ch) return null;
    const secs  = secFromISO(v.contentDetails?.duration);
    const views = num(v.statistics?.viewCount);
    const thumb = v.snippet?.thumbnails?.maxres?.url ||
                  v.snippet?.thumbnails?.standard?.url ||
                  v.snippet?.thumbnails?.high?.url ||
                  v.snippet?.thumbnails?.medium?.url ||
                  v.snippet?.thumbnails?.default?.url || '';
    const mutant = ch.subscriberCount ? (views / ch.subscriberCount) : 0;
    return {
      id: v.id, title: v.snippet?.title || '',
      publishedAt: v.snippet?.publishedAt,
      views, secs, thumb,
      channel: { id: ch.id, title: ch.title, thumb: ch.thumbnail, subs: ch.subscriberCount },
      mutant,
    };
  }).filter(Boolean);

  return items;
}

async function reload(root, { force=false } = {}){
  if (state._busy) return;
  state._busy = true;
  try{
    const badge = root.querySelector('#sync-badge'); if (badge) badge.style.display='inline-flex';
    const items = await buildRawItems();
    state.cached = items;
    await saveSnapshot(items);
    applyFiltersAndRender(root);
    window.toast?.(`영상 ${state.cached.length}개 로드 완료`, 'success');
  }catch(e){
    console.error(e);
    if (force) window.toast?.(e.message, 'error', 2800);
  }finally{
    const badge = root.querySelector('#sync-badge'); if (badge) badge.style.display='none';
    state._busy = false;
  }
}

/* 공개 API */
export async function initVideos({ mount }){
  const root = document.querySelector(mount);
  root.innerHTML = '';
  renderToolbar(root);

  const snap = await loadSnapshot();
  if (snap?.items) {
    state.cached = snap.items;
  }
  applyFiltersAndRender(root);

  const ONE_HOUR = 60 * 60 * 1000;
  if (snap?.ts && (Date.now() - snap.ts < ONE_HOUR)) {
    console.log('[Videos] 캐시가 최신이므로 갱신을 건너뜁니다.');
    return;
  }

  reload(root);
}

export async function warmUpVideosCache(){
  if (state._busy) return;
  const snap = await loadSnapshot();
  if (snap?.items?.length) return;
  
  try{
    state._busy = true;
    const items = await buildRawItems();
    await saveSnapshot(items);
  }catch(e){ /* ignore */ }
  finally{ state._busy = false; }
}```

### **수정 후 기대 효과**

이제 '썸네일' 버튼을 클릭하면 다음과 같이 작동합니다.

1.  YouTube로부터 썸네일 이미지(주로 JPG)를 가져옵니다.
2.  가져온 이미지가 JPG인 경우, 내부적으로 보이지 않는 `<canvas>`를 이용해 **PNG 포맷으로 변환**합니다.
3.  변환된 PNG 이미지를 사용자의 클립보드에 직접 복사합니다.
4.  이제 포토샵이나 다른 프로그램에 붙여넣기(`Ctrl+V` 또는 `Cmd+V`)를 하면, 투명도 정보가 포함된 깨끗한 썸네일 이미지가 바로 붙여넣어질 것입니다.

**강력 새로고침(`Ctrl`+`Shift`+`R` 또는 `Cmd`+`Shift`+`R`)**을 통해 변경사항을 적용하신 후 테스트해 보세요.
