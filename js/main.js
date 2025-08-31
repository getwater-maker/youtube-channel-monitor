// js/main.js
import { initDB, kvGet, kvSet } from './indexedStore.js';
import { verifyApiKey } from './youtube.js';
import { initChannel }  from './channel.js';
import { initVideos } from './videos.js';
import { initScript }   from './script.js';
import { initStudy }    from './study.js';
import { initMyChannel } from './my-channel.js';

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

// [추가] 화면 중앙에 표시되는 커스텀 확인 팝업 (confirm 대체)
window.showConfirmModal = function(message) {
  return new Promise((resolve) => {
    document.getElementById('custom-confirm-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'custom-confirm-modal';
    overlay.className = 'sp-modal-overlay';

    overlay.innerHTML = `
      <div class="sp-modal" style="max-width: 400px;">
        <div class="sp-modal-body" style="padding: 24px; text-align: center; font-size: 16px; line-height: 1.6;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        <div class="sp-modal-footer">
          <button id="confirm-btn-cancel" class="btn btn-outline">취소</button>
          <button id="confirm-btn-ok" class="btn btn-primary">확인</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeModal = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('#confirm-btn-ok').onclick = () => closeModal(true);
    overlay.querySelector('#confirm-btn-cancel').onclick = () => closeModal(false);
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal(false);
    };
  });
};


/* API Key 및 Client ID 관리 모달 */
function showApiKeyModal() {
  document.getElementById('api-key-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'api-key-modal';
  overlay.className = 'sp-modal-overlay';

  overlay.innerHTML = `
    <div class="sp-modal" style="max-width: 500px;">
      <div class="sp-modal-head">
        <div class="sp-modal-title">인증 정보 설정</div>
        <button class="sp-modal-close">&times;</button>
      </div>
      <div class="sp-modal-body">
        <p class="muted" style="font-size:14px; margin:0 0 12px;">
          Google Cloud Console에서 발급받은 인증 정보를 입력하세요.
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">콘솔 바로가기</a>
        </p>
        
        <label for="modal-apiKey-input" style="font-weight:bold; font-size:14px; display:block; margin-bottom:6px;">YouTube Data API v3 키</label>
        <input id="modal-apiKey-input" type="text" placeholder="AIzaSy..."/>
        <div id="api-key-result" class="api-key-result"></div>

        <label for="modal-clientId-input" style="font-weight:bold; font-size:14px; display:block; margin-top:16px; margin-bottom:6px;">OAuth 2.0 클라이언트 ID</label>
        <p class="muted" style="font-size:12px; margin-top:-4px; margin-bottom:8px;">'내 채널' 탭 사용에 필요합니다.</p>
        <input id="modal-clientId-input" type="text" placeholder="YOUR_CLIENT_ID.apps.googleusercontent.com"/>

      </div>
      <div class="sp-modal-footer">
        <button id="modal-btn-verify" class="btn btn-outline">API 키 유효성 검사</button>
        <button id="modal-btn-save" class="btn btn-primary">저장</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const apiKeyInput = overlay.querySelector('#modal-apiKey-input');
  const clientIdInput = overlay.querySelector('#modal-clientId-input');
  const resultDiv = overlay.querySelector('#api-key-result');
  const verifyBtn = overlay.querySelector('#modal-btn-verify');
  const saveBtn = overlay.querySelector('#modal-btn-save');

  const closeModal = () => overlay.remove();
  overlay.querySelector('.sp-modal-close').onclick = closeModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  kvGet('apiKey').then(key => { if(key) apiKeyInput.value = key; });
  kvGet('oauthClientId').then(id => { if(id) clientIdInput.value = id; });

  verifyBtn.onclick = async () => {
    const key = apiKeyInput.value.trim();
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
    await kvSet('apiKey', apiKeyInput.value.trim());
    await kvSet('oauthClientId', clientIdInput.value.trim());
    window.toast('인증 정보를 저장했습니다.', 'success');
    closeModal();
  };
}


/* Tabs */
function bindTabs(){
  const btns = Array.from(document.querySelectorAll('.yt-tab-btn'));
  const tabs = {
    channel:    document.getElementById('yt-tab-channel'),
    videos :    document.getElementById('yt-tab-videos'),
    script :    document.getElementById('yt-tab-script'),
    study  :    document.getElementById('yt-tab-study'),
    'my-channel': document.getElementById('yt-tab-my-channel'),
  };
  const inited = { channel:false, videos:false, script:false, study:false, 'my-channel':false };

  const safeInit = (fn)=> Promise.resolve().then(fn).catch(e=>{
    console.error('init failed', e); window.toast('초기화 중 오류가 발생했습니다.', 'error', 2200);
  });

  async function openTab(name){
    btns.forEach(b=> b.classList.toggle('yt-active', b.dataset.tab===name));
    Object.entries(tabs).forEach(([k,el])=> el && el.classList.toggle('yt-active', k===name));
    if (name==='channel'    && !inited.channel)    { await safeInit(()=>initChannel({ mount:'#yt-tab-channel' }));       inited.channel=true; }
    if (name==='videos'     && !inited.videos)     { await safeInit(()=>initVideos({ mount:'#yt-tab-videos' }));         inited.videos=true; }
    if (name==='script'     && !inited.script)     { await safeInit(()=>initScript({ mount:'#yt-tab-script' }));         inited.script=true; }
    if (name==='study'      && !inited.study)      { await safeInit(()=>initStudy({ mount:'#yt-tab-study' }));           inited.study=true; }
    if (name==='my-channel' && !inited['my-channel']) { await safeInit(()=>initMyChannel({ mount:'#yt-tab-my-channel' })); inited['my-channel']=true; }
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
  
  window.toast('로드 완료', 'success', 900);
}
window.addEventListener('DOMContentLoaded', bootstrap);