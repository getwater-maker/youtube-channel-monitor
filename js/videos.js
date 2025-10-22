// js/videos.js
// 영상분석 탭
// - 채널 캐시를 기반으로 최신/돌연변이 모드 분석
// - 필터(조회수/기간/정렬/구독자수), 페이지네이션, 키워드 분석
// - 제목 다운로드, 썸네일 복사/다운로드, 정보 복사, 작업완료 토글
// - 키워드 분석 섹션과 카드 사이에 검색창 추가(제목 포함 검색, 카드 1장 폭/한 줄)
// - 정보 복사 항목에 설명글, 해시태그 포함
// - PDF 분석 리포트 기능 추가 (A4, 3열, 자동 페이지 분할, 텍스트 잘림 최종 해결)

import { kvGet, kvSet, channelsAll, channelsRemove } from './indexedStore.js';
import { ytApi } from './youtube.js';

const CONFIG = {
  perPage: 6,
  minViews: 10000,
  period: '1m', // '1w'|'2w'|'1m'|'all'
  longformSec: 181,
  minSubs: 0, // 구독자 최소값 필터 (0 = 비활성)
  maxSubs: 0, // 구독자 최대값 필터 (0 = 비활성)
};

const state = {
  mode: 'mutant',           // 'latest' | 'mutant'
  sortBy: 'mutant_desc',    // 'views_desc' | 'mutant_desc' | 'publishedAt_desc' | 'subs_desc'
  page: 1,
  filtered: [],
  cached: [],
  doneIds: new Set(),
  _busy: false,
  searchQuery: '',
};

function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
const h = (s)=> (s??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[m]));
const num = (n)=> Number(n||0);
const debounce = (fn, ms) => {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

function downloadFile(filename, data, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([data], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

async function downloadThumbnail(videoId, videoTitle) {
  try {
    const response = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`);
    if (!response.ok) throw new Error('썸네일을 찾을 수 없습니다.');
    const blob = await response.blob();
    const safeTitle = (videoTitle || 'thumbnail').replace(/[\/\\?%*:|"<>]/g, '-').substring(0, 100);
    const filename = `${safeTitle}_thumbnail.jpg`;
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    window.toast?.('썸네일 다운로드 완료!', 'success');
  } catch (e) {
    console.error('썸네일 다운로드 실패:', e);
    window.toast?.('썸네일 다운로드에 실패했습니다.', 'error');
  }
}

function getQuotaResetTimeKST() {
  try {
    const nowInLA = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const tomorrowInLA = new Date(nowInLA);
    tomorrowInLA.setDate(nowInLA.getDate() + 1);
    tomorrowInLA.setHours(0, 0, 0, 0);
    const options = { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'Asia/Seoul' };
    return new Intl.DateTimeFormat('ko-KR', options).format(tomorrowInLA);
  } catch (e) {
    return "내일";
  }
}

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

async function fetchLatestVideoIds(ch, max=25){
  if (!ch.uploadsPlaylistId) return [];
  try {
    const j = await ytApi('playlistItems', { part:'contentDetails', playlistId:ch.uploadsPlaylistId, maxResults:max });
    return j.items?.map(it=>it.contentDetails.videoId) || [];
  } catch (e) {
    if (e.message && e.message.includes('(404)')) {
      window.toast(`'${ch.title}' 채널은 삭제되었거나 비공개 상태이므로 목록에서 자동 삭제합니다.`, 'warning', 3500);
      await channelsRemove(ch.id);
      document.dispatchEvent(new CustomEvent('channelsUpdated'));
      return [];
    } else {
      throw e;
    }
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

function normalizeVideo(raw, ch){
  const secs = secFromISO(raw.contentDetails?.duration);
  const views = Number(raw.statistics?.viewCount || 0);
  const title = raw.snippet?.title || '';
  const description = raw.snippet?.description || '';
  const tags = raw.snippet?.tags || [];
  const publishedAt = raw.snippet?.publishedAt || '';
  const subs = Number(ch.subscriberCount || 0);
  const mutant = subs > 0 ? (views / subs) * 10 : 0;
  return {
    id: raw.id,
    title,
    description,
    tags,
    publishedAt,
    views,
    secs,
    channel: {
      id: ch.id,
      name: ch.title,
      subs,
      thumb: ch.thumbnail
    },
    mutant,
    isDone: false,
  };
}

function filterRankFromRaw(videos){
  const filtered = videos.filter(v=>{
    if (v.secs < CONFIG.longformSec) return false;
    if (v.views < CONFIG.minViews) return false;
    if (!withinPeriod(v.publishedAt)) return false;
    if (CONFIG.minSubs > 0 && v.channel.subs < CONFIG.minSubs) return false;
    if (CONFIG.maxSubs > 0 && v.channel.subs > CONFIG.maxSubs) return false;
    if (state.mode==='mutant' && v.mutant < 2.0) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (a.isDone && !b.isDone) return 1;
    if (!a.isDone && b.isDone) return -1;
    switch (state.sortBy) {
      case 'mutant_desc': return b.mutant - a.mutant;
      case 'publishedAt_desc': return new Date(b.publishedAt) - new Date(a.publishedAt);
      case 'subs_desc': return b.channel.subs - a.channel.subs;
      default: return b.views - a.views;
    }
  });
}

async function loadSnapshot(){ try{return await kvGet('videos:cache');}catch{return null;} }
async function saveSnapshot(items){ await kvSet('videos:cache', items); }
async function loadDoneIds() { const ids = await kvGet('videos:done_ids') || []; state.doneIds = new Set(ids); }
async function saveDoneIds() { await kvSet('videos:done_ids', Array.from(state.doneIds)); }

function analyzeAndRenderKeywords(videos) {
  const container = document.getElementById('keywords-analysis-container');
  if (!container) return;

  const wordCounts = new Map();
  const stopWords = new Set(['shorts', '그리고', '있는', '것은', '이유', '방법', '영상', '공개', '구독', '좋아요']);

  videos.forEach(video => {
    const words = (video.title||'')
      .replace(/[\[\]\(\)\{\}\.,!?#&`"']/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.has(word) && !/^\d+$/.test(word));
    words.forEach(word => wordCounts.set(word, (wordCounts.get(word) || 0) + 1));
  });

  const sortedKeywords = [...wordCounts.entries()].sort((a, b) => b[1] - a[1]);
  container.innerHTML = '';
  if (sortedKeywords.length === 0) {
    container.innerHTML = `<div class="empty-state">분석할 키워드가 없습니다.</div>`;
  } else {
    const topKeywords = sortedKeywords.slice(0, 30);
    const keywordsEl = el(`<div class="keywords"></div>`);
    topKeywords.forEach(([word, count]) => {
      const kw = el(`<span class="kw">${h(word)} <strong>${count}</strong></span>`);
      keywordsEl.appendChild(kw);
    });
    container.appendChild(keywordsEl);
  }

  ensureSearchBarBelowKeywords();
}

function ensureSearchBarBelowKeywords(){
  const keywords = document.getElementById('keywords-analysis-container');
  if (!keywords) return;
  let box = document.getElementById('videos-search-container');
  if (!box){
    box = document.createElement('div');
    box.id = 'videos-search-container';
    box.innerHTML = `
      <div class="search-row">
        <input id="video-search-input" type="search" placeholder="제목으로 검색..." />
        <button id="video-search-clear" class="btn btn-outline btn-sm">지우기</button>
      </div>
    `;
    keywords.insertAdjacentElement('afterend', box);
    box.querySelector('#video-search-input').addEventListener('input', (e)=>{
      state.searchQuery = (e.target.value||'').trim().toLowerCase();
      applyFiltersAndRender(document.getElementById('videos-list'));
    });
    box.querySelector('#video-search-clear').onclick = ()=>{
      state.searchQuery = '';
      box.querySelector('#video-search-input').value = '';
      applyFiltersAndRender(document.getElementById('videos-list'));
    };
  }
}

async function generateVideoAnalysisPDF() {
  if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
    window.toast('PDF 생성 라이브러리를 찾을 수 없습니다.', 'error');
    return;
  }
  if (!state.filtered || state.filtered.length === 0) {
    window.toast('PDF로 만들 영상 데이터가 없습니다.', 'warning');
    return;
  }

  const pdfBtn = document.getElementById('btn-generate-pdf');
  pdfBtn.disabled = true;
  pdfBtn.textContent = 'PDF 생성 중...';
  window.toast('PDF 생성을 시작합니다... 데이터 양에 따라 시간이 걸릴 수 있습니다.', 'info');

  const contentElement = document.createElement('div');
  contentElement.style.position = 'absolute';
  contentElement.style.left = '-9999px';
  contentElement.style.top = '0';
  contentElement.style.backgroundColor = 'white';
  contentElement.style.fontFamily = 'sans-serif';
  contentElement.style.color = '#333';
  contentElement.style.width = '1200px';
  document.body.appendChild(contentElement);

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const sortedVideos = [...state.filtered].sort((a, b) => b.views - a.views);
    const dates = sortedVideos.map(v => new Date(v.publishedAt));
    const minDate = new Date(Math.min.apply(null, dates));
    const maxDate = new Date(Math.max.apply(null, dates));
    const formatDate = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    const pdfTitle = `${formatDate(minDate)} ~ ${formatDate(maxDate)} 영상 분석`;

    const CARDS_PER_PAGE = 6;
    const MARGIN_MM = 10;
    const usableWidth = pdf.internal.pageSize.getWidth() - MARGIN_MM * 2;

    for (let i = 0; i < sortedVideos.length; i += CARDS_PER_PAGE) {
      const pageVideos = sortedVideos.slice(i, i + CARDS_PER_PAGE);
      
      let pageHtml = `<div style="padding: 20px;">`;
      if (i === 0) {
        pageHtml += `<h1 style="text-align: center; font-size: 24px; margin-bottom: 20px;">${pdfTitle}</h1>`;
      }
      pageHtml += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">';
      
      pageVideos.forEach(v => {
        const tagsStr = (v.tags && v.tags.length > 0) ? v.tags.map(t => `#${t}`).join(' ') : '없음';
        const descriptionStr = v.description || '없음';
        pageHtml += `
          <div style="border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; page-break-inside: avoid; display: flex; flex-direction: column;">
            <img src="https://i.ytimg.com/vi/${h(v.id)}/mqdefault.jpg" style="width: 100%; height: auto; display: block;">
            <div style="padding: 10px; border-top: 1px solid #eee; display: flex; flex-direction: column; flex-grow: 1;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; white-space: normal; word-break: break-all;">${h(v.title)}</div>
              <div style="display: flex; align-items: center; margin-bottom: 8px; font-size: 12px;">
                <img src="${h(v.channel.thumb)}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
                <span style="margin-right: 8px; white-space: normal; word-break: break-all;">${h(v.channel.name)}</span>
                <span style="color: #666; margin-left: auto; white-space: nowrap;">${num(v.channel.subs).toLocaleString()}명</span>
              </div>
              <div style="font-size: 12px; display: flex; flex-wrap: wrap; gap: 4px 8px; margin-bottom: 10px; border-bottom: 1px solid #f0f0f0; padding-bottom: 10px;">
                <span><strong>조회수:</strong> ${num(v.views).toLocaleString()}회</span>
                <span><strong>날짜:</strong> ${new Date(v.publishedAt).toLocaleDateString('ko-KR')}</span>
                <span><strong>지수:</strong> ${v.mutant.toFixed(1)}</span>
              </div>
              <div style="font-size: 12px; line-height: 1.5; flex-grow: 1;">
                  <strong style="display: block; font-size: 13px; margin-bottom: 2px;">해시태그:</strong>
                  <p style="margin: 0 0 10px 0; white-space: normal; word-break: break-all; color: #555;">${h(tagsStr)}</p>
                  <strong style="display: block; font-size: 13px; margin-bottom: 2px;">설명글:</strong>
                  <p style="margin: 0; white-space: pre-wrap; word-break: break-all; color: #555;">${h(descriptionStr)}</p>
              </div>
            </div>
          </div>
        `;
      });
      pageHtml += '</div></div>';
      contentElement.innerHTML = pageHtml;
      
      const canvas = await html2canvas(contentElement, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const imgHeight = (canvas.height * usableWidth) / canvas.width;

      if (i > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'PNG', MARGIN_MM, MARGIN_MM, usableWidth, imgHeight);
    }

    pdf.save(`${pdfTitle}.pdf`);
    window.toast('PDF 생성 완료!', 'success');

  } catch (error) {
    console.error('PDF 생성 오류:', error);
    window.toast('PDF 생성 중 오류가 발생했습니다.', 'error');
  } finally {
    document.body.removeChild(contentElement);
    pdfBtn.disabled = false;
    pdfBtn.textContent = 'PDF 생성';
  }
}

function renderAndBindToolbar(toolbarContainer, contentContainer) {
  toolbarContainer.innerHTML = '';
  const tb = el(`
    <div id="videos-toolbar-container" style="width: 100%;">
      <div class="toolbar" style="border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 8px;">
        <div class="group">
            <strong style="font-size: 14px; color: var(--muted); white-space: nowrap;">모드:</strong>
            <span class="chip ${state.mode==='latest'?'active':''}" data-mode="latest">최신영상</span>
            <span class="chip ${state.mode==='mutant'?'active':''}" data-mode="mutant">돌연변이</span>
        </div>
        <div class="group">
            <strong style="font-size: 14px; color: var(--muted); white-space: nowrap;">조회수:</strong>
            <span class="chip ${CONFIG.minViews===10000?'active':''}" data-views="10000">1만</span>
            <span class="chip ${CONFIG.minViews===30000?'active':''}" data-views="30000">3만</span>
            <span class="chip ${CONFIG.minViews===50000?'active':''}" data-views="50000">5만</span>
        </div>
        <div class="group">
            <strong style="font-size: 14px; color: var(--muted); white-space: nowrap;">기간:</strong>
            <span class="chip ${CONFIG.period==='1w'?'active':''}" data-period="1w">1주</span>
            <span class="chip ${CONFIG.period==='2w'?'active':''}" data-period="2w">2주</span>
            <span class="chip ${CONFIG.period==='1m'?'active':''}" data-period="1m">한달</span>
            <span class="chip ${CONFIG.period==='all'?'active':''}" data-period="all">전체</span>
        </div>
      </div>
      <div class="toolbar" style="justify-content: space-between;">
        <div class="group">
            <strong style="font-size: 14px; color: var(--muted); white-space: nowrap;">구독자:</strong>
            <input id="sub-filter-min" type="number" min="0" placeholder="최소" style="width: 100px; height: 34px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 0 12px; text-align: right;">
            <span style="color: var(--muted);">-</span>
            <input id="sub-filter-max" type="number" min="0" placeholder="최대" style="width: 100px; height: 34px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 0 12px; text-align: right;">
            <button id="btn-subs-under-10k" class="btn btn-outline btn-sm" style="height: 34px;">1만이하</button>
        </div>
        <div class="group">
            <strong style="font-size: 14px; color: var(--muted); white-space: nowrap;">정렬기준:</strong>
            <select id="video-sort-select" class="btn-outline" style="height: 34px;">
              <option value="views_desc">조회수</option>
              <option value="mutant_desc">돌연변이</option>
              <option value="publishedAt_desc">최신</option>
              <option value="subs_desc">구독자</option>
            </select>
        </div>
        <div class="group">
             <span id="sync-badge" class="chip">업데이트 중…</span>
             <button id="btn-download-titles" class="btn btn-outline btn-sm">제목추출</button>
             <button id="btn-generate-pdf" class="btn btn-outline btn-sm">PDF 생성</button>
             <button id="btn-reload" class="btn btn-primary btn-sm">다시불러오기</button>
        </div>
      </div>
    </div>
  `);
  toolbarContainer.appendChild(tb);

  const sortSelect = tb.querySelector('#video-sort-select');
  const minSubsInput = tb.querySelector('#sub-filter-min');
  const maxSubsInput = tb.querySelector('#sub-filter-max');

  tb.querySelectorAll('[data-mode]').forEach(x=> x.onclick = ()=>{
    state.mode=x.dataset.mode;
    state.sortBy = state.mode === 'latest' ? 'publishedAt_desc' : 'mutant_desc';
    sortSelect.value = state.sortBy;
    tb.querySelectorAll('[data-mode]').forEach(n=>n.classList.toggle('active',n===x));
    applyFiltersAndRender(contentContainer);
  });

  tb.querySelectorAll('[data-views]').forEach(x=> x.onclick = ()=>{ CONFIG.minViews=Number(x.dataset.views); tb.querySelectorAll('[data-views]').forEach(n=>n.classList.toggle('active',n===x)); applyFiltersAndRender(contentContainer); });
  tb.querySelectorAll('[data-period]').forEach(x=> x.onclick = ()=>{ CONFIG.period=x.dataset.period; tb.querySelectorAll('[data-period]').forEach(n=>n.classList.toggle('active',n===x)); applyFiltersAndRender(contentContainer); });

  const handleSubFilterChange = () => {
    const minVal = parseInt(minSubsInput.value, 10);
    const maxVal = parseInt(maxSubsInput.value, 10);
    CONFIG.minSubs = isNaN(minVal) || minVal < 0 ? 0 : minVal;
    CONFIG.maxSubs = isNaN(maxVal) || maxVal < 0 ? 0 : maxVal;
    applyFiltersAndRender(contentContainer);
  };
  
  minSubsInput.addEventListener('input', debounce(handleSubFilterChange, 500));
  maxSubsInput.addEventListener('input', debounce(handleSubFilterChange, 500));
  
  tb.querySelector('#btn-subs-under-10k').onclick = () => {
    minSubsInput.value = '';
    maxSubsInput.value = '10000';
    CONFIG.minSubs = 0;
    CONFIG.maxSubs = 10000;
    reload(contentContainer, { force: true });
  };

  sortSelect.onchange = () => {
    state.sortBy = sortSelect.value;
    applyFiltersAndRender(contentContainer);
  };
  sortSelect.value = state.sortBy;

  tb.querySelector('#btn-reload').onclick = () => reload(contentContainer, { force:true });
  tb.querySelector('#btn-generate-pdf').onclick = () => generateVideoAnalysisPDF();

  tb.querySelector('#btn-download-titles').onclick = () => {
    if (!state.filtered || state.filtered.length === 0) {
        window.toast('다운로드할 영상 데이터가 없습니다.', 'warning'); return;
    }
    const d=new Date(), mm=(d.getMonth()+1+'').padStart(2,'0'), dd=(d.getDate()+'').padStart(2,'0');
    const filename = `${mm}${dd}_${state.mode==='latest'?'최신영상':'돌연변이'}_제목모음.txt`;
    const sorted = [...state.filtered].sort((a, b) => b.views - a.views);
    const content = "제목 | 조회수 | 구독자수 | 업로드일자\n" + sorted.map(v =>
        `${v.title.replace(/\|/g,'ㅣ')} | ${num(v.views).toLocaleString()} | ${num(v.channel.subs).toLocaleString()} | ${new Date(v.publishedAt).toLocaleDateString('ko-KR')}`
    ).join('\n');
    downloadFile(filename, content);
    window.toast('제목추출 완료!', 'success');
  };
}

function renderLoadingState(container) { container.innerHTML = `<div class="loading-state">영상 데이터를 분석하고 있습니다...</div>`; }
function renderEmptyState(container) { container.innerHTML = `<div class="empty-state">분석할 채널이 없습니다.<br>먼저 '채널관리' 탭으로 이동하여 분석하고 싶은 채널을 등록해주세요.</div>`; }

function applyFiltersAndRender(root, opts = {}){
  if (!root) return;

  const base = filterRankFromRaw(state.cached);
  state.filtered = state.searchQuery
    ? base.filter(v => (v.title||'').toLowerCase().includes(state.searchQuery))
    : base;

  if (opts.videoIdToFind) {
    const newIndex = state.filtered.findIndex(v => v.id === opts.videoIdToFind);
    if (newIndex > -1) {
      state.page = Math.floor(newIndex / CONFIG.perPage) + 1;
    }
  } else if(opts.preservePage !== true) {
    state.page = 1;
  }

  renderList(root);
  analyzeAndRenderKeywords(state.filtered);
}

function copyText(t){ navigator.clipboard.writeText(t).then(()=>window.toast('복사 완료', 'success', 800)).catch(()=>window.toast('복사 실패', 'error')); }
async function copyImageBlob(blob){ try { await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]); window.toast('썸네일 복사 완료','success', 900); } catch(e){ console.error(e); window.toast('썸네일 복사 실패','error'); } }
function convertBlobToPngBlob(blob) { return new Promise((ok,rej)=>{ const i=new Image(); const c=document.createElement('canvas'); const x=c.getContext('2d'); i.onload=()=>{ c.width=i.width; c.height=i.height; x.drawImage(i,0,0); c.toBlob(ok,'image/png'); }; i.onerror=rej; i.src=URL.createObjectURL(blob); }); }
async function copyThumbnailImage(videoId){ const r = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`); const blob = await r.blob(); if (!blob.type.startsWith('image/')) throw new Error('not an image'); const pngBlob = await convertBlobToPngBlob(blob); copyImageBlob(pngBlob); }

function renderPagination(root, totalItems){
  const totalPages = Math.ceil(totalItems / CONFIG.perPage);
  const existing = root.querySelector('.pagination');
  if (existing) existing.remove();
  if (totalPages <= 1) return;

  const makeBtn = (label, page, disabled=false, active=false)=>{
    const b = el(`<button class="btn ${active ? 'active' : ''}">${label}</button>`);
    if (disabled) b.disabled = true;
    b.onclick = ()=>{
      state.page = page;
      applyFiltersAndRender(root, { preservePage: true });
      root.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    };
    return b;
  };
  const nav = el('<nav class="pagination"></nav>');

  nav.appendChild(makeBtn('처음으로', 1, state.page === 1));
  nav.appendChild(makeBtn('이전', Math.max(1, state.page - 1), state.page === 1));
  
  const windowSize = 5;
  let start = Math.max(1, state.page - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
  for (let i = start; i <= end; i++) {
    nav.appendChild(makeBtn(String(i), i, false, i === state.page));
  }
  
  nav.appendChild(makeBtn('이후', Math.min(totalPages, state.page + 1), state.page === totalPages));
  nav.appendChild(makeBtn('끝으로', totalPages, state.page === totalPages));
  root.appendChild(nav);
}

function renderList(root){
  const listWrap = root;
  listWrap.innerHTML = '';

  if (state.filtered.length === 0) {
    if (state.cached.length > 0) {
      listWrap.innerHTML = `<div class="empty-state">조건에 맞는 영상이 없습니다. 필터 설정을 변경해보세요.</div>`;
    }
    return;
  }

  const total = state.filtered.length;
  const start = (state.page-1) * CONFIG.perPage;
  const items = state.filtered.slice(start, start + CONFIG.perPage);

  const grid = el('<div class="video-grid"></div>');
  items.forEach(v=>{
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
          <button class="btn btn-sm btn-outline btn-copy-thumb">썸네일복사</button>
          <button class="btn btn-sm btn-outline btn-download-thumb">썸네일다운</button>
          <button class="btn btn-sm btn-outline btn-copy-info">정보</button>
          <button class="btn btn-sm ${doneButtonClass} btn-toggle-done">${doneButtonText}</button>
        </div>
      </div>
    `);

    card.querySelector('.btn-copy-thumb').onclick = ()=> copyThumbnailImage(v.id);
    card.querySelector('.btn-download-thumb').onclick = () => downloadThumbnail(v.id, v.title);
    card.querySelector('.btn-copy-info').onclick = ()=>{
      const tagsStr = (v.tags && v.tags.length > 0) ? v.tags.map(t=>`#${t}`).join(' ') : '없음';
      const info = `제목 : ${v.title}\n구독자수 : ${num(v.channel.subs).toLocaleString()}명\n조회수 : ${num(v.views).toLocaleString()}회\n업로드 일: ${new Date(v.publishedAt).toLocaleDateString('ko-KR')}\n설명글 : ${v.description || '없음'}\n해시태그 : ${tagsStr}`;
      copyText(info);
    };

    card.querySelector('.btn-toggle-done').onclick = async ()=>{
      const isDone = state.doneIds.has(v.id);
      if (isDone) state.doneIds.delete(v.id);
      else state.doneIds.add(v.id);
      await saveDoneIds();

      const cachedItem = state.cached.find(item => item.id === v.id);
      if (cachedItem) {
        cachedItem.isDone = !isDone;
      }

      applyFiltersAndRender(root, { preservePage: true });
    };

    grid.appendChild(card);
  });
  listWrap.appendChild(grid);
  renderPagination(root, total);
}

async function reload(root, { force=false } = {}){
  if (state._busy) return;
  state._busy = true;
  const syncBadge = document.getElementById('sync-badge');
  if(syncBadge) syncBadge.style.display = 'inline-flex';
  try{
    if (force || !(await loadSnapshot())){
      const channels = await channelsAll();
      if (!channels || channels.length === 0) {
        renderEmptyState(root);
        return;
      }
      const tasks = [];
      for (const ch of channels) {
        tasks.push(async ()=>{
          const ids = await fetchLatestVideoIds(ch, 50);
          if (!ids.length) return [];
          const details = await fetchVideosDetails(ids);
          return details.map(v => normalizeVideo(v, ch));
        });
      }
      const parts = await runLimited(tasks, 4);
      const flat = parts.flat().filter(Boolean);
      await saveSnapshot(flat);
      state.cached = flat;
    } else {
      state.cached = await loadSnapshot() || [];
    }
    await loadDoneIds();
    state.cached = state.cached.map(v => ({ ...v, isDone: state.doneIds.has(v.id) }));
    applyFiltersAndRender(root);
  } catch(e){
    console.error(e);
    root.innerHTML = `<div class="empty-state error">데이터 로딩 실패: ${e.message || e}</div>`;
  } finally {
    if(syncBadge) syncBadge.style.display = 'none';
    state._busy = false;
  }
}

export async function initVideos({ mount }){
  const root = document.querySelector(mount);
  if (!root) throw new Error('videos mount element not found');
  root.innerHTML = `
    <div class="section">
      <div class="section-header">
        <div class="section-actions" id="videos-toolbar"></div>
      </div>
      <div id="keywords-analysis-container" class="section"></div>
      <div id="videos-list" class="section"></div>
    </div>
  `;
  const toolbar = document.getElementById('videos-toolbar');
  const list = document.getElementById('videos-list');
  renderAndBindToolbar(toolbar, list);
  renderLoadingState(list);
  await reload(list, { force:false });
}

window.initVideos = initVideos;
