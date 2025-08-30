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
  // [추가] 정렬 기준 상태 추가 (기본값: 돌연변이 지수)
  sortBy: 'mutant_desc', // 'views_desc' | 'mutant_desc' | 'publishedAt_desc' | 'subs_desc'
  page: 1,
  filtered: [],
  cached: [],
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

function secFromISO(iso){ /* ... 기존과 동일 ... */ }
function withinPeriod(dateStr){ /* ... 기존과 동일 ... */ }
async function fetchLatestVideoIds(ch, max=25){ /* ... 기존과 동일 ... */ }
async function fetchVideosDetails(ids){ /* ... 기존과 동일 ... */ }

// [수정] 정렬 로직 분리 및 강화
function filterRankFromRaw(videos){
  const filtered = videos.filter(v=>{
    if (v.secs < CONFIG.longformSec) return false;
    if (v.views < CONFIG.minViews) return false;
    if (!withinPeriod(v.publishedAt)) return false;
    if (state.mode==='mutant' && v.mutant < 2.0) return false;
    return true;
  });

  return filtered.sort((a, b) => {
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

async function loadSnapshot(){ /* ... 기존과 동일 ... */ }
async function saveSnapshot(items){ /* ... 기존과 동일 ... */ }

/* ─────────────────────────────────────────────────────────────
 * 렌더링
 * ────────────────────────────────────────────────────────────*/
function renderToolbar(root){
  // [수정] 툴바 UI에 정렬 셀렉트박스 추가 및 그룹 간 간격 조정
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
      <!-- [추가] 정렬 기능 -->
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
  root.appendChild(tb);

  // [수정] 모드 변경 시 기본 정렬값도 함께 변경
  const sortSelect = tb.querySelector('#video-sort-select');
  tb.querySelectorAll('[data-mode]').forEach(x=> x.onclick = ()=>{ 
    state.mode=x.dataset.mode;
    // '최신영상'은 업로드순, '돌연변이'는 지수순을 기본 정렬로 설정
    state.sortBy = state.mode === 'latest' ? 'publishedAt_desc' : 'mutant_desc';
    sortSelect.value = state.sortBy; // UI 동기화
    tb.querySelectorAll('[data-mode]').forEach(n=>n.classList.toggle('active',n===x)); 
    state.page=1; 
    applyFiltersAndRender(root); 
  });
  
  tb.querySelectorAll('[data-views]').forEach(x=> x.onclick = ()=>{ CONFIG.minViews=Number(x.dataset.views); tb.querySelectorAll('[data-views]').forEach(n=>n.classList.toggle('active',n===x)); state.page=1; applyFiltersAndRender(root); });
  tb.querySelectorAll('[data-period]').forEach(x=> x.onclick = ()=>{ CONFIG.period=x.dataset.period; tb.querySelectorAll('[data-period]').forEach(n=>n.classList.toggle('active',n===x)); state.page=1; applyFiltersAndRender(root); });
  
  // [추가] 정렬 셀렉트박스 이벤트 리스너
  sortSelect.onchange = () => {
    state.sortBy = sortSelect.value;
    state.page = 1;
    applyFiltersAndRender(root);
  };

  tb.querySelector('#btn-reload').onclick = () => reload(root, { force:true });
}

function applyFiltersAndRender(root){
  state.filtered = filterRankFromRaw(state.cached);
  renderList(root);
}

function copyText(t){ /* ... 기존과 동일 ... */ }
async function copyImageBlob(blob){ /* ... 기존과 동일 ... */ }
function convertBlobToPngBlob(blob) { /* ... 기존과 동일 ... */ }
async function copyThumbnailImage(videoId){ /* ... 기존과 동일 ... */ }
function renderList(root){ /* ... 기존과 동일 ... */ }
async function buildRawItems(){ /* ... 기존과 동일 ... */ }
async function reload(root, { force=false } = {}){ /* ... 기존과 동일 ... */ }
export async function initVideos({ mount }){ /* ... 기존과 동일 ... */ }
export async function warmUpVideosCache(){ /* ... 기존과 동일 ... */ }