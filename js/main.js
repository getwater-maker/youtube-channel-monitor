// js/main.js
import { initDB, kvGet, kvSet } from './indexedStore.js';
import { verifyApiKey } from './youtube.js';
import { initChannel }  from './channel.js';
import { initVideos, warmUpVideosCache } from './videos.js';
import { initScript }   from './script.js';
import { initStudy }    from './study.js'; // [추가]


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

/* API Key 관리 모달 */
function showApiKeyModal() {
  document.getElementById('api-key-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'api-key-modal';
  overlay.className = 'sp-modal-overlay';

  overlay.innerHTML = `
    <div class="sp-modal" style="max-width: 500px;">
      <div class="sp-modal-head">
        <div class="sp-modal-title">YouTube API Key 설정</div>
        <button class="sp-modal-close">&times;</button>
      </div>
      <div class="sp-modal-body">
        <p class="muted" style="font-size:14px; margin:0 0 12px;">YouTube Data API v3 사용을 위한 API 키를 입력하세요.</p>
        <input id="modal-apiKey-input" type="text" placeholder="AIzaSy..."/>
        <div id="api-key-result" class="api-key-result"></div>
      </div>
      <div class="sp-modal-footer">
        <button id="modal-btn-verify" class="btn btn-outline">유효성 검사</button>
        <button id="modal-btn-save" class="btn btn-primary">저장</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#modal-apiKey-input');
  const resultDiv = overlay.querySelector('#api-key-result');
  const verifyBtn = overlay.querySelector('#modal-btn-verify');
  const saveBtn = overlay.querySelector('#modal-btn-save');

  const closeModal = () => overlay.remove();
  overlay.querySelector('.sp-modal-close').onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  kvGet('apiKey').then(key => { if(key) input.value = key; });

  verifyBtn.onclick = async () => {
    const key = input.value.trim();
    if (!key) {
      resultDiv.textContent = 'API 키를 입력해주세요.';
      resultDiv.className = 'api-key-result error';
      return;
    }
    resultDiv.textContent = '확인 중...';
    resultDiv.className = 'api-key-result';
    const isValid = await verifyApiKey(key);
    if (isValid) {
      resultDiv.textContent = '✅ 유효한 키입니다.';
      resultDiv.className = 'api-key-result success';
    } else {
      resultDiv.textContent = '❌ 유효하지 않거나 할당량이 초과된 키입니다.';
      resultDiv.className = 'api-key-result error';
    }
  };

  saveBtn.onclick = async () => {
    await kvSet('apiKey', input.value.trim());
    window.toast('API 키를 저장했습니다.', 'success');
    closeModal();
  };
}


/* Tabs */
function bindTabs(){
  const btns = Array.from(document.querySelectorAll('.yt-tab-btn'));
  const tabs = {
    channel: document.getElementById('yt-tab-channel'),
    videos : document.getElementById('yt-tab-videos'),
    script : document.getElementById('yt-tab-script'),
    study  : document.getElementById('yt-tab-study'), // [추가]
  };
  const inited = { channel:false, videos:false, script:false, study:false }; // [추가]

  const safeInit = (fn)=> Promise.resolve().then(fn).catch(e=>{
    console.error('init failed', e); window.toast('초기화 중 오류가 발생했습니다.', 'error', 2200);
  });

  async function openTab(name){
    btns.forEach(b=> b.classList.toggle('yt-active', b.dataset.tab===name));
    Object.entries(tabs).forEach(([k,el])=> el && el.classList.toggle('yt-active', k===name));
    if (name==='channel' && !inited.channel){ await safeInit(()=>initChannel({ mount:'#yt-tab-channel' })); inited.channel=true; }
    if (name==='videos'  && !inited.videos ){ await safeInit(()=>initVideos({ mount:'#yt-tab-videos' }));   inited.videos=true; }
    if (name==='script'  && !inited.script ){ await safeInit(()=>initScript({ mount:'#yt-tab-script' }));   inited.script=true; }
    if (name==='study'   && !inited.study  ){ await safeInit(()=>initStudy({ mount:'#yt-tab-study' }));    inited.study=true; } // [추가]
  }

  btns.forEach(b=>{
    if (b.dataset.bound==='1') return; b.dataset.bound='1';
    b.addEventListener('click', ()=> openTab(b.dataset.tab));
  });

  openTab('channel');
  window.openTab = openTab;
}

/* Bootstrap */
async function bootstrap(){
  try { await initDB(); } catch(e){ console.warn('[DB] init fail:', e); }
  bindTabs();
  
  document.getElementById('btn-api-modal').onclick = showApiKeyModal;

  try { await warmUpVideosCache(); } catch(e){ /* ignore */ }
  window.toast('로드 완료', 'success', 900);
}
window.addEventListener('DOMContentLoaded', bootstrap);