/**
 * scene-parser.js — 단일 입력(대본창) 기반 파서 & UI (요청 사양 반영)
 *
 * [범위 규칙]
 *  - 대본(script)  : "장면 1"(또는 [장면 1], [장면 001] 등) ~ "## 🎨 이미지 프롬프트" 바로 위 줄
 *  - 이미지 프롬프트: "## 🎨 이미지 프롬프트" 라인 포함 ~ "총 장면 수:" 바로 위 줄
 *
 * [추가 파싱 규칙]
 *  - 줄의 첫 글자가 '#' 인 라인은 삭제하고, 그 자리는 "공백 1줄"로 유지(전체적으로는 연속 공백 1줄로 압축)
 *
 * [기능/디자인]
 *  - 상단: 단일 입력창(대본창, 고정높이 + 스크롤)
 *  - 하단: 2분할(좌=카드 무제한 세로 스택, 우=이미지 프롬프트 결과 표)
 *  - 카드 분할: 문장 경계 기준 10,000자 근처로 무제한 분할, 시작 지점은 "초반 45초 훅" → [장면1] → 텍스트 시작
 *  - 복사 버튼: 빨강↔초록 토글
 */

(function () {
  'use strict';

  /* =========================================================
   * 기본 상수/유틸
   * ======================================================= */
  const READ_SPEED_CPM = 360;   // 분당 360자
  const CARD_LIMIT     = 10000; // 카드 당 목표 글자수
  const INPUT_H        = 480;   // 대본창 높이
  const CARD_H         = 220;   // 카드 본문 높이

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

  const downloadFile = (filename, data, mime='text/plain;charset=utf-8') => {
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

  /* =========================================================
   * 복사 버튼(빨강↔초록) 스타일/동작
   * ======================================================= */
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
      btn.classList.toggle('sp-btn-red');
      btn.classList.toggle('sp-btn-green');
    });
  }

  /* =========================================================
   * 범위 계산(대본/이미지프롬프트)
   *  - 범위를 먼저 계산한 뒤, 각 범위에 '# 시작 줄 삭제 + 공백 압축' 적용
   * ======================================================= */

  // 라인 시작 인덱스
  const lineStartAt = (text, idx) => (idx <= 0 ? 0 : text.lastIndexOf('\n', idx-1)+1);
  // 다음 줄 시작 인덱스(= 현 라인의 끝+개행까지)
  const lineEndAt = (text, idx) => {
    const nl = text.indexOf('\n', idx);
    return nl === -1 ? text.length : (nl + 1);
  };

  // "장면 1" 시작 위치 찾기(여러 표기 허용)
  function findScene1Index(text) {
    const candidates = [];

    // [장면 1], [장면 001], [장면1], [장면001], 뒤가 ] 또는 :
    const reBracket = /\[\s*장면\s*0*1\s*(?:\]|\:)/i;
    const m1 = reBracket.exec(text);
    if (m1) candidates.push(m1.index);

    // 라인 어디든 "장면 1" (공백/0패딩 허용)
    const rePlain = /장면\s*0*1\b/i;
    const m2 = rePlain.exec(text);
    if (m2) candidates.push(m2.index);

    if (!candidates.length) return 0;
    return Math.min(...candidates);
  }

  // "^## 🎨 이미지 프롬프트" 헤더 라인 시작/끝 찾기
  function findImageHeading(text) {
    const re = /^[ \t]*##[ \t]*🎨[ \t]*이미지[ \t]*프롬프트.*$/m;
    const m  = re.exec(text);
    if (!m) return null;
    const start = lineStartAt(text, m.index);        // 헤더 라인 시작
    const end   = lineEndAt(text, m.index);          // 헤더 라인 끝(개행 포함)
    return { start, end };
  }

  // "총 장면 수:" 라인 시작 찾기 (헤더 이후에서)
  function findTotalScenesLine(text, fromIdx) {
    const slice = text.slice(fromIdx);
    const re = /^.*총[ \t]*장면[ \t]*수[ \t]*:.*$/m;
    const m  = re.exec(slice);
    if (!m) return null;
    // 전체 텍스트 기준 라인 시작
    const absIdx = fromIdx + m.index;
    const lineStart = lineStartAt(text, absIdx);
    return { lineStart };
  }

  // 요청한 범위에 맞춰 script/prompt 세그먼트 산출
  function pickSegments(raw) {
    const sceneStart   = findScene1Index(raw);              // "장면 1" 시작
    const imgHeading   = findImageHeading(raw);             // "## 🎨 이미지 프롬프트" 라인
    const imgStartLine = imgHeading ? imgHeading.start : raw.length;

    // Script: sceneStart ~ (이미지 헤더 '바로 위 줄') → 헤더 라인 시작 직전까지
    const scriptSeg = raw.slice(sceneStart, imgStartLine);

    // Prompt: (이미지 헤더 라인 포함) ~ ("총 장면 수:" '바로 위 줄'까지)
    let promptSeg = '';
    if (imgHeading) {
      const totalLine = findTotalScenesLine(raw, imgHeading.end);
      const endIdx = totalLine ? totalLine.lineStart : raw.length;
      promptSeg = raw.slice(imgHeading.start, endIdx);
    }

    return { scriptSeg, promptSeg };
  }

  /* =========================================================
   * '# 시작 줄 삭제 + 1줄 공백 유지' 및 공백 압축
   * ======================================================= */
  function removeHashHeadingLinesKeepGap(text) {
    const lines = String(text||'').replace(/\r\n/g,'\n').split('\n');
    const out = [];
    for (const ln of lines) {
      if (/^\s*#/.test(ln)) {
        if (out.length===0 || out[out.length-1] !== '') out.push('');
      } else {
        out.push(ln);
      }
    }
    // 연속 공백은 1줄로, 앞뒤 과도한 공백 제거
    return out.join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '');
  }

  /* =========================================================
   * 기존 전처리/블록/프롬프트 추출 로직(유지)
   *   - 전처리에서 [장면n:] → [장면 nnn], [장면 n] → [장면 nnn]
   *   - "## n장." 라인 제거(빈 줄 1회 유지)
   * ======================================================= */
  function preprocessScriptTextForBlocks(text) {
    if (!text) return '';

    let t = String(text);

    // [장면n: ...] → [장면 nnn]
    t = t.replace(/\[\s*장면\s*(\d{1,3})\s*:[^\]\n]*\]/gi, (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    t = t.replace(/\[\s*장면\s*(\d{1,3})\s*:[^\n]*/gi,    (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    // [장면 n] → [장면 nnn]
    t = t.replace(/\[\s*장면\s*(\d{1,3})\s*\]/gi,         (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);

    // "## n장." 으로 시작하는 줄 삭제(빈 줄 1회 유지)
    const lines = t.replace(/\r\n/g,'\n').split('\n');
    const out = [];
    for (const ln of lines) {
      if (/^##\s*\d+\s*장\./i.test(ln)) {
        if (out.length===0 || out[out.length-1] !== '') out.push('');
      } else out.push(ln);
    }
    return out.join('\n').replace(/\n{3,}/g,'\n\n');
  }

  // [장면 nnn] 블록 분리(없으면 하나의 블록으로)
  function parseSceneBlocks(text) {
    const t = preprocessScriptTextForBlocks(text||'');
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

  // 따옴표 구문 추출 & 선택 규칙
  function getQuotedSegments(text, startIndex = 0) {
    const src = String(text || '');
    const segments = [];
    const patterns = [
      /"([^"]+)"/g,
      /'([^']+)'/g,
      /“([^”]+)”/g,
      /‘([^’]+)’/g,
      /`([^`]+)`/g
    ];
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
    const src = String(blockText || '');
    const labelIdx = src.search(/이미지\s*프(?:롬|름)프트\s*:/i);
    const quoted = getQuotedSegments(src, 0);
    if (!quoted.length) return '';
    if (labelIdx >= 0) {
      const after = quoted.find(q => q.start >= labelIdx);
      if (after) return after.content.trim();
      const tailLine = src.slice(labelIdx).split('\n')[0].replace(/^[^:]*:/, '').trim();
      if (tailLine) return tailLine.replace(/^["'“‘`]|["'”’`]$/g,'').trim();
    }
    return quoted.sort((a,b)=>b.len-a.len)[0].content.trim();
  }

  /* =========================================================
   * 카드 분할(문장 경계, 무제한)
   *  - 시작 지점: "초반 45초 훅" → 첫 [장면1] → 0
   * ======================================================= */
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
    const TRAIL = '’”"\'\\)］〕〉》」『』）」】]';
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
    const cleanedNoHash = removeHashHeadingLinesKeepGap(scriptRaw||'');
    // 블록 표준화(장면 라벨 등)
    const cleaned = preprocessScriptTextForBlocks(cleanedNoHash);
    const start   = startIndexForCards(cleaned);
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

  /* =========================================================
   * 레이아웃: 상단 대본창 + 하단 2분할
   * ======================================================= */
  function ensureLayoutStyles() {
    if (document.getElementById('sp-layout-style')) return;
    const st = document.createElement('style');
    st.id = 'sp-layout-style';
    st.textContent = `
      #section-scene-parser .scene-parser-content {
        display: block !important;   /* 위→아래 흐름 보장 */
        height: auto !important;
      }
      #sp-top-input { margin-bottom: 16px; }
      #sp-top-input label { font-weight: 800; margin-bottom: 8px; display: inline-block; color: var(--text); }
      #scene-input {
        width: 100%;
        height: ${INPUT_H}px;
        resize: none !important;
        overflow-y: auto !important;
        padding: 16px;
        border-radius: 12px;
        border: 2px solid var(--border);
        background: var(--card);
        color: var(--text);
        line-height: 1.6;
        font-size: 14px;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      #sp-bottom-grid {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 24px;
        align-items: start;
        margin-top: 12px;
      }
      #sp-cards { display: flex; flex-direction: column; gap: 12px; }
      .sp-card {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--glass-bg);
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
      @media (max-width: 900px) { #sp-bottom-grid { grid-template-columns: 1fr; } }
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
    const tableWrap = oldOutputArea ? oldOutputArea.querySelector('.table-wrap') : null;

    // 상단: 대본창
    const topInput = document.createElement('div');
    topInput.id = 'sp-top-input';
    const label = document.createElement('label');
    label.setAttribute('for','scene-input');
    label.textContent = '대본창';
    topInput.appendChild(label);

    const sceneInput = $('#scene-input', oldInputArea || document);
    if (sceneInput) {
      sceneInput.style.overflow = 'auto';
      sceneInput.style.resize   = 'none';
      sceneInput.style.height   = INPUT_H + 'px';
      topInput.appendChild(sceneInput);
    }

    // 하단: 2분할
    const bottomGrid = document.createElement('div');
    bottomGrid.id = 'sp-bottom-grid';

    const leftCards = document.createElement('div');
    leftCards.id = 'sp-cards';

    const rightPanel = document.createElement('div');
    if (tableWrap) rightPanel.appendChild(tableWrap);
    else if (oldOutputArea) rightPanel.appendChild(oldOutputArea);

    bottomGrid.appendChild(leftCards);
    bottomGrid.appendChild(rightPanel);

    // 교체
    oldContent.innerHTML = '';
    oldContent.appendChild(topInput);
    oldContent.appendChild(bottomGrid);
  }

  /* =========================================================
   * 렌더링
   * ======================================================= */

  // 우측 표: 이미지 프롬프트 범위에서 블록/프롬프트 추출
  function renderPromptTableFromInput() {
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

    const input = $('#scene-input');
    const raw   = input ? (input.value || '') : '';
    const { promptSeg } = pickSegments(raw);
    const promptClean   = removeHashHeadingLinesKeepGap(promptSeg);
    const blocks        = parseSceneBlocks(promptClean);

    const rows = blocks.map(({label, body}) => ({ label, prompt: extractPromptFromBlock(body) }))
                       .filter(r => (r.prompt||'').trim().length);

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="empty" style="color: var(--muted); text-align:center; padding: 28px;">이미지 프롬프트 범위에서 유효한 프롬프트를 찾지 못했습니다.</td></tr>`;
      return;
    }

    const frag = document.createDocumentFragment();
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

  // 좌측 카드: 대본 범위에서 문장경계 분할(무제한)
  function renderCardsFromInput() {
    const container = document.getElementById('sp-cards');
    if (!container) return;
    container.innerHTML = '';

    const input = $('#scene-input');
    const raw   = input ? (input.value || '') : '';
    const { scriptSeg } = pickSegments(raw);

    const chunks = splitCardsUnlimitedFromScript(scriptSeg);

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

  /* =========================================================
   * 날짜 UI (유지)
   * ======================================================= */
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

  /* =========================================================
   * 초기화
   * ======================================================= */
  function initializeSceneParser() {
    if (window._sceneParserInitialized) return;
    window._sceneParserInitialized = true;

    ensureLayoutStyles();
    rebuildSceneLayout();
    restoreDateUI();

    const input   = $('#scene-input');
    const btnSave = $('#scene-save');
    const btnClear= $('#scene-clear');

    const recomputeAll = () => {
      renderCardsFromInput();       // 대본 범위 → 카드 무제한
      renderPromptTableFromInput(); // 이미지 프롬프트 범위 → 표
    };

    if (input) {
      input.addEventListener('input', debounce(recomputeAll, 120));
      input.addEventListener('paste', () => setTimeout(recomputeAll, 0));
    }
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const raw = input ? (input.value||'') : '';
        const { promptSeg } = pickSegments(raw);
        const clean = removeHashHeadingLinesKeepGap(promptSeg);
        const blocks = parseSceneBlocks(clean);
        const rows = blocks.map(({label, body}) => ({ label, prompt: extractPromptFromBlock(body) }))
                           .filter(r => (r.prompt||'').trim().length);
        if (!rows.length) { showToast('저장할 프롬프트가 없습니다.', 'warning'); return; }
        const lines = ['장면\t이미지 프롬프트', ...rows.map(r => `${r.label}\t${(r.prompt||'').replace(/\t/g,' ')}`)];
        downloadFile(`${today()}_scene-prompts.tsv`, lines.join('\n'), 'text/tab-separated-values;charset=utf-8');
        showToast('프롬프트 목록을 저장했습니다. (TSV)', 'success');
      });
    }
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (input) input.value = '';
        recomputeAll();
      });
    }

    recomputeAll();
  }

  // 간단한 디바운스
  function debounce(fn, ms) {
    let t=null;
    return function(...args){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), ms); };
  }

  // 전역
  window.initializeSceneParser = initializeSceneParser;

  // DOM 상태에 따라 초기화
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
