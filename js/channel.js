// js/channel.js
import { kvGet, kvSet, channelsAll, channelsPut, channelsRemove } from './indexedStore.js';

function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
function h(str){ return (str??'').replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s])); }

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

async function fetchChannelExtra(id){
  // uploads playlist / subscriberCount 등
  const j = await yt('channels', { part:'snippet,contentDetails,statistics', id });
  const c = j.items?.[0]; if (!c) throw new Error('채널 정보를 찾을 수 없습니다.');
  const uploads = c.contentDetails?.relatedPlaylists?.uploads || null;
  const subs = Number(c.statistics?.subscriberCount||0);
  const thumb = c.snippet?.thumbnails?.default?.url || '';
  const title = c.snippet?.title || '';
  return { uploads, subs, thumb, title };
}

export async function initChannel({ mount }){
  const root = document.querySelector(mount);
  root.innerHTML = `
    <div class="section">
      <div class="section-header">
        <div class="section-title">채널관리</div>
        <div class="section-actions">
          <input id="apiKey-input" type="text" placeholder="YouTube API Key" style="min-width:320px" />
          <button id="apiKey-save" class="btn btn-primary btn-sm">API Key 저장</button>
          <button id="btn-import" class="btn btn-outline btn-sm">가져오기(JSON)</button>
          <button id="btn-export" class="btn btn-outline btn-sm">내보내기(JSON)</button>
        </div>
      </div>

      <div class="toolbar">
        <input id="q" type="search" placeholder="채널명으로 검색 (예: 땅동사연)" style="max-width:380px" />
        <button id="btn-search" class="btn btn-primary btn-sm">검색</button>
        <button id="btn-prev" class="btn btn-outline btn-sm" disabled>‹ 이전</button>
        <button id="btn-next" class="btn btn-outline btn-sm" disabled>다음 ›</button>
      </div>

      <div id="search-results" class="channel-list"></div>

      <h4 style="margin:14px 4px 8px">등록된 채널</h4>
      <div id="registered" class="channel-list"></div>
    </div>
  `;

  // API Key 표시
  document.getElementById('apiKey-input').value = await apiKey();
  document.getElementById('apiKey-save').onclick = async ()=>{
    const v = document.getElementById('apiKey-input').value.trim();
    await setApiKey(v);
    window.toast?.('API Key 저장 완료', 'success');
  };

  /* 검색 (pageToken 안전 보관) */
  let lastQ = '', nextToken = '', prevToken = '';
  async function search(token=''){
    const q = document.getElementById('q').value.trim();
    if (!q) return;
    lastQ = q;
    try{
      const j = await yt('search', {
        part:'snippet', type:'channel', q, maxResults:10, pageToken: token || undefined
      });
      nextToken = j.nextPageToken || '';
      prevToken = j.prevPageToken || '';
      document.getElementById('btn-next').disabled = !nextToken;
      document.getElementById('btn-prev').disabled = !prevToken;

      const list = j.items || [];
      const wrap = document.getElementById('search-results');
      wrap.innerHTML = '';
      for (const it of list){
        const id = it.id?.channelId;
        const title = it.snippet?.title || '';
        const thumb = it.snippet?.thumbnails?.default?.url || '';
        const row = el(`
          <div class="channel-row">
            <img class="channel-avatar" src="${h(thumb)}" alt="">
            <div class="channel-meta">
              <div class="channel-name">${h(title)}</div>
              <div class="channel-id">${h(id)}</div>
            </div>
            <div class="spacer"></div>
            <button class="btn btn-sm btn-primary">등록</button>
          </div>
        `);
        row.querySelector('.btn').onclick = async ()=>{
          try{
            const extra = await fetchChannelExtra(id);
            await channelsPut({
              id, title, thumbnail: extra.thumb, subscriberCount: extra.subs,
              uploadsPlaylistId: extra.uploads
            });
            window.toast?.('채널을 등록했습니다.', 'success');
            renderRegistered();
          }catch(e){ console.error(e); window.toast?.('등록 실패', 'error'); }
        };
        wrap.appendChild(row);
      }
    }catch(e){
      console.error(e);
      window.toast?.(e.message.replace(/\s+$/, ''), 'error', 2600);
    }
  }

  document.getElementById('btn-search').onclick = ()=> search('');
  document.getElementById('btn-next').onclick   = ()=> nextToken && search(nextToken);
  document.getElementById('btn-prev').onclick   = ()=> prevToken && search(prevToken);

  /* 가져오기/내보내기 */
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
        let ok = 0;
        for (const c of arr){
          if (!c?.id) continue;
          // 누락된 uploadsPlaylistId가 있으면 채워서 저장
          let ch = { id: c.id, title: c.title||'', thumbnail: c.thumbnail||c.thumb||'', subscriberCount: Number(c.subscriberCount||c.subs||0) };
          if (!c.uploadsPlaylistId){
            try{
              const ex = await fetchChannelExtra(c.id);
              ch.uploadsPlaylistId = ex.uploads;
              ch.title = ch.title || ex.title; ch.thumbnail = ch.thumbnail || ex.thumb; ch.subscriberCount = ch.subscriberCount || ex.subs;
            }catch(_){}
          } else ch.uploadsPlaylistId = c.uploadsPlaylistId;
          await channelsPut(ch); ok++;
        }
        window.toast?.(`${ok}개 채널 가져오기 완료`, 'success');
        renderRegistered();
      }catch(e){ console.error(e); window.toast?.('JSON 파싱 실패', 'error'); }
    };
    inp.click();
  };

  async function renderRegistered(){
    const list = await channelsAll();
    const wrap = document.getElementById('registered');
    wrap.innerHTML = '';
    list.forEach(c=>{
      const row = el(`
        <div class="channel-row">
          <img class="channel-avatar" src="${h(c.thumbnail||'')}" alt="">
          <div class="channel-meta">
            <div class="channel-name">${h(c.title||'(제목 없음)')}</div>
            <div class="channel-id">${h(c.id)} ${c.uploadsPlaylistId ? '' : '<span class="badge" style="margin-left:6px">uploads 미확정</span>'}</div>
          </div>
          <div class="spacer"></div>
          <button class="btn btn-danger btn-sm">삭제</button>
        </div>
      `);
      row.querySelector('.btn-danger').onclick = async ()=>{
        await channelsRemove(c.id);
        renderRegistered();
      };
      wrap.appendChild(row);
    });
  }

  renderRegistered();
}
