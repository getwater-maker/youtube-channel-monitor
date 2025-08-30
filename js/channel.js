// js/channel.js
import { kvGet, kvSet, channelsAll, channelsPut, channelsRemove } from './indexedStore.js';

function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function h(str){ return (str??'').replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s])); }

// 숫자 포맷팅 헬퍼 (예: 12345 -> 1.2만)
function formatNum(n) {
  const num = Number(n);
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}억`;
  if (num >= 10000) return `${(num / 10000).toFixed(0)}만`;
  return num.toLocaleString('ko-KR');
}

async function apiKey(){ return (await kvGet('apiKey')) || ''; }
async function setApiKey(v){ await kvSet('apiKey', v||''); }

async function yt(endpoint, params){
  const key = await apiKey();
  if (!key){ throw new Error('먼저 API 키를 입력/저장하세요.'); }
  const qs = new URLSearchParams({ ...params, key });
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${qs.toString()}`;
  const r = await fetch(url);
  if (!r.ok){ const t=await r.text(); throw new Error(`${endpoint} 실패 (${r.status}) ${t}`); }
  return r.json();
}

// 더 많은 채널 정보를 가져오도록 API 호출 부분을 수정
async function fetchChannelExtra(id){
  const j = await yt('channels', { part:'snippet,contentDetails,statistics,brandingSettings', id });
  const c = j.items?.[0]; if (!c) throw new Error(`채널 ID(${id}) 정보를 찾을 수 없습니다.`);
  
  return {
    id, // id를 명시적으로 포함
    title: c.snippet?.title || '',
    description: c.snippet?.description || '',
    thumbnail: c.snippet?.thumbnails?.medium?.url || c.snippet?.thumbnails?.default?.url || '',
    uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads || null,
    subscriberCount: Number(c.statistics?.subscriberCount||0),
    videoCount: Number(c.statistics?.videoCount||0),
    viewCount: Number(c.statistics?.viewCount||0),
    bannerUrl: c.brandingSettings?.image?.bannerExternalUrl || null
  };
}

// 채널 정보를 바탕으로 카드 HTML을 생성하는 함수
function createChannelCard(ch, isRegistered = false) {
  const actionBtn = isRegistered
    ? `<button class="btn btn-sm btn-danger btn-remove">삭제</button>`
    : `<button class="btn btn-sm btn-primary btn-register">등록</button>`;

  return el(`
    <div class="channel-card" data-id="${h(ch.id)}">
      <div class="card-banner" style="${ch.bannerUrl ? `background-image:url(${ch.bannerUrl})` : ''}">
        <img class="card-avatar" src="${h(ch.thumbnail)}" alt="${h(ch.title)} 프로필">
      </div>
      <div class="card-body">
        <a href="https://www.youtube.com/channel/${h(ch.id)}" target="_blank" rel="noopener" class="card-title-link">
            <div class="card-title">${h(ch.title)}</div>
        </a>
        <div class="card-stats">
          <div class="stat-item"><strong>${formatNum(ch.subscriberCount)}</strong><span>구독자</span></div>
          <div class="stat-item"><strong>${formatNum(ch.videoCount)}</strong><span>동영상</span></div>
          <div class="stat-item"><strong>${formatNum(ch.viewCount)}</strong><span>총 조회수</span></div>
        </div>
        <p class="card-description">${h(ch.description)}</p>
        <div class="card-actions">${actionBtn}</div>
      </div>
    </div>
  `);
}

export async function initChannel({ mount }){
  const root = document.querySelector(mount);
  // 새로운 UI 구조로 HTML 변경
  root.innerHTML = `
    <div class="section">
      <div class="section-header">
        <div class="section-title">API Key &amp; 데이터</div>
        <div class="section-actions">
          <input id="apiKey-input" type="text" placeholder="YouTube API Key" style="min-width:320px" />
          <button id="apiKey-save" class="btn btn-primary btn-sm">저장</button>
          <button id="btn-import" class="btn btn-outline btn-sm">가져오기</button>
          <button id="btn-export" class="btn btn-outline btn-sm">내보내기</button>
        </div>
      </div>
    </div>
    <div class="section" style="margin-top:18px;">
      <div class="section-header">
        <div class="section-title">채널 검색</div>
      </div>
      <div class="toolbar">
        <input id="q" type="search" placeholder="채널명으로 검색 (예: 땅동사연)" style="flex-grow:1; max-width:none;" />
        <button id="btn-search" class="btn btn-primary">검색</button>
      </div>
      <div id="search-results" class="channel-grid"></div>
      <div id="search-pagination" class="pagination" style="margin-top: 18px; justify-content: flex-end;">
        <button id="btn-prev" class="btn btn-outline" disabled>‹ 이전</button>
        <button id="btn-next" class="btn btn-outline" disabled>다음 ›</button>
      </div>
    </div>
    <div class="section" style="margin-top:18px;">
      <div class="section-header">
        <div class="section-title">등록된 채널</div>
      </div>
      <div id="registered" class="channel-grid"></div>
    </div>
  `;

  document.getElementById('apiKey-input').value = await apiKey();
  document.getElementById('apiKey-save').onclick = async ()=>{
    await setApiKey(document.getElementById('apiKey-input').value.trim());
    window.toast?.('API Key 저장 완료', 'success');
  };

  let lastQ = '', nextToken = '', prevToken = '';
  
  // 검색 및 렌더링 로직 수정
  async function search(token=''){
    const q = document.getElementById('q').value.trim();
    if (!q) return;
    lastQ = q;
    const wrap = document.getElementById('search-results');
    try{
      const params = { part: 'snippet', type: 'channel', q, maxResults: 9 };
      // [오류 수정] token이 있을 때만 pageToken 파라미터를 추가합니다.
      if (token) {
        params.pageToken = token;
      }
      
      wrap.innerHTML = '<div class="loading-state">검색 중...</div>';
      const j = await yt('search', params);
      nextToken = j.nextPageToken || '';
      prevToken = j.prevPageToken || '';
      document.getElementById('btn-next').disabled = !nextToken;
      document.getElementById('btn-prev').disabled = !prevToken;

      const channelIds = (j.items || []).map(it => it.id?.channelId).filter(Boolean);
      if(!channelIds.length) {
        wrap.innerHTML = '<div class="empty-state">검색 결과가 없습니다.</div>';
        return;
      }
      
      wrap.innerHTML = '<div class="loading-state">채널 상세 정보 불러오는 중...</div>';
      const detailedChannels = await Promise.all(channelIds.map(id => fetchChannelExtra(id).catch(e => { console.error(e); return null; })));
      
      wrap.innerHTML = '';
      for (const ch of detailedChannels) {
        if (!ch) continue; // 정보 로드 실패한 채널은 건너뛰기
        const card = createChannelCard(ch, false);
        card.querySelector('.btn-register').onclick = async () => {
          try {
            card.querySelector('.btn-register').textContent = '등록 중...';
            card.querySelector('.btn-register').disabled = true;
            // 등록 시점에 최신 정보로 한 번 더 갱신
            const latestChInfo = await fetchChannelExtra(ch.id);
            await channelsPut(latestChInfo);
            window.toast?.(`'${latestChInfo.title}' 채널을 등록했습니다.`, 'success');
            renderRegistered();
          } catch(e) {
            console.error(e);
            window.toast?.('등록 실패: ' + e.message, 'error');
            card.querySelector('.btn-register').textContent = '등록';
            card.querySelector('.btn-register').disabled = false;
          }
        };
        wrap.appendChild(card);
      }
    } catch(e) {
      console.error(e);
      window.toast?.(e.message.replace(/\s+$/, ''), 'error', 2600);
      wrap.innerHTML = `<div class="empty-state error">${e.message}</div>`;
    }
  }

  document.getElementById('btn-search').onclick = ()=> search('');
  document.getElementById('q').onkeydown = (e) => { if(e.key === 'Enter') { e.preventDefault(); search(''); } };
  document.getElementById('btn-next').onclick = ()=> nextToken && search(nextToken);
  document.getElementById('btn-prev').onclick = ()=> prevToken && search(prevToken);

  // 등록된 채널 렌더링 로직 수정
  async function renderRegistered(){
    const list = await channelsAll();
    const wrap = document.getElementById('registered');
    wrap.innerHTML = '';
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state">등록된 채널이 없습니다. 위에서 채널을 검색하여 추가하세요.</div>';
      return;
    }
    list.sort((a,b) => b.subscriberCount - a.subscriberCount).forEach(c => {
      const card = createChannelCard(c, true);
      card.querySelector('.btn-remove').onclick = async () => {
        if (confirm(`'${c.title}' 채널을 정말 삭제하시겠습니까?`)) {
          await channelsRemove(c.id);
          renderRegistered();
        }
      };
      wrap.appendChild(card);
    });
  }

  // 가져오기/내보내기 로직
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
            // 가져온 채널도 최신 정보로 업데이트하여 저장
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
