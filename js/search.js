// js/search.js
import { ytApi } from './youtube.js';
import { createVideoCard } from './shared-ui.js';

const CONFIG = {
  perPage: 9, // 한 페이지에 보여줄 영상 개수
  minViews: 10000,
  period: 'all',
  longformSec: 180, 
  minSubs: 0, 
  maxSubs: 0, 
};

const state = {
  query: '',
  sortBy: 'relevance',
  duration: 'long', 
  results: [], 
  page: 1,
  nextPageToken: null, 
  _busy: false,
};

const el = (html) => { const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };
const h = (s)=> (s??'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'gt;','"':'&quot;','\'':'&#39;' }[m]));
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
    window.toast?.('썸다운 완료!', 'success');
  } catch (e) {
    console.error('썸네일 다운로드 실패:', e);
    window.toast?.('썸다운에 실패했습니다.', 'error');
  }
}

async function generateVideoAnalysisPDF() {
    if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
      window.toast('PDF 생성 라이브러리를 찾을 수 없습니다.', 'error');
      return;
    }
    if (!state.results || state.results.length === 0) {
      window.toast('PDF로 만들 영상 데이터가 없습니다.', 'warning');
      return;
    }
  
    const pdfBtn = document.getElementById('search-btn-generate-pdf');
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
      const pdfTitle = `'${state.query}' 검색 결과 분석`;
  
      const CARDS_PER_PAGE = 6;
      const MARGIN_MM = 10;
      const usableWidth = pdf.internal.pageSize.getWidth() - MARGIN_MM * 2;
  
      for (let i = 0; i < state.results.length; i += CARDS_PER_PAGE) {
        const pageVideos = state.results.slice(i, i + CARDS_PER_PAGE);
        
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

function secFromISO(iso){
  if (!iso || typeof iso !== 'string') return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const hours = parseInt(m[1] || 0, 10);
  const minutes = parseInt(m[2] || 0, 10);
  const seconds = parseInt(m[3] || 0, 10);
  return (hours * 3600) + (minutes * 60) + seconds;
}

function normalizeVideo(rawVideo, rawChannel){
  const secs = secFromISO(rawVideo.contentDetails?.duration);
  const views = Number(rawVideo.statistics?.viewCount || 0);
  const title = rawVideo.snippet?.title || '';
  const description = rawVideo.snippet?.description || '';
  const tags = rawVideo.snippet?.tags || [];
  const publishedAt = rawVideo.snippet?.publishedAt || '';
  const subs = Number(rawChannel?.statistics?.subscriberCount || 0);
  const mutant = subs > 0 ? (views / subs) * 10 : 0;
  return {
    id: rawVideo.id, title, description, tags, publishedAt, views, secs,
    channel: {
      id: rawChannel?.id, 
      name: rawChannel?.snippet?.title || '', 
      subs,
      thumb: rawChannel?.snippet?.thumbnails?.default?.url || ''
    },
    mutant,
  };
}

async function executeSearch(isNewSearch = true) {
    if (state._busy) return;
    state._busy = true;
    updatePaginationUI(); 

    const listContainer = document.getElementById('search-list');
    
    if (isNewSearch) {
        state.results = [];
        state.page = 1;
        state.nextPageToken = null;
        listContainer.innerHTML = `<div class="loading-state">검색 중... (조건에 맞는 영상을 찾는 중입니다)</div>`;
    }

    const targetCount = (state.page + 1) * CONFIG.perPage;
    let searchToken = isNewSearch ? '' : state.nextPageToken;

    while (state.results.length < targetCount && searchToken !== undefined) {
        try {
            const searchParams = {
                part: 'snippet', q: state.query, type: 'video',
                maxResults: 50, pageToken: searchToken,
                order: state.sortBy === 'mutant' ? 'relevance' : state.sortBy,
            };

            const searchResponse = await ytApi('search', searchParams);
            searchToken = searchResponse.nextPageToken;

            const videoIds = searchResponse.items.map(item => item.id.videoId).filter(Boolean);
            if (videoIds.length === 0) continue;

            const videoDetails = await ytApi('videos', { part: 'snippet,statistics,contentDetails', id: videoIds.join(',') });
            const channelIds = [...new Set(videoDetails.items.map(item => item.snippet.channelId))];
            if (channelIds.length === 0) continue;

            const channelDetailsResponse = await ytApi('channels', { part: 'snippet,statistics', id: channelIds.join(',') });
            const channelsMap = new Map(channelDetailsResponse.items.map(ch => [ch.id, ch]));

            const newVideos = videoDetails.items
                .map(v => normalizeVideo(v, channelsMap.get(v.snippet.channelId)))
                .filter(v => {
                    if (v.views < CONFIG.minViews) return false;
                    if (state.duration === 'long' && v.secs <= CONFIG.longformSec) return false;
                    if (state.duration === 'short' && v.secs > CONFIG.longformSec) return false;
                    const subs = v.channel.subs;
                    if (CONFIG.minSubs > 0 && subs < CONFIG.minSubs) return false;
                    if (CONFIG.maxSubs > 0 && subs > CONFIG.maxSubs) return false;
                    return true;
                });
            
            state.results.push(...newVideos);
            
        } catch (e) {
            console.error('Search failed:', e);
            listContainer.innerHTML = `<div class="empty-state error">검색에 실패했습니다: ${e.message}</div>`;
            state._busy = false;
            updatePaginationUI();
            return;
        }
    }

    state.nextPageToken = searchToken;
    
    if (isNewSearch && state.sortBy === 'mutant') {
      state.results.sort((a, b) => b.mutant - a.mutant);
    }

    state._busy = false;
    renderList();
    updatePaginationUI();
}

function copyText(t){ navigator.clipboard.writeText(t).then(()=>window.toast('복사 완료', 'success', 800)).catch(()=>window.toast('복사 실패', 'error')); }
async function copyImageBlob(blob){ try { await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]); window.toast('썸복사 완료','success', 900); } catch(e){ console.error(e); window.toast('썸복사 실패','error'); } }
function convertBlobToPngBlob(blob) { return new Promise((ok,rej)=>{ const i=new Image(); const c=document.createElement('canvas'); const x=c.getContext('2d'); i.onload=()=>{ c.width=i.width; c.height=i.height; x.drawImage(i,0,0); c.toBlob(ok,'image/png'); }; i.onerror=rej; i.src=URL.createObjectURL(blob); }); }
async function copyThumbnailImage(videoId){ const r = await fetch(`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`); const blob = await r.blob(); if (!blob.type.startsWith('image/')) throw new Error('not an image'); const pngBlob = await convertBlobToPngBlob(blob); copyImageBlob(pngBlob); }

// [핵심 변경] updatePaginationUI 로직 수정
function updatePaginationUI() {
    const prevBtn = document.getElementById('search-prev-btn');
    const nextBtn = document.getElementById('search-next-btn');
    const pageDisplay = document.getElementById('search-page-display');
    if (!prevBtn || !nextBtn || !pageDisplay) return;
    
    prevBtn.disabled = state.page <= 1 || state._busy;
    
    // 다음 페이지를 보여줄 데이터가 있거나, 아직 더 불러올 데이터(nextPageToken)가 남아있으면 버튼 활성화
    const hasMoreData = state.results.length > state.page * CONFIG.perPage;
    const canFetchMore = state.nextPageToken !== undefined && state.nextPageToken !== null;
    nextBtn.disabled = !hasMoreData && !canFetchMore || state._busy;
    
    pageDisplay.textContent = `페이지 ${state.page}`;
}

function attachCardEventListeners(card, v) {
  card.querySelector('.btn-copy-thumb').onclick = () => copyThumbnailImage(v.id);
  card.querySelector('.btn-download-thumb').onclick = () => downloadThumbnail(v.id, v.title);
  card.querySelector('.btn-copy-title').onclick = () => copyText(v.title);
  card.querySelector('.btn-copy-info').onclick = () => {
    const tagsStr = (v.tags && v.tags.length > 0) ? v.tags.map(t => `#${t}`).join(' ') : '없음';
    const info = `제목 : ${v.title}\n구독자수 : ${num(v.channel.subs).toLocaleString()}명\n조회수 : ${num(v.views).toLocaleString()}회\n업로드 일: ${new Date(v.publishedAt).toLocaleDateString('ko-KR')}\n설명글 : ${v.description || '없음'}\n해시태그 : ${tagsStr}`;
    copyText(info);
  };
}

function renderList(){
  const root = document.getElementById('search-list');
  root.innerHTML = '';

  const start = (state.page - 1) * CONFIG.perPage;
  const end = start + CONFIG.perPage;
  const pageItems = state.results.slice(start, end);

  if (pageItems.length === 0) {
    // 검색 중이 아닐 때만 '결과 없음' 표시
    if (!state._busy) {
      root.innerHTML = state.page > 1 
        ? `<div class="empty-state">더 이상 결과가 없습니다.</div>`
        : `<div class="empty-state">조건에 맞는 영상이 없습니다. 필터를 변경하거나 다른 키워드로 검색해보세요.</div>`;
    }
    return;
  }
  
  const grid = el('<div class="video-grid"></div>');
  pageItems.forEach(v=>{
    const card = createVideoCard(v, { showDoneButton: false });
    attachCardEventListeners(card, v);
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

function renderAndBindToolbar(toolbarContainer) {
    toolbarContainer.innerHTML = '';
    const tb = el(`
      <div id="search-toolbar-container">
        <div class="search-main-input-group">
            <input id="search-query-input" type="search" placeholder="검색어를 입력하세요..." />
            <button id="search-execute-btn" class="btn btn-primary">검색</button>
        </div>
        <div class="search-filters-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
            <div class="group">
                <strong class="filter-label">정렬 기준:</strong>
                <select id="search-sort-select" class="btn-outline" style="height: 38px; width: 120px; padding: 0 8px;">
                    <option value="relevance">관련성</option>
                    <option value="mutant">돌연변이</option>
                    <option value="viewCount">조회수</option>
                    <option value="date">최신</option>
                </select>
            </div>
            <div class="group">
                <strong class="filter-label">조회수:</strong>
                <span class="chip active" data-views="10000">1만+</span>
                <span class="chip" data-views="30000">3만+</span>
                <span class="chip" data-views="50000">5만+</span>
            </div>
            <div class="group">
                <strong class="filter-label">기간:</strong>
                <span class="chip" data-period="1w">1주</span>
                <span class="chip" data-period="2w">2주</span>
                <span class="chip" data-period="1m">한달</span>
                <span class="chip active" data-period="all">전체</span>
            </div>
            <div class="group">
                <strong class="filter-label">영상 길이:</strong>
                <span class="chip active" data-duration="long">롱폼</span>
                <span class="chip" data-duration="short">숏폼</span>
                <span class="chip" data-duration="any">모두</span>
            </div>
            <div class="group">
                <strong class="filter-label">구독자:</strong>
                <input id="sub-filter-min" type="number" min="0" placeholder="최소" style="width: 80px; height: 34px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 0 8px; text-align: right;">
                -
                <input id="sub-filter-max" type="number" min="0" placeholder="최대" style="width: 80px; height: 34px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 10px; padding: 0 8px; text-align: right;">
            </div>
            <div class="group search-actions" style="justify-self: end;">
                <button id="search-btn-download-titles" class="btn btn-outline btn-sm">제목추출</button>
                <button id="search-btn-generate-pdf" class="btn btn-outline btn-sm">PDF 생성</button>
            </div>
        </div>
      </div>
    `);
    toolbarContainer.appendChild(tb);

    const queryInput = tb.querySelector('#search-query-input');
    const searchBtn = tb.querySelector('#search-execute-btn');
    
    const triggerSearch = () => {
        const newQuery = queryInput.value.trim();
        if(!newQuery) {
            window.toast('검색어를 입력해주세요.', 'warning');
            return;
        }
        state.query = newQuery;
        executeSearch(true);
    };

    queryInput.onkeydown = (e) => { if (e.key === 'Enter') triggerSearch(); };
    searchBtn.onclick = triggerSearch;

    const createFilterHandler = (selector, stateKey, isConfig = false) => {
        tb.querySelectorAll(selector).forEach(el => {
            el.onclick = () => {
                const datasetKey = Object.keys(el.dataset)[0];
                const value = el.dataset[datasetKey];
                if (isConfig) {
                    CONFIG[stateKey] = !isNaN(Number(value)) ? Number(value) : value;
                } else {
                    state[stateKey] = value;
                }
                
                tb.querySelectorAll(selector).forEach(n => n.classList.remove('active'));
                el.classList.add('active');
                
                if (state.query) triggerSearch();
            };
        });
    };
    
    createFilterHandler('[data-views]', 'minViews', true);
    createFilterHandler('[data-period]', 'period', true);
    createFilterHandler('[data-duration]', 'duration');
    tb.querySelector('#search-sort-select').onchange = (e) => {
        state.sortBy = e.target.value;
        if (state.query) triggerSearch();
    };
    
    const handleSubFilterChange = () => {
        const minVal = parseInt(tb.querySelector('#sub-filter-min').value, 10);
        const maxVal = parseInt(tb.querySelector('#sub-filter-max').value, 10);
        CONFIG.minSubs = isNaN(minVal) || minVal < 0 ? 0 : minVal;
        CONFIG.maxSubs = isNaN(maxVal) || maxVal < 0 ? 0 : maxVal;
        if (state.query) triggerSearch();
    };
    tb.querySelector('#sub-filter-min').addEventListener('input', debounce(handleSubFilterChange, 500));
    tb.querySelector('#sub-filter-max').addEventListener('input', debounce(handleSubFilterChange, 500));


    tb.querySelector('#search-btn-download-titles').onclick = () => {
        if (!state.results || state.results.length === 0) {
            window.toast('추출할 영상 데이터가 없습니다.', 'warning'); return;
        }
        const d=new Date(), mm=(d.getMonth()+1+'').padStart(2,'0'), dd=(d.getDate()+'').padStart(2,'0');
        const filename = `${mm}${dd}_${state.query}_검색결과_제목모음.txt`;
        const content = "제목 | 조회수 | 구독자수 | 업로드일자\n" + state.results.map(v =>
            `${v.title.replace(/\|/g,'ㅣ')} | ${num(v.views).toLocaleString()} | ${num(v.channel.subs).toLocaleString()} | ${new Date(v.publishedAt).toLocaleDateString('ko-KR')}`
        ).join('\n');
        downloadFile(filename, content);
        window.toast('제목추출 완료!', 'success');
    };

    tb.querySelector('#search-btn-generate-pdf').onclick = generateVideoAnalysisPDF;
}

export async function initSearch({ mount }) {
    const root = document.querySelector(mount);
    root.innerHTML = `
      <style>
        #search-toolbar-container { display: flex; flex-direction: column; gap: 16px; border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 16px; }
        .search-main-input-group { display: flex; gap: 8px; }
        #search-query-input { flex-grow: 1; min-width: 0; height: 44px; font-size: 16px; }
        #search-execute-btn { height: 44px; flex-shrink: 0; padding: 0 28px; }
        .search-filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px 16px; align-items: center; }
        .search-filters-grid .group { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
        .filter-label { font-size: 14px; color: var(--muted); white-space: nowrap; margin-right: 4px; }
        .search-actions { justify-self: end; }
        .search-pagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; }
      </style>
      <div class="section">
        <div id="search-toolbar"></div>
        <div id="search-list">
          <div class="empty-state">검색어를 입력하고 '검색' 버튼을 눌러주세요.</div>
        </div>
        <div class="search-pagination">
          <button id="search-prev-btn" class="btn">‹ 이전</button>
          <span id="search-page-display" style="font-weight: bold; font-size: 14px; color: var(--muted);"></span>
          <button id="search-next-btn" class="btn">다음 ›</button>
        </div>
      </div>
    `;

    renderAndBindToolbar(root.querySelector('#search-toolbar'));

    root.querySelector('#search-prev-btn').onclick = () => {
        if (state.page > 1) {
            state.page--;
            renderList();
            updatePaginationUI();
        }
    };
    root.querySelector('#search-next-btn').onclick = () => {
        state.page++;
        if (state.results.length < state.page * CONFIG.perPage && state.nextPageToken !== undefined) {
            executeSearch(false);
        } else {
            renderList();
            updatePaginationUI();
        }
    };
    updatePaginationUI();
}