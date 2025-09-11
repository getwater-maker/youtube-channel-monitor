// js/script.js
// ✨ CSS 수정: 제목(...처리), 반응형 카드 그리드로 레이아웃 깨짐 현상 완벽 해결
// ✨ script2.js의 텍스트 기반 프롬프트 섹션을 새로운 섹션으로 병합
import { draftsGetAll, draftsPut, draftsRemove } from './indexedStore.js';

(function () {
  'use strict';

  // ============================ 헬퍼 함수 ============================
  const $ = (sel, root = document) => root.querySelector(sel);
  const pad2 = (n) => String(n).padStart(2, '0');
  // [V2에서 추가됨] 3자리 숫자 패딩
  const pad3 = (n) => String(n).padStart(3, '0');
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  function toast(msg, type = 'info', ms = 1500) {
    try { return window.toast?.(msg, type, ms); } catch (_) {}
    let root = $('#sp-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'sp-toast-root';
      Object.assign(root.style, {
        position: 'fixed', right: '16px', bottom: '16px', zIndex: 99999,
        display: 'flex', flexDirection: 'column', gap: '6px'
      });
      document.body.appendChild(root);
    }
    const el = document.createElement('div');
    el.textContent = String(msg ?? '');
    Object.assign(el.style, {
      padding: '10px 12px', borderRadius: '10px', color: '#fff',
      background: type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : type === 'warning' ? '#f59e0b' : '#374151',
      boxShadow: '0 6px 18px rgba(0,0,0,.25)', fontWeight: 700, minWidth: '120px', textAlign: 'center'
    });
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; }, ms);
    setTimeout(() => el.remove(), ms + 220);
  }

  const debounce = (fn, ms) => { let t = null; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };

  // ============================ 스타일 주입 ============================
  (function ensureStyles() {
    if ($('#sp-style')) return;
    const st = document.createElement('style');
    st.id = 'sp-style';
    st.textContent = `
      #sp-wrap { display:block; }
      .sp-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; flex-wrap: wrap; }
      .sp-title { font-size:20px; font-weight:900; }
      .sp-actions { display:flex; gap:8px; align-items:center; flex-wrap: wrap; }
      .sp-grid { display:grid; grid-template-columns: 1fr 1fr; gap:16px; align-items:start; }
      .sp-section { border:1px solid var(--border); border-radius:12px; background: var(--glass-bg); padding:12px; display: flex; flex-direction: column; }
      .sp-section-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; flex-wrap: wrap; }
      .sp-section-title { font-weight:800; }
      .sp-rem { display:inline-flex; gap:6px; align-items:center; }
      .sp-rem input[type="text"] { height:32px; padding:0 10px; border:1px solid var(--border); border-radius:8px; background:var(--card); color:var(--text); }
      
      .sp-textarea { width: 100%; height: 180px; resize: vertical; border:1px solid var(--border); border-radius:10px; background:var(--card); color:var(--text); padding:14px; line-height:1.6; font-size:14px; margin-bottom: 12px; }
      /* [V2에서 추가됨] 새로운 텍스트 입력창 스타일 */
      .sp-textarea-v2 { height:240px; resize:vertical; overflow:auto; width:100%; border:1px solid var(--border); border-radius:10px; background:var(--card); color:var(--text); padding:14px; line-height:1.6; font-size:14px; }


      #sp-cards { display:flex; flex-direction:column; gap:12px; min-height: 240px; }
      .sp-card { border:1px solid var(--border); border-radius:12px; background:var(--panel); padding:12px; }
      .sp-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
      .sp-card-title { font-weight:700; color:var(--brand); }
      .sp-card-pre { margin:0; white-space:pre-wrap; word-break:break-word; max-height:220px; overflow:auto; font-family:ui-monospace, monospace; }

      #sp-prompt-list { min-height: 360px; }
      .sp-prompt-main-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 18px; font-weight: 700; padding-bottom: 8px; border-bottom: 2px solid var(--border); margin-bottom: 12px; }
      .sp-prompt-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(95px, 1fr)); gap:10px; }
      .sp-prompt-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 10px 6px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; text-align: center; min-height: 80px; }
      .sp-prompt-card-label { font-weight: 700; flex-grow: 1; display: flex; align-items: center; }

      /* [V2에서 추가됨] 테이블 관련 스타일 */
      .sp-table-wrap { width:100%; margin-top:10px; }
      table.sp { width:100%; border-collapse:collapse; table-layout: fixed; }
      table.sp thead th { text-align:left; padding:10px 12px; border-bottom:1px solid var(--border); }
      table.sp tbody td { padding:6px 10px; border-bottom:1px solid var(--border); vertical-align:middle; word-break: break-all; }
      table.sp th:first-child, table.sp td:first-child { width:96px; white-space:nowrap; text-align:left; }
      table.sp th:last-child, table.sp td:last-child { width:80px; text-align:right; }
      .sp-ellipsis { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; display:block; }
      
      .sp-btn { display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; height:36px; padding:0 14px; border-radius:8px; font-weight:700; font-size:14px; border:1px solid transparent; cursor:pointer; }
      .sp-btn-sm { height:30px; padding:0 10px; font-size:12px; }
      .sp-red { background:#c4302b; color:#fff; }
      .sp-green { background:#16a34a; color:#fff; }
      .sp-blue { background:#2563eb; color:#fff; }
      .sp-gray { background:var(--glass-bg); color:var(--text); border:1px solid var(--border); }

      .sp-modal-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,.6); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px); }
      .sp-modal { background:var(--card-2); border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow); max-width:600px; width:calc(100% - 32px); max-height:calc(100vh - 40px); display:flex; flex-direction:column; }
      .sp-modal-head { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); }
      .sp-modal-title { font-size:18px; font-weight:800; }
      .sp-modal-close { font-size:24px; font-weight:bold; cursor:pointer; line-height:1; color:var(--muted); background:none; border:none; padding:0; }
      .sp-modal-body { padding:16px; overflow-y:auto; }
      .sp-draft-list { display:flex; flex-direction:column; gap:10px; }
      .sp-draft-item { display:flex; align-items:center; gap:12px; padding:10px; background:var(--panel); border:1px solid var(--border); border-radius:10px; }
      .sp-draft-meta { flex-grow:1; }
      .sp-draft-name { font-weight:700; }
      .sp-draft-date { font-size:12px; color:var(--muted); }
      .sp-draft-actions { display:flex; gap:8px; }
      .sp-modal-body .empty { text-align:center; padding:32px 0; color:var(--muted); }

      @media (max-width: 900px){ .sp-grid{grid-template-columns:1fr;} }
    `;
    document.head.appendChild(st);
  })();

  // ============================ 전역 변수 및 공통 로직 ============================
  let currentScriptContent = '';
  let currentPromptData = null;
  // [V2에서 추가됨] 새로운 텍스트 입력창의 내용을 담을 변수
  let currentPromptV2Text = '';

  let REMOVE_WORDS_SCRIPT = [];
  let REMOVE_WORDS_PROMPT = [];

  const buildRemoveRegex = (list) => {
    if (!Array.isArray(list) || !list.length) return null;
    const parts = list.map(w => String(w||'').trim()).filter(Boolean)
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    if (!parts.length) return null;
    return new RegExp(parts.join('|'), 'gi');
  };

  // ============================ 대본 섹션 로직 ============================

  function sortScriptByScene(rawText) {
    const text = String(rawText || '');
    const sceneHeaderRegex = /^[^\w\n]*장면\s*(\d+).*$/gm;
  
    const scenes = [];
    const matches = [...text.matchAll(sceneHeaderRegex)];
  
    if (matches.length === 0) {
      return text;
    }
  
    const firstMatchIndex = matches[0].index;
    const prologue = text.substring(0, firstMatchIndex).trim();
  
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];
  
      const number = parseInt(currentMatch[1], 10);
      const start = currentMatch.index;
      const end = nextMatch ? nextMatch.index : text.length;
      
      const content = text.substring(start, end).trim();
      
      scenes.push({ number, content });
    }
  
    scenes.sort((a, b) => a.number - b.number);
    
    const sortedContent = scenes.map(s => s.content).join('\n\n');
  
    return prologue ? `${prologue}\n\n${sortedContent}` : sortedContent;
  }
  
  function preprocessScript(rawText) {
    const lines = String(rawText || '').split('\n');
    const processedLines = lines.map(line => {
      if (/^[^\w\n]*장면\s*\d+/.test(line)) {
        return line.replace(/^\s*#+\s*/, '');
      }
      if (/^\s*#/.test(line)) {
        return null; 
      }
      return line;
    }).filter(line => line !== null);

    let text = processedLines.join('\n');
    const remRe = buildRemoveRegex(REMOVE_WORDS_SCRIPT);
    if (remRe) text = text.replace(remRe, '');
    return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '');
  }

  function splitCardsBySentence(src, LIMIT = 10000) {
    let rest = String(src || '').trim();
    const chunks = [];
    if(!rest) return chunks;
    function sentenceEndPositions(str) {
      const ends = [];
      const END = '.!?！？。…';
      const TRAIL = '’”"' + "'" + '\\)］〕〉》」『』」】]';
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (END.includes(ch)) {
          let j = i + 1;
          while (j < str.length && TRAIL.includes(str[j])) j++;
          ends.push(j);
        }
      }
      if (ends.length === 0 || ends[ends.length - 1] !== str.length) ends.push(str.length);
      return ends;
    }
    function cutAtSentenceBoundary(str, limit) {
      const ends = sentenceEndPositions(str);
      let cut = ends.length > 0 ? ends[0] : str.length;
      for (let k = 0; k < ends.length; k++) {
        if (ends[k] <= limit) cut = ends[k]; else break;
      }
      return { head: str.slice(0, cut), tail: str.slice(cut) };
    }
    while (rest && rest.trim().length) {
      const { head, tail } = cutAtSentenceBoundary(rest, LIMIT);
      chunks.push(head.trim());
      rest = tail;
    }
    return chunks;
  }

  function renderCards(rawScriptText) {
    const container = $('#sp-cards');
    if (!container) return;
    container.innerHTML = '';
    const processedText = preprocessScript(rawScriptText);
    const sortedText = sortScriptByScene(processedText);
    const chunks = splitCardsBySentence(sortedText, 10000);
    if (!chunks.length) {
      const empty = document.createElement('div');
      empty.className = 'sp-card';
      empty.textContent = '대본을 입력하면 여기에 카드가 표시됩니다.';
      container.appendChild(empty);
      return;
    }
    chunks.forEach((text, idx) => {
      const n = text.length;
      const card = document.createElement('div');
      card.className = 'sp-card';
      const head = document.createElement('div');
      head.className = 'sp-card-head';
      const title = document.createElement('div');
      title.className = 'sp-card-title';
      title.textContent = `카드 ${idx + 1} / ${n.toLocaleString('ko-KR')}자`;
      const btn = document.createElement('button');
      btn.className = 'sp-btn sp-btn-sm sp-red';
      btn.textContent = '복사';
      btn.addEventListener('click', async () => {
        try { 
            await navigator.clipboard.writeText(text);
            toast('복사되었습니다.', 'success');
            btn.classList.remove('sp-red');
            btn.classList.add('sp-green');
        } catch {}
      });
      head.appendChild(title);
      head.appendChild(btn);
      const pre = document.createElement('pre');
      pre.className = 'sp-card-pre';
      pre.textContent = text;
      card.appendChild(head);
      card.appendChild(pre);
      container.appendChild(card);
    });
  }

  // ============================ 이미지 프롬프트 섹션 (V1 - JSON 불러오기) ============================
  function renderPromptListFromJsonData(data) {
    currentPromptData = data;
    const container = $('#sp-prompt-list');
    if (!container) return;
    container.innerHTML = '';

    if (!data || !data.image_prompts || !Array.isArray(data.image_prompts)) {
      const empty = document.createElement('div');
      empty.className = 'sp-card';
      empty.textContent = '유효한 이미지 프롬프트 JSON 파일을 불러오세요.';
      container.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    const remRe = buildRemoveRegex(REMOVE_WORDS_PROMPT);
    const buildFullPrompt = (promptText) => {
      let fullPrompt = promptText || '';
      if (remRe) {
        fullPrompt = fullPrompt.replace(remRe, ' ').replace(/\s{2,}/g, ' ').trim();
      }
      return fullPrompt;
    };
    const makePromptCard = (label, promptText) => {
      const card = document.createElement('div');
      card.className = 'sp-prompt-card';
      const labelEl = document.createElement('div');
      labelEl.className = 'sp-prompt-card-label';
      labelEl.textContent = label;
      const btn = document.createElement('button');
      btn.className = 'sp-btn sp-btn-sm sp-red';
      btn.textContent = '복사';
      btn.addEventListener('click', async () => {
        const fullPrompt = buildFullPrompt(promptText);
        try { 
            await navigator.clipboard.writeText(fullPrompt);
            toast('프롬프트가 복사되었습니다.', 'success');
            btn.classList.remove('sp-red');
            btn.classList.add('sp-green');
        } catch(e) { toast('복사에 실패했습니다.', 'error'); }
      });
      card.appendChild(labelEl);
      card.appendChild(btn);
      return card;
    };

    if (data.audiobook_title) {
      const titleContainer = document.createElement('div');
      titleContainer.className = 'sp-prompt-main-title';
      
      const textWrapper = document.createElement('div');
      Object.assign(textWrapper.style, {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
      
      const titleLabel = document.createElement('span');
      titleLabel.style.fontWeight = '900';
      titleLabel.textContent = '제목';

      const titleContent = document.createElement('span');
      const fullTitle = data.audiobook_title;
      const truncatedTitle = fullTitle.length > 30 
        ? fullTitle.substring(0, 30) + '...' 
        : fullTitle;
      titleContent.textContent = ` | ${truncatedTitle}`;
      
      textWrapper.appendChild(titleLabel);
      textWrapper.appendChild(titleContent);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'sp-btn sp-btn-sm sp-red';
      copyBtn.textContent = '복사';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(data.audiobook_title);
          toast('제목이 복사되었습니다.', 'success');
          copyBtn.classList.remove('sp-red');
          copyBtn.classList.add('sp-green');
        } catch (e) { toast('복사에 실패했습니다.', 'error'); }
      });
      
      titleContainer.appendChild(textWrapper);
      titleContainer.appendChild(copyBtn);
      frag.appendChild(titleContainer);
    }
    
    const protagonistDesc = data.character_profiles?.main_character?.description;
    if (protagonistDesc) {
      const protagonistContainer = document.createElement('div');
      protagonistContainer.style.marginBottom = '12px';
      
      const protagonistCard = makePromptCard('주인공', protagonistDesc);
      protagonistCard.style.minWidth = '100px'; 
      protagonistContainer.appendChild(protagonistCard);
      frag.appendChild(protagonistContainer);
    }

    const scenesGrid = document.createElement('div');
    scenesGrid.className = 'sp-prompt-grid';

    const sortedScenes = [...data.image_prompts].sort((a, b) => 
      parseInt(a.scene_number, 10) - parseInt(b.scene_number, 10)
    );

    sortedScenes.forEach(scene => {
      scenesGrid.appendChild(makePromptCard(scene.scene_number, scene.prompt));
    });

    frag.appendChild(scenesGrid);
    container.appendChild(frag);
  }

  // ============================ [V2에서 추가됨] 이미지 프롬프트 섹션 (V2 - 텍스트 입력) ============================
  function collectPromptRowsWithChapters(rawText) {
    const src = String(rawText || '').replace(/\r\n/g, '\n');
    const lines = src.split('\n');
    const scenes   = [];
    let heroPrompt = null;
    const sceneRes = [
      /^\s*#{1,6}\s*\[\s*(?:장면|scene|씬)\s*(\d{1,3})[^\]]*\]/i,
      /^\s*#{1,6}\s*(?:장면|scene|씬)\s*(\d{1,3})(?:\s*[/\-–—].*)?$/i,
      /^\s*\[\s*(?:장면|scene|씬)\s*(\d{1,3})[^\]]*\]/i,
      /^\s*(?:장면|scene|씬)\s*(\d{1,3})(?:\s*[/\-–—].*)?$/i
    ];
    const nextHeaderRe = /^\s*#{2,}\s+/;
    const isSeparator = (s) => /^\s*-{3,}\s*$/.test(s);
    const normalizeForScene = (s) => String(s||'').replace(/^\s*(\*\*|__)/, '').replace(/(\*\*|__)\s*$/, '').replace(/\\\[/g, '[').replace(/\\#/g, '#').replace(/^\s*(?:[#](?!#)|[-–—•·∙▶►]|[*])\s*/, '').trim();
    const matchScene = (line) => {
      const t = normalizeForScene(line);
      for (const re of sceneRes) { const m = re.exec(t); if (m) return m; }
      return null;
    };
    const cleanInline = (s) => String(s||'').replace(/`{1,3}[^`]*`{1,3}/g, m => m).replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/[_~`]/g, '').replace(/\s+/g, ' ').trim();
    const applyRemovals = (s) => {
      const remRe = buildRemoveRegex(REMOVE_WORDS_PROMPT);
      if (!remRe) return s;
      return s.replace(remRe, ' ').replace(/\s{2,}/g, ' ').trim();
    };
    function captureHeroPrompt(allLines) {
      const headerRe = /^\s*(?:#{1,3}\s*)?(?:👤\s*)?(?:주인공|protagonist|main character)(?=[\s:：-]|$).*$/i;
      let headerIdx = allLines.findIndex(line => headerRe.test(line));
      if (headerIdx === -1) return null;
      let i = headerIdx + 1;
      if (i < allLines.length && /^\s*```.*$/.test(allLines[i])) {
        i++; const buf = [];
        for (; i < allLines.length; i++) { if (/^\s*```/.test(allLines[i])) { i++; break; } buf.push(allLines[i]); }
        const text = buf.join('\n').trim();
        return text ? cleanInline(text) : null;
      }
      const buf = [];
      for (; i < allLines.length; i++) {
        const ln = allLines[i];
        if (/^\s*#{1,3}\s+/.test(ln) || /^\s*-{3,}\s*$/.test(ln)) break;
        buf.push(ln);
      }
      const text = buf.join('\n').trim();
      return text ? cleanInline(text) : null;
    }
    heroPrompt = captureHeroPrompt(lines) || null;
    const collectBody = (startIdx) => {
      const buf = []; let j = startIdx;
      for (; j < lines.length; j++) {
        const ln = lines[j];
        if (isSeparator(ln) || nextHeaderRe.test(ln) || matchScene(ln)) break;
        buf.push(ln);
      }
      return { text: buf.join('\n').trim(), end: j - 1 };
    };
    for (let i = 0; i < lines.length; i++) {
      const ln = String(lines[i] ?? '');
      const shm = matchScene(ln);
      if (shm) {
        const idNum = parseInt(shm[1], 10);
        if (!Number.isFinite(idNum)) continue;
        const { text, end } = collectBody(i + 1);
        let prompt = applyRemovals(cleanInline(text));
        if (prompt) scenes.push({ idNum, id: pad3(idNum), prompt });
        i = Math.max(i, end);
      }
    }
    return { heroPrompt, scenes: scenes.filter(s => s.prompt.length > 0) };
  }
  
  function renderPromptTableV2() {
    const tbody = $('#sp-tbody-v2');
    if (!tbody) return;
    tbody.innerHTML = '';

    const { heroPrompt, scenes } = collectPromptRowsWithChapters(currentPromptV2Text);

    if (!heroPrompt && scenes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="color:var(--muted); text-align:center; padding:28px;">유효한 프롬프트를 입력하세요. (예: "장면 1", "주인공")</td></tr>';
      return;
    }

    const frag = document.createDocumentFragment();
    const makeRow = (id, prompt) => {
      const tr = document.createElement('tr');
      const tdScene = document.createElement('td'); tdScene.textContent = id;
      const tdPrompt = document.createElement('td');
      const div = document.createElement('div'); div.className = 'sp-ellipsis'; div.title = prompt; div.textContent = prompt; div.dataset.full = prompt; tdPrompt.appendChild(div);
      const tdCopy = document.createElement('td'); tdCopy.style.textAlign = 'right';
      const btn = document.createElement('button'); btn.className = 'sp-btn sp-btn-sm sp-red'; btn.textContent = '복사';
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(div.dataset.full || ''); toast('복사되었습니다.', 'success'); } catch {}
        btn.classList.remove('sp-red'); btn.classList.add('sp-green');
      });
      tdCopy.appendChild(btn);
      tr.appendChild(tdScene); tr.appendChild(tdPrompt); tr.appendChild(tdCopy);
      return tr;
    };

    if (heroPrompt) {
      frag.appendChild(makeRow('주인공', heroPrompt));
    }
    scenes.sort((a,b) => a.idNum - b.idNum).forEach(s => frag.appendChild(makeRow(s.id, s.prompt)));

    tbody.appendChild(frag);
  }

  // ============================ UI 및 이벤트 처리 ============================
  async function showDraftsModal() {
    $('#sp-draft-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'sp-draft-modal';
    overlay.className = 'sp-modal-overlay';
    const drafts = await draftsGetAll();
    const h = (s) => (s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
    const listHtml = drafts.length === 0
      ? '<div class="empty">저장된 초안이 없습니다.</div>'
      : drafts.map(d => `<div class="sp-draft-item" data-id="${d.id}"><div class="sp-draft-meta"><div class="sp-draft-name">${h(d.name)}</div><div class="sp-draft-date">수정: ${new Date(d.updatedAt).toLocaleString('ko-KR')}</div></div><div class="sp-draft-actions"><button class="sp-btn sp-btn-sm sp-blue btn-load-draft">불러오기</button><button class="sp-btn sp-btn-sm sp-red btn-delete-draft">삭제</button></div></div>`).join('');
    overlay.innerHTML = `<div class="sp-modal"><div class="sp-modal-head"><div class="sp-modal-title">초안 불러오기</div><button class="sp-modal-close">&times;</button></div><div class="sp-modal-body"><div class="sp-draft-list">${listHtml}</div></div></div>`;
    document.body.appendChild(overlay);
    const closeModal = () => overlay.remove();
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('.sp-modal-close')) { closeModal(); return; }
      const draftItem = e.target.closest('.sp-draft-item');
      if (!draftItem) return;
      const id = Number(draftItem.dataset.id);
      const draft = drafts.find(d => d.id === id);
      if (e.target.classList.contains('btn-load-draft') && draft) {
        currentScriptContent = draft.data.script || '';
        currentPromptData = draft.data.prompt || null;
        // [V2에서 추가됨] 새로운 프롬프트 텍스트 불러오기
        currentPromptV2Text = draft.data.promptV2 || '';
        
        $('#sp-script-input').value = currentScriptContent;
        // [V2에서 추가됨] 새로운 입력창에 값 설정
        $('#sp-prompt-input-v2').value = currentPromptV2Text;
        
        renderCards(currentScriptContent);
        renderPromptListFromJsonData(currentPromptData);
        // [V2에서 추가됨] 새로운 테이블 렌더링
        renderPromptTableV2();
        
        toast('초안을 불러왔습니다.', 'success');
        closeModal();
      }
      if (e.target.classList.contains('btn-delete-draft') && draft) {
        if (confirm(`'${draft.name}' 초안을 정말 삭제하시겠습니까?`)) {
          await draftsRemove(id);
          toast('초안을 삭제했습니다.', 'info');
          closeModal();
          showDraftsModal();
        }
      }
    });
  }

  function buildLayout(mountSel) {
    const mount = typeof mountSel === 'string' ? $(mountSel) : mountSel;
    if (!mount) return;
    mount.innerHTML = `
      <div id="sp-wrap" class="sp-wrap">
        <div class="sp-head">
          <div class="sp-title">대본 및 프롬프트 작업</div>
          <div class="sp-actions">
            <button id="sp-save" class="sp-btn sp-green">저장</button>
            <button id="sp-load" class="sp-btn sp-gray">불러오기</button>
            <button id="sp-clear" class="sp-btn sp-gray">모두 지우기</button>
          </div>
        </div>
        <div class="sp-grid">
          <!-- 대본 섹션 -->
          <div class="sp-section">
            <div class="sp-section-head">
              <div class="sp-section-title">대본</div>
              <div class="sp-rem">
                <input id="sp-rem-script" type="text" placeholder="삭제할 단어" />
                <button id="sp-rem-script-add" class="sp-btn sp-btn-sm sp-red">제거</button>
                <button id="sp-rem-script-reset" class="sp-btn sp-btn-sm sp-gray">복구</button>
              </div>
            </div>
            <textarea id="sp-script-input" class="sp-textarea" placeholder="이곳에 대본을 입력하세요. 장면 순서가 뒤섞여도 자동으로 정렬됩니다."></textarea>
            <div id="sp-cards"></div>
          </div>
          <!-- 이미지 섹션 -->
          <div class="sp-section">
            <!-- 기존 이미지 섹션 (V1) -->
            <div class="sp-section-head">
              <div class="sp-section-title">이미지 (JSON 불러오기)</div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-left: auto;">
                  <button id="sp-import-prompt-json" class="sp-btn sp-btn-sm sp-blue">JSON 불러오기</button>
                  <input type="file" id="sp-prompt-json-file-input" accept=".json" style="display:none;" />
                  <div class="sp-rem">
                    <input id="sp-rem-prompt" type="text" placeholder="삭제할 단어" />
                    <button id="sp-rem-prompt-add" class="sp-btn sp-btn-sm sp-red">제거</button>
                    <button id="sp-rem-prompt-reset" class="sp-btn sp-btn-sm sp-gray">복구</button>
                  </div>
              </div>
            </div>
            <div id="sp-prompt-list"></div>
            
            <!-- [V2에서 추가됨] 새로운 이미지 섹션 (V2) -->
            <div style="margin-top: 24px; border-top: 2px solid var(--border); padding-top: 16px;">
                <div class="sp-section-head">
                  <div class="sp-section-title">이미지 프롬프트 (텍스트 기반)</div>
                  <div class="sp-rem">
                    <input id="sp-rem-prompt-v2" type="text" placeholder="삭제할 단어" />
                    <button id="sp-rem-prompt-add-v2" class="sp-btn sp-btn-sm sp-red">제거</button>
                    <button id="sp-rem-prompt-reset-v2" class="sp-btn sp-btn-sm sp-gray">복구</button>
                  </div>
                </div>
                <textarea id="sp-prompt-input-v2" class="sp-textarea-v2" placeholder="이곳에 프롬프트를 입력하세요... (예: '주인공: ...', '장면 1: ...')"></textarea>
                <div class="sp-table-wrap">
                  <table class="sp">
                    <thead>
                      <tr>
                        <th>장면</th>
                        <th>이미지 프롬프트</th>
                        <th style="text-align:right;">복사</th>
                      </tr>
                    </thead>
                    <tbody id="sp-tbody-v2"></tbody>
                  </table>
                </div>
            </div>
            
          </div>
        </div>
      </div>
    `;
    
    const recomputeAll = () => { 
      renderCards(currentScriptContent); 
      renderPromptListFromJsonData(currentPromptData);
      renderPromptTableV2(); // V2 렌더링 함수 호출
    };

    // --- 이벤트 리스너: 대본 ---
    $('#sp-script-input')?.addEventListener('input', debounce(() => {
      currentScriptContent = $('#sp-script-input').value;
      renderCards(currentScriptContent);
    }, 400));

    $('#sp-rem-script-add')?.addEventListener('click', () => { const w = ($('#sp-rem-script')?.value || '').trim(); if (w && !REMOVE_WORDS_SCRIPT.includes(w)) REMOVE_WORDS_SCRIPT.push(w); $('#sp-rem-script').value = ''; renderCards(currentScriptContent); });
    $('#sp-rem-script')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#sp-rem-script-add').click(); } });
    $('#sp-rem-script-reset')?.addEventListener('click', () => { REMOVE_WORDS_SCRIPT = []; renderCards(currentScriptContent); });

    // --- 이벤트 리스너: 이미지 (V1) ---
    $('#sp-rem-prompt-add')?.addEventListener('click', () => { const w = ($('#sp-rem-prompt')?.value || '').trim(); if (w && !REMOVE_WORDS_PROMPT.includes(w)) REMOVE_WORDS_PROMPT.push(w); $('#sp-rem-prompt').value = ''; renderPromptListFromJsonData(currentPromptData); });
    $('#sp-rem-prompt')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#sp-rem-prompt-add').click(); } });
    $('#sp-rem-prompt-reset')?.addEventListener('click', () => { REMOVE_WORDS_PROMPT = []; renderPromptListFromJsonData(currentPromptData); });
    
    $('#sp-import-prompt-json')?.addEventListener('click', () => { $('#sp-prompt-json-file-input')?.click(); });
    $('#sp-prompt-json-file-input')?.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          renderPromptListFromJsonData(data);
          toast('프롬프트 JSON 파일을 성공적으로 불러왔습니다.', 'success');
        } catch (error) { toast('유효하지 않은 JSON 파일입니다.', 'error'); } 
        finally { event.target.value = ''; }
      };
      reader.onerror = () => { toast('파일을 읽는 데 실패했습니다.', 'error'); event.target.value = ''; };
      reader.readAsText(file, 'UTF-8');
    });

    // --- [V2에서 추가됨] 이벤트 리스너: 이미지 (V2) ---
    $('#sp-prompt-input-v2')?.addEventListener('input', debounce(() => {
        currentPromptV2Text = $('#sp-prompt-input-v2').value;
        renderPromptTableV2();
    }, 400));
    $('#sp-rem-prompt-add-v2')?.addEventListener('click', () => { const w = ($('#sp-rem-prompt-v2')?.value || '').trim(); if (w && !REMOVE_WORDS_PROMPT.includes(w)) REMOVE_WORDS_PROMPT.push(w); $('#sp-rem-prompt-v2').value = ''; renderPromptTableV2(); });
    $('#sp-rem-prompt-v2')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#sp-rem-prompt-add-v2').click(); } });
    $('#sp-rem-prompt-reset-v2')?.addEventListener('click', () => { REMOVE_WORDS_PROMPT = []; renderPromptTableV2(); });


    // --- 이벤트 리스너: 공통 액션 ---
    $('#sp-clear')?.addEventListener('click', () => {
      if (confirm('정말 모든 내용을 지우시겠습니까?')) {
        currentScriptContent = '';
        currentPromptData = null;
        currentPromptV2Text = ''; // V2 데이터 초기화
        $('#sp-script-input').value = '';
        $('#sp-prompt-input-v2').value = ''; // V2 입력창 초기화
        recomputeAll();
        toast('모두 지웠습니다.', 'success');
      }
    });
    
    $('#sp-save')?.addEventListener('click', async () => {
      const defaultName = `초안 ${todayStr()} ${new Date().toTimeString().slice(0,5)}`;
      const name = window.prompt('저장할 초안의 이름을 입력하세요.', defaultName);
      if (name === null) { toast('저장이 취소되었습니다.', 'info'); return; }
      const finalName = name.trim();
      if (!finalName) { toast('초안 이름은 비워둘 수 없습니다.', 'warning'); return; }
      
      // [V2에서 추가됨] 저장할 데이터에 promptV2 추가
      const draft = { 
        name: finalName, 
        data: { 
          script: currentScriptContent, 
          prompt: currentPromptData,
          promptV2: currentPromptV2Text,
        }, 
        createdAt: new Date(), 
        updatedAt: new Date() 
      };
      
      try { await draftsPut(draft); toast(`'${finalName}'(으)로 저장했습니다.`, 'success'); } 
      catch(e) { console.error('Draft save failed', e); toast('저장에 실패했습니다.', 'error'); }
    });

    $('#sp-load')?.addEventListener('click', showDraftsModal);
    
    recomputeAll();
  }

  // ============================ 초기화 ============================
  window.initializeSceneParser = function () { buildLayout('#yt-tab-script'); };
})();

export function initScript() {
  if (typeof window.initializeSceneParser === 'function') {
    window.initializeSceneParser();
  } else {
    document.addEventListener('DOMContentLoaded', () => window.initializeSceneParser?.(), { once: true });
  }
}