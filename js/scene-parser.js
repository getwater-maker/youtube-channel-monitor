/**
 * scene-parser.js — 2섹션(좌=대화, 우=이미지프롬프트) 레이아웃 + JSON 저장
 *
 * 섹션 구성
 *  - 좌측 "대화 섹션": 대본 입력창 + 카드(무제한)
 *  - 우측 "이미지 프롬프트 섹션": 프롬프트 입력창 + 표
 *
 * 파싱 규칙(공통)
 *  - 줄 시작이 '#' 인 줄 삭제
 *  - 하이픈만 있는 구분선(---, ---- …) 삭제
 *  - 위 삭제로 생긴 빈 줄은 1줄만 유지
 *  - 카드 분할은 문장 경계 기준으로 무제한
 *  - 작은따옴표(')는 인용부호로 취급하지 않음 (woman's 보호)
 *
 * 저장(JSON)
 * {
 *   version: 1,
 *   exported_at: "YYYY-MM-DD",
 *   count: N,
 *   items: [{ id:"001", prompt:"...", suggested_filenames:["001.jpg","001.png"] }, ...]
 * }
 */

(function () {
  'use strict';

  /* ===== 설정 ===== */
  const READ_SPEED_CPM = 360;
  const CARD_LIMIT     = 10000;
  const INPUT_H        = 360;  // 두 입력창 동일 높이
  const CARD_H         = 220;

  /* ===== 유틸 ===== */
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const pad2 = n => String(n).padStart(2,'0');
  const pad3 = n => String(n).padStart(3,'0');

  const fmtDuration = (chars) => {
    const s = Math.floor((chars / READ_SPEED_CPM) * 60);
    return `[ ${pad2(Math.floor(s/3600))}시 ${pad2(Math.floor((s%3600)/60))}분 ${pad2(s%60)}초 ]`;
  };
  const today = () => {
    const d = new Date();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };
  const downloadFile = (filename, data, mime='application/json;charset=utf-8') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  };
  const showToast = (msg, type) => {
    try { if (typeof window.toast === 'function') return window.toast(msg, type||'info'); } catch(_) {}
    console.log('[Toast]', type||'info', msg);
  };

  /* ===== 복사 버튼 ===== */
  function ensureCopyStyles() {
    if (document.getElementById('sp-copy-style')) return;
    const st = document.createElement('style');
    st.id = 'sp-copy-style';
    st.textContent = `
      .sp-btn-copy { padding:6px 12px; border-radius:8px; font-weight:700; cursor:pointer; border:1px solid transparent; }
      .sp-btn-red   { background:#c4302b; border-color:#c4302b; color:#fff; }
      .sp-btn-green { background:#16a34a; border-color:#16a34a; color:#fff; }
    `;
    document.head.appendChild(st);
  }
  function wireCopyToggle(btn, getText) {
    ensureCopyStyles();
    btn.classList.add('sp-btn-copy','sp-btn-red');
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(typeof getText==='function' ? (getText()||'') : ''); } catch {}
      btn.classList.toggle('sp-btn-red'); btn.classList.toggle('sp-btn-green');
    });
  }

  /* ===== 정리/보조 ===== */
  function sanitizeLines(text) {
    const lines = String(text||'').replace(/\r\n/g,'\n').split('\n');
    const out = [];
    for (const ln of lines) {
      if (/^\s*#/.test(ln) || /^\s*-{3,}\s*$/.test(ln)) {
        if (out.length===0 || out[out.length-1] !== '') out.push('');
      } else out.push(ln);
    }
    return out.join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '');
  }
  function clipTextBeforeImagePrompt(fullText) {
    const t = String(fullText || '');
    const re = /^[ \t]*##[ \t]*🎨[ \t]*이미지[ \t]*프롬프트.*$/m;
    const m  = re.exec(t);
    if (m) return t.slice(0, m.index);
    return t;
  }
  function normalizeForSceneBlocks(text) {
    if (!text) return '';
    let t = String(text);
    t = t.replace(/\[\s*장면\s*(\d{1,3})\s*:[^\]\n]*\]/gi, (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    t = t.replace(/\[\s*장면\s*(\d{1,3})\s*:[^\n]*/gi,    (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    t = t.replace(/\[\s*장면\s*(\d{1,3})\s*\]/gi,         (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    const lines = t.replace(/\r\n/g,'\n').split('\n');
    const out = [];
    for (const ln of lines) {
      if (/^##\s*\d+\s*장\./i.test(ln)) {
        if (out.length===0 || out[out.length-1] !== '') out.push('');
      } else out.push(ln);
    }
    return out.join('\n').replace(/\n{3,}/g,'\n\n');
  }

  /* ===== 씬 블록 / 프롬프트 추출 ===== */
  function parseSceneBlocks(text) {
    const t = normalizeForSceneBlocks(text||'');
    const lines = t.replace(/\r\n/g,'\n').split('\n');
    const headerRe = /\[\s*장면\s*(\d{1,3})\s*\]/i;

    let cur=null, started=false;
    const blocks=[];
    for (const ln of lines) {
      const m = ln.match(headerRe);
      if (m) {
        started = true;
        if (cur) blocks.push(cur);
        cur = { label:`장면 ${pad3(parseInt(m[1],10))}`, body:[] };
        const suffix = ln.slice(ln.indexOf(m[0])+m[0].length).trim();
        if (suffix) cur.body.push(suffix);
      } else if (started) {
        cur.body.push(ln);
      }
    }
    if (cur) blocks.push(cur);
    if (!blocks.length && (t || '').trim()) {
      blocks.push({ label:'-', body: t.split('\n') });
    }
    return blocks.map(b => ({ label:b.label, body:(Array.isArray(b.body)?b.body.join('\n'):b.body).trim() }));
  }

  // 작은따옴표(') 제외 — 인용부호: " ” `
  function getQuotedSegments(text, startIndex = 0) {
    const src = String(text || '');
    const segments = [];
    const patterns = [/\"([^"]+)\"/g, /“([^”]+)”/g, /`([^`]+)`/g];
    for (const re of patterns) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(src)) !== null) {
        const content = m[1]; const start = m.index; const end = re.lastIndex;
        if (end > startIndex) segments.push({ content, start, end, len: content.length });
      }
    }
    segments.sort((a,b)=>a.start-b.start);
    return segments;
  }
  function extractPromptFromBlock(blockText) {
    let src = String(blockText || '').trim();
    src = src.replace(/^\*{1,3}\s*/, '').trim();
    const labelIdx = src.search(/이미지\s*프(?:롬|름)프트\s*:/i);
    if (labelIdx >= 0) {
      const tail = src.slice(labelIdx).replace(/^[^:]*:/, '').trim();
      const quotedAfter = getQuotedSegments(tail, 0);
      if (quotedAfter.length) return quotedAfter[0].content.trim();
      return tail;
    }
    const quoted = getQuotedSegments(src, 0);
    if (quoted.length) return quoted.sort((a,b)=>b.len-a.len)[0].content.trim();
    return src;
  }

  /* ===== 카드 분할 ===== */
  function startIndexForCards(cleanedText) {
    let i = cleanedText.search(/초반\s*45\s*초\s*훅/i);
    if (i === -1) {
      const j = cleanedText.search(/\[\s*장면\s*0*1\s*(?:\]|:)/i);
      i = (j === -1) ? 0 : j;
    }
    return i < 0 ? 0 : i;
  }
  function sentenceEndPositions(str) {
    const ends = [];
    const END_PUNCT = '.!?！？。…';
    const TRAIL = '’”"\'\\)］〕〉》」『』」】]';
    for (let i=0;i<str.length;i++) {
      const ch = str[i];
      if (END_PUNCT.includes(ch)) {
        let j = i + 1;
        while (j < str.length && TRAIL.includes(str[j])) j++;
        ends.push(j);
      }
    }
    if (ends.length === 0 || ends[ends.length-1] !== str.length) ends.push(str.length);
    return ends;
  }
  function cutAtSentenceBoundary(str, limit) {
    const ends = sentenceEndPositions(str);
    let cut = ends[0];
    for (let k=0;k<ends.length;k++) {
      if (ends[k] <= limit) cut = ends[k];
      else break;
    }
    return { head: str.slice(0, cut), tail: str.slice(cut) };
  }
  function splitCardsUnlimitedFromScript(scriptRaw) {
    const clipped = clipTextBeforeImagePrompt(scriptRaw||'');
    const cleanedNoHdr = sanitizeLines(clipped);
    const cleaned = normalizeForSceneBlocks(cleanedNoHdr);
    const start = startIndexForCards(cleaned);
    let rest = cleaned.slice(start);

    const chunks = [];
    while (rest && rest.trim().length) {
      const { head, tail } = cutAtSentenceBoundary(rest, CARD_LIMIT);
      chunks.push(head.trim());
      rest = tail;
      if (!rest || !rest.trim()) break;
    }
    return chunks;
  }

  /* ===== 레이아웃: 2 섹션(좌/우) ===== */
  function ensureLayoutStyles() {
    if (document.getElementById('sp-layout-style')) return;
    const st = document.createElement('style');
    st.id = 'sp-layout-style';
    st.textContent = `
      #section-scene-parser .scene-parser-content { display:block !important; height:auto !important; }

      /* 전체 2섹션 좌우 */
      #sp-two-sections {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        align-items: start;
        margin-bottom: 12px;
      }
      .sp-section {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--glass-bg);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .sp-section-title { font-weight: 900; color: var(--text); }

      /* 입력 블록(두 섹션 동일 높이) */
      .sp-input-wrap { display:flex; flex-direction:column; gap:6px; }
      .sp-input-wrap label { font-weight: 700; color: var(--text); }
      .sp-input-wrap textarea {
        height: ${INPUT_H}px;
        min-height: ${INPUT_H}px;
        max-height: ${INPUT_H}px;
        resize: none !important;
        overflow-y: auto !important;
        padding: 16px;
        border-radius: 10px;
        border: 2px solid var(--border);
        background: var(--card);
        color: var(--text);
        line-height: 1.6;
        font-size: 14px;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }

      /* 좌측 카드 리스트 */
      #sp-cards { display:flex; flex-direction:column; gap:12px; }
      .sp-card {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--panel, rgba(255,255,255,.02));
        padding: 12px;
        display: flex; flex-direction: column; gap: 8px;
      }
      .sp-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .sp-card-title { font-weight: 700; color: var(--brand); }
      .sp-card-pre {
        margin: 0; padding: 0;
        white-space: pre-wrap; word-break: break-word;
        line-height: 1.6; font-family: ui-monospace, SFMono-Regular, monospace;
        max-height: ${CARD_H}px; overflow-y: auto;
      }

      /* 하단 표(우측 섹션 안) */
      .sp-table-wrap { width:100%; }

      @media (max-width: 1000px) {
        #sp-two-sections { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(st);
  }

  function rebuildSceneLayout() {
    const section = document.getElementById('section-scene-parser');
    if (!section) return;
    const oldContent = section.querySelector('.scene-parser-content');
    if (!oldContent) return;

    const oldInputArea  = oldContent.querySelector('.scene-input-area');
    const oldOutputArea = oldContent.querySelector('.scene-output-area');
    const tableWrap = oldOutputArea ? oldOutputArea.querySelector('.table-wrap') : null; // ← 기존 표 컨테이너

    // 최상위: 두 섹션
    const two = document.createElement('div'); two.id = 'sp-two-sections';

    /* 좌 — 대화 섹션 (타이틀 표시하지 않음) */
    const left = document.createElement('div'); left.className = 'sp-section';
    const leftInputWrap = document.createElement('div'); leftInputWrap.className = 'sp-input-wrap';
    const lblScene = document.createElement('label'); lblScene.setAttribute('for','scene-input'); lblScene.textContent = '대본 입력창';
    const sceneInput = $('#scene-input', oldInputArea || document);
    if (sceneInput) { sceneInput.style.resize='none'; sceneInput.style.overflow='auto'; }
    leftInputWrap.appendChild(lblScene);
    if (sceneInput) leftInputWrap.appendChild(sceneInput);
    const leftCards = document.createElement('div'); leftCards.id='sp-cards';
    left.appendChild(leftInputWrap);
    left.appendChild(leftCards);

    /* 우 — 이미지 프롬프트 섹션 */
    const right = document.createElement('div'); right.className = 'sp-section';
    const rightTitle = document.createElement('div'); rightTitle.className = 'sp-section-title';
    rightTitle.textContent = '이미지 프롬프트 섹션';
    const rightInputWrap = document.createElement('div'); rightInputWrap.className = 'sp-input-wrap';
    const lblPrompt = document.createElement('label'); lblPrompt.setAttribute('for','prompt-input'); 
    const promptInput = document.createElement('textarea'); promptInput.id='prompt-input';
    promptInput.placeholder = '예: [장면 001]\\n이미지 프롬프트: "..."';
    rightInputWrap.appendChild(lblPrompt);
    rightInputWrap.appendChild(promptInput);
    const rightTableWrap = document.createElement('div'); rightTableWrap.className = 'sp-table-wrap';
    if (tableWrap) rightTableWrap.appendChild(tableWrap);
    else if (oldOutputArea) rightTableWrap.appendChild(oldOutputArea);
    right.appendChild(rightTitle);
    right.appendChild(rightInputWrap);
    right.appendChild(rightTableWrap);

    // 조립
    two.appendChild(left);
    two.appendChild(right);

    // 교체
    oldContent.innerHTML = '';
    oldContent.appendChild(two);
  }

  /* ===== 주인공 프롬프트 추출 ===== */
  // 우측 입력창(#prompt-input) 안에서
  // "### 👤 주인공 이미지 프롬프트:" 제목 다음 ~ 다음 제목("##" 또는 "###") 전까지를 추출
  function extractProtagonistPrompt(full) {
    const text = String(full || '').replace(/\r\n/g, '\n');
    const lines = text.split('\n');

    let start = -1;
    const headingRe = /^\s*#{2,3}\s*👤?\s*주인공\s*이미지\s*프롬프트\s*:?\s*$/i;
    for (let i = 0; i < lines.length; i++) {
      if (headingRe.test(lines[i])) { start = i + 1; break; }
    }
    if (start === -1) return '';

    let end = lines.length;
    for (let i = start; i < lines.length; i++) {
      if (/^\s*#{2,3}\s+/.test(lines[i])) { end = i; break; }
    }

    const body = lines.slice(start, end)
      .filter(ln => !/^\s*#{2,3}\s+/.test(ln))         // 다른 제목 라인 제거
      .map(ln => ln.replace(/^\*\*(.+?)\*\*$/g, '$1')) // 굵게 마크다운 제거
      .join('\n')
      .trim();

    return body;
  }

  /* ===== 표 렌더링 ===== */
  function renderPromptTable() {
    const tbody = document.getElementById('scene-tbody');
    if (!tbody) return;

    const thead = tbody.closest('table')?.querySelector('thead');
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th class="col-scene"  style="text-align:left; padding:12px; border-bottom:1px solid var(--border); width:160px;">장면</th>
          <th class="col-prompt" style="text-align:left; padding:12px; border-bottom:1px solid var(--border);">이미지 프롬프트</th>
          <th style="text-align:left; padding:12px; border-bottom:1px solid var(--border); width:110px;">복사</th>
        </tr>
      `;
    }

    const promptRaw = ($('#prompt-input')?.value || '');
    const promptClean = sanitizeLines(promptRaw);
    const blocks = parseSceneBlocks(promptClean);

    const rows = blocks.map(({label, body}) => ({ label, prompt: extractPromptFromBlock(body) }))
                       .filter(r => (r.prompt||'').trim().length);

    const frag = document.createDocumentFragment();

    // 1) 헤더 바로 아래 "주인공" 행 추가 (있을 때만)
    const protagonist = extractProtagonistPrompt(promptRaw);
    if (protagonist) {
      const trPro = document.createElement('tr');

      const tdScene = document.createElement('td');
      tdScene.className = 'col-scene';
      tdScene.style.whiteSpace = 'nowrap';
      tdScene.style.padding = '12px';
      tdScene.style.borderBottom = '1px solid var(--border)';
      tdScene.textContent = '주인공';

      const tdPrompt = document.createElement('td');
      tdPrompt.className = 'col-prompt';
      tdPrompt.style.padding = '12px';
      tdPrompt.style.borderBottom = '1px solid var(--border)';
      const divText = document.createElement('div');
      divText.className = 'prompt-text';
      divText.textContent = protagonist;
      tdPrompt.appendChild(divText);

      const tdCopy = document.createElement('td');
      tdCopy.style.padding = '12px';
      tdCopy.style.borderBottom = '1px solid var(--border)';
      const btn = document.createElement('button');
      btn.textContent = '복사';
      wireCopyToggle(btn, () => protagonist);
      tdCopy.appendChild(btn);

      trPro.appendChild(tdScene);
      trPro.appendChild(tdPrompt);
      trPro.appendChild(tdCopy);
      frag.appendChild(trPro);
    }

    // 2) 일반 "장면 001 ..." 행들
    if (!rows.length) {
      const trEmpty = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'empty';
      td.style.color = 'var(--muted)';
      td.style.textAlign = 'center';
      td.style.padding = '28px';
      td.textContent = '이미지 프롬프트 입력창에서 유효한 프롬프트를 찾지 못했습니다.';
      trEmpty.appendChild(td);
      tbody.innerHTML = '';
      // 주인공만 있어도 위에서 frag에 추가되었으니 같이 출력
      if (protagonist) {
        tbody.appendChild(frag);
      } else {
        tbody.appendChild(trEmpty);
      }
      return;
    }

    rows.forEach(({ label, prompt }) => {
      const tr = document.createElement('tr');

      const tdScene = document.createElement('td');
      tdScene.className = 'col-scene';
      tdScene.style.whiteSpace = 'nowrap';
      tdScene.style.padding = '12px';
      tdScene.style.borderBottom = '1px solid var(--border)';
      tdScene.textContent = label;

      const tdPrompt = document.createElement('td');
      tdPrompt.className = 'col-prompt';
      tdPrompt.style.padding = '12px';
      tdPrompt.style.borderBottom = '1px solid var(--border)';
      const divText = document.createElement('div');
      divText.className = 'prompt-text';
      divText.textContent = prompt || '';
      tdPrompt.appendChild(divText);

      const tdCopy = document.createElement('td');
      tdCopy.style.padding = '12px';
      tdCopy.style.borderBottom = '1px solid var(--border)';
      const btn = document.createElement('button');
      btn.textContent = '복사';
      wireCopyToggle(btn, () => prompt || '');
      tdCopy.appendChild(btn);

      tr.appendChild(tdScene);
      tr.appendChild(tdPrompt);
      tr.appendChild(tdCopy);
      frag.appendChild(tr);
    });

    tbody.innerHTML = '';
    tbody.appendChild(frag);
  }

  function renderCards() {
    const container = document.getElementById('sp-cards');
    if (!container) return;
    container.innerHTML = '';

    const raw = ($('#scene-input')?.value || '');
    const chunks = splitCardsUnlimitedFromScript(raw);

    if (!chunks.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '카드로 만들 텍스트가 없습니다. 대본창에 텍스트를 입력해주세요.';
      container.appendChild(empty);
      return;
    }

    chunks.forEach((text, idx) => {
      const n = (text||'').length;

      const card = document.createElement('div');
      card.className = 'sp-card';

      const head = document.createElement('div');
      head.className = 'sp-card-head';

      const title = document.createElement('div');
      title.className = 'sp-card-title';
      title.textContent = `카드 ${String(idx+1)} / ${n.toLocaleString('ko-KR')}자 / ${fmtDuration(n)}`;

      const btn = document.createElement('button');
      btn.textContent = '복사';
      wireCopyToggle(btn, () => text || '');

      const pre = document.createElement('pre');
      pre.className = 'sp-card-pre';
      pre.textContent = text || '';

      head.appendChild(title);
      head.appendChild(btn);
      card.appendChild(head);
      card.appendChild(pre);
      container.appendChild(card);
    });
  }

  /* ===== 저장(JSON) & 기타 ===== */
  function changeDate(dateInput, days) {
    const d = new Date(dateInput.value || today());
    d.setDate(d.getDate() + days);
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    dateInput.value = `${d.getFullYear()}-${mm}-${dd}`;
    dateInput.dispatchEvent(new Event('change'));
  }
  function restoreDateUI() {
    const sec = document.getElementById('section-scene-parser');
    if (!sec) return;
    const actions = sec.querySelector('.section-header .section-actions');
    const date = sec.querySelector('#scene-date');
    if (!actions || !date) return;

    const old = actions.querySelector('.sp-date-wrap'); if (old) old.remove();

    const label = document.createElement('div');
    label.textContent = '업로드 날짜';
    Object.assign(label.style,{ fontWeight:'600', marginRight:'8px', color:'var(--text,#e4e6ea)' });

    const wrap = document.createElement('div');
    wrap.className = 'sp-date-wrap';
    Object.assign(wrap.style,{ display:'inline-flex', alignItems:'center', gap:'6px', marginRight:'8px' });

    date.type = 'date';
    if (!date.value) date.value = today();
    Object.assign(date.style,{
      height:'40px', padding:'8px 12px',
      border:'2px solid var(--border,#2a3443)', borderRadius:'8px',
      background:'var(--panel,#1e2329)', color:'var(--text,#e4e6ea)', fontWeight:'600'
    });

    const col = document.createElement('div');
    Object.assign(col.style,{ display:'flex', flexDirection:'column', gap:'2px' });

    const mk=(t)=>{ const b=document.createElement('button'); b.textContent=t;
      Object.assign(b.style,{
        width:'30px', height:'20px', padding:'0',
        border:'1px solid var(--border,#2a3443)', borderRadius:'4px',
        background:'var(--glass-bg,rgba(255,255,255,.05))',
        color:'var(--text,#e4e6ea)', fontSize:'10px',
        display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'
      }); return b; };
    const up=mk('▲'), dn=mk('▼');
    up.addEventListener('click',()=>changeDate(date,1));
    dn.addEventListener('click',()=>changeDate(date,-1));
    col.appendChild(up); col.appendChild(dn);

    wrap.appendChild(date); wrap.appendChild(col);
    actions.insertBefore(label, actions.firstChild||null);
    actions.insertBefore(wrap, label.nextSibling);
  }

  /* ===== 초기화 ===== */
  function initializeSceneParser() {
    if (window._sceneParserInitialized) return;
    window._sceneParserInitialized = true;

    ensureLayoutStyles();
    rebuildSceneLayout();
    restoreDateUI();

    const sceneInput  = $('#scene-input');
    const promptInput = $('#prompt-input');
    const btnSave     = $('#scene-save');
    const btnClear    = $('#scene-clear');

    const recomputeAll = () => { renderCards(); renderPromptTable(); };

    if (sceneInput) {
      sceneInput.addEventListener('input', debounce(recomputeAll, 120));
      sceneInput.addEventListener('paste', () => setTimeout(recomputeAll, 0));
    }
    if (promptInput) {
      promptInput.addEventListener('input', debounce(recomputeAll, 120));
      promptInput.addEventListener('paste', () => setTimeout(recomputeAll, 0));
    }

    // 저장: 우측 입력창 → JSON
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const promptClean = sanitizeLines($('#prompt-input')?.value || '');
        const blocks = parseSceneBlocks(promptClean);
        const rows = blocks
          .map(({label, body}, i) => {
            const prompt = extractPromptFromBlock(body).trim();
            if (!prompt) return null;
            const m = (label||'').match(/(\d{1,3})/);
            const id = pad3(m ? parseInt(m[1],10) : (i+1));
            return { id, prompt, suggested_filenames: [`${id}.jpg`, `${id}.png`] };
          })
          .filter(Boolean);

        if (!rows.length) { showToast('저장할 프롬프트가 없습니다.', 'warning'); return; }

        const payload = { version:1, exported_at: today(), count: rows.length, items: rows };
        downloadFile(`${today()}_image-prompts.json`, JSON.stringify(payload, null, 2));
        showToast('이미지 프롬프트(JSON) 저장 완료', 'success');
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (sceneInput)  sceneInput.value  = '';
        if (promptInput) promptInput.value = '';
        recomputeAll();
      });
    }

    // 초기 렌더
    recomputeAll();
  }

  function debounce(fn, ms){ let t=null; return function(...args){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), ms); }; }

  window.initializeSceneParser = initializeSceneParser;

  if (document.getElementById('section-scene-parser')) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(() => { try{ initializeSceneParser(); } catch(e){ console.error(e); } }, 0);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        try{ initializeSceneParser(); } catch(e){ console.error(e); }
      });
    }
  }
})();
