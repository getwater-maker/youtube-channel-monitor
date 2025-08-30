// js/main.js
import { initDB }       from './indexedStore.js';
import { initChannel }  from './channel.js';
import { initVideos, warmUpVideosCache } from './videos.js';
import { initScript }   from './script.js';

/* Toast */
(function(){
  if (window.toast) return;
  const rootId = 'yt-toast-root';
  function ensureRoot(){
    let r = document.getElementById(rootId);
    if (!r){ r = document.createElement('div'); r.id = rootId; document.body.appendChild(r); }
    return r;
  }
  window.toast = (msg, type='info', ms=1600)=>{
    const root = ensureRoot();
    const el = document.createElement('div');
    el.className = `yt-toast ${type==='success'?'yt-success':type==='error'?'yt-error':type==='warning'?'yt-warning':''}`;
    el.textContent = String(msg ?? '');
    root.appendChild(el);
    const t = setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=> el.remove(), 200); }, ms);
    return { close:()=>{ clearTimeout(t); el.remove(); } };
  };
})();

/* Tabs */
function bindTabs(){
  const btns = Array.from(document.querySelectorAll('.yt-tab-btn'));
  const tabs = {
    channel: document.getElementById('yt-tab-channel'),
    videos : document.getElementById('yt-tab-videos'),
    script : document.getElementById('yt-tab-script'),
  };
  const inited = { channel:false, videos:false, script:false };

  const safeInit = (fn)=> Promise.resolve().then(fn).catch(e=>{
    console.error('init failed', e); window.toast('초기화 중 오류가 발생했습니다.', 'error', 2200);
  });

  async function openTab(name){
    btns.forEach(b=> b.classList.toggle('yt-active', b.dataset.tab===name));
    Object.entries(tabs).forEach(([k,el])=> el.classList.toggle('yt-active', k===name));
    if (name==='channel' && !inited.channel){ await safeInit(()=>initChannel({ mount:'#yt-tab-channel' })); inited.channel=true; }
    if (name==='videos'  && !inited.videos ){ await safeInit(()=>initVideos({ mount:'#yt-tab-videos' }));   inited.videos=true; }
    if (name==='script'  && !inited.script ){ await safeInit(()=>initScript({ mount:'#yt-tab-script' }));   inited.script=true; }
  }

  btns.forEach(b=>{
    if (b.dataset.bound==='1') return; b.dataset.bound='1';
    b.addEventListener('click', ()=> openTab(b.dataset.tab));
  });

  openTab('channel'); // 시작 탭
  window.openTab = openTab;
}

/* Bootstrap */
async function bootstrap(){
  try { await initDB(); } catch(e){ console.warn('[DB] init fail:', e); }
  bindTabs();

  // ▶ 사용자가 '영상분석' 누르기 전에, 조용히 캐시를 따뜻하게 만듭니다.
  try { await warmUpVideosCache(); } catch(e){ /* ignore */ }

  window.toast('로드 완료', 'success', 900);
}
window.addEventListener('DOMContentLoaded', bootstrap);
