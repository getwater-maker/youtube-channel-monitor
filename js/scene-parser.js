/**
 * scene-parser.js — 2섹션(좌=대본, 우=이미지 프롬프트)
 * - 하단 두 영역(카드 / 프롬프트 표) 높이 초기부터 동일
 * - 좌 타이틀: "대본입력창 / 글자수 N / 예상시간 [ hh:mm:ss ]"
 * - 우 타이틀: "이미지 프롬프트 입력창 / 장면 갯수 n"
 * - 줄 시작이 '#' 인 줄 및 '---' 단독 줄 제거(빈 줄 1회 유지)
 * - 이미지 프롬프트 파싱: [장면 N], **[장면 N]**, [장면 N: ...] 모두 인식
 * - "## 👤 주인공 이미지 프롬프트:" 블록을 장면 001 위에 별도 행으로 표시(주인공 | 이미지 프롬프트 | 복사)
 * - 저장(JSON): id=세자리 장면번호, prompt=프롬프트, suggested_filenames=[id.jpg,id.png]
 */

(function () {
  'use strict';

  /* ===== 설정 ===== */
  const READ_SPEED_CPM = 360;    // 분당 글자수(읽기 속도)
  const CARD_LIMIT     = 10000;  // 카드 분할 상한(문장 경계 기준)
  const INPUT_H        = 360;    // 좌/우 입력창 동일 높이(px)
  const CARD_H         = 220;    // 카드 본문 스크롤 높이
  const BOTTOM_BASE_MIN= 260;    // 하단 두 박스의 최소 공통 높이(초기 동기화용)

  /* ===== 유틸 ===== */
  const $  = (sel, root=document) => root.querySelector(sel);
  const pad2 = n => String(n).padStart(2,'0');
  const pad3 = n => String(n).padStart(3,'0');

  const today = () => {
    const d = new Date();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  const fmtHuman = (chars) => {
    const s = Math.floor((chars / READ_SPEED_CPM) * 60);
    return `[ ${pad2(Math.floor(s/3600))}시 ${pad2(Math.floor((s%3600)/60))}분 ${pad2(s%60)}초 ]`;
  };
  const fmtClock = (chars) => {
    const s = Math.floor((chars / READ_SPEED_CPM) * 60);
    return `[ ${pad2(Math.floor(s/3600))}:${pad2(Math.floor((s%3600)/60))}:${pad2(s%60)} ]`;
  };

  const downloadFile = (filename, data, mime='application/json;charset=utf-8') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  };

  /* ===== 날짜 UI ===== */
  function changeDate(dateInput, days){
    const d = new Date(dateInput.value || today());
    d.setDate(d.getDate() + days);
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    dateInput.value = `${d.getFullYear()}-${mm}-${dd}`;
    dateInput.dispatchEvent(new Event('change'));
  }

  function restoreDateUI(){
    const sec = document.getElementById('section-scene-parser');
    if (!sec) return;

    const actions = sec.querySelector('.section-header .section-actions');
    if (!actions) return;

    const prev = actions.querySelector('.sp-date-wrap');
    if (prev) prev.remove();

    const label = document.createElement('div');
    label.textContent = '업로드 날짜';
    Object.assign(label.style, {
      fontWeight: '600',
      marginRight: '8px',
      color: 'var(--text,#e4e6ea)'
    });

    let date = sec.querySelector('#scene-date');
    if (!date) {
      date = document.createElement('input');
      date.id = 'scene-date';
    }
    date.type = 'date';
    if (!date.value) date.value = today();
    Object.assign(date.style, {
      height: '40px',
      padding: '8px 12px',
      border: '2px solid var(--border,#2a3443)',
      borderRadius: '8px',
      background: 'var(--panel,#1e2329)',
      color: 'var(--text,#e4e6ea)',
      fontWeight: '600'
    });

    const mkBtn = (t) => {
      const b = document.createElement('button'); b.textContent = t;
      Object.assign(b.style, {
        width: '30px',
        height: '20px',
        padding: '0',
        border: '1px solid var(--border,#2a3443)',
        borderRadius: '4px',
        background: 'var(--glass-bg,rgba(255,255,255,.05))',
        color: 'var(--text,#e4e6ea)',
        fontSize: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
      });
      return b;
    };
    const up = mkBtn('▲'), dn = mkBtn('▼');
    up.addEventListener('click', () => changeDate(date, 1));
    dn.addEventListener('click', () => changeDate(date,-1));

    const col = document.createElement('div');
    Object.assign(col.style, { display:'flex', flexDirection:'column', gap:'2px' });
    col.appendChild(up); col.appendChild(dn);

    const wrap = document.createElement('div');
    wrap.className = 'sp-date-wrap';
    Object.assign(wrap.style, { display:'inline-flex', alignItems:'center', gap:'6px', marginRight:'8px' });
    wrap.appendChild(date); wrap.appendChild(col);

    actions.insertBefore(label, actions.firstChild || null);
    actions.insertBefore(wrap, label.nextSibling);
  }

  /* ===== 텍스트 정리 ===== */
  // 줄 시작이 '#' 인 줄 및 '---' 단독 줄 제거, 빈 줄 1개만 유지
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

  // 대본 입력에서 "## 🎨 이미지 프롬프트" 이전까지만 카드 대상
  function clipBeforeImagePrompt(fullText) {
    const re = /^[ \t]*##[ \t]*🎨[ \t]*이미지[ \t]*프롬프트.*$/m;
    const m  = re.exec(String(fullText || ''));
    return m ? String(fullText).slice(0, m.index) : String(fullText||'');
  }

  // 장면 머리표기 정규화 → [장면 001]
  function normalizeForScenes(text) {
    if (!text) return '';
    let t = String(text);
    // [장면 7: ...] / **[장면 7]** / [장면 7] → [장면 007]
    t = t.replace(/\*{0,3}\s*\[\s*장면\s*(\d{1,3})\s*:[^\]\n]*\]\s*\*{0,3}/gi, (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    t = t.replace(/\*{0,3}\s*\[\s*장면\s*(\d{1,3})\s*\]\s*\*{0,3}/gi,          (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    // "## 1장." 같은 챕터 라인은 제거(빈 줄 유지)
    const lines = t.replace(/\r\n/g,'\n').split('\n');
    const out = [];
    for (const ln of lines) {
      if (/^##\s*\d+\s*장\./i.test(ln)) {
        if (out.length===0 || out[out.length-1] !== '') out.push('');
      } else out.push(ln);
    }
    return out.join('\n').replace(/\n{3,}/g,'\n\n');
  }

  /* ===== 장면 파서 ===== */
  function parseSceneBlocks(text) {
    const t = normalizeForScenes(sanitizeLines(text||''));
    const lines = t.split('\n');
    const headerRe = /\[\s*장면\s*(\d{1,3})\s*\]/i;

    let cur=null, started=false;
    const blocks=[];
    for (const ln of lines) {
      const m = ln.match(headerRe);
      if (m) {
        started = true;
        if (cur) blocks.push(cur);
        cur = { id: pad3(parseInt(m[1],10)), body:[] };
        const suffix = ln.slice(ln.indexOf(m[0])+m[0].length).trim();
        if (suffix) cur.body.push(suffix);
      } else if (started) {
        cur.body.push(ln);
      }
    }
    if (cur) blocks.push(cur);

    return blocks.map(b => ({
      id: b.id,
      text: (Array.isArray(b.body)?b.body.join('\n'):b.body||'').trim().replace(/^\*{1,3}\s*/,'').trim()
    }));
  }

  // 블록에서 프롬프트 추출: "이미지 프롬프트:" 뒤 따옴표 내용 우선, 없으면 전체
  function extractPrompt(blockText) {
    let src = String(blockText || '').trim();
    const idx = src.search(/이미지\s*프(?:롬|름)프트\s*:/i);
    if (idx >= 0) {
      const tail = src.slice(idx).replace(/^[^:]*:/, '').trim();
      const m = tail.match(/"([^"]+)"|“([^”]+)”|`([^`]+)`/);
      if (m) return (m[1]||m[2]||m[3]||'').trim();
      return tail;
    }
    const q = src.match(/"([^"]+)"|“([^”]+)”|`([^`]+)`/);
    if (q) return (q[1]||q[2]||q[3]||'').trim();
    return src;
  }

  /* ===== 주인공 프롬프트 파서 ===== */
  function parseHeroPrompt(raw) {
    if (!raw) return '';
    const txt = String(raw).replace(/\r\n/g, '\n');
    const heroHeader = /^[ \t]*##[ \t]*👤?[ \t]*주인공[ \t]*이미지[ \t]*프롬프트\s*:?\s*$/mi;
    const m = txt.match(heroHeader);
    if (!m) return '';

    // 시작 인덱스 = 헤더 라인의 끝 다음 줄부터
    const start = txt.indexOf(m[0]) + m[0].length;

    // 다음 경계: [장면 N] 헤더 또는 다음 ##/--- 섹션
    const nextScene = txt.slice(start).search(/^\s*\[\s*장면\s*\d{1,3}\s*\]/m);
    const nextHash  = txt.slice(start).search(/^\s*##\s+/m);
    const nextDash  = txt.slice(start).search(/^\s*-{3,}\s*$/m);

    const candidates = [nextScene, nextHash, nextDash].filter(v => v >= 0);
    const offset = candidates.length ? Math.min(...candidates) : -1;
    const end = offset >= 0 ? start + offset : txt.length;

    const body = txt.slice(start, end).trim();
    // 헤더/--- 제거 규칙 적용
    const cleaned = sanitizeLines(body);
    return cleaned.trim();
  }

  /* ===== 카드 분할 ===== */
  function sentenceEnds(str) {
    const ends = [];
    const END = '.!?！？。…';
    const TRAIL = '’”"\'\\)］〕〉》」『』】]';
    for (let i=0;i<str.length;i++) {
      if (END.includes(str[i])) {
        let j = i + 1;
        while (j < str.length && TRAIL.includes(str[j])) j++;
        ends.push(j);
      }
    }
    if (ends.length === 0 || ends[ends.length-1] !== str.length) ends.push(str.length);
    return ends;
  }
  function cutAtBoundary(str, limit) {
    const ends = sentenceEnds(str);
    let cut = ends[0];
    for (let k=0;k<ends.length;k++) {
      if (ends[k] <= limit) cut = ends[k];
      else break;
    }
    return { head: str.slice(0, cut), tail: str.slice(0).slice(cut) };
  }
  function splitCards(scriptRaw) {
    const clipped = clipBeforeImagePrompt(scriptRaw||'');
    const cleaned = normalizeForScenes(sanitizeLines(clipped));
    let rest = cleaned;
    const chunks = [];
    while (rest && rest.trim().length) {
      const { head, tail } = cutAtBoundary(rest, CARD_LIMIT);
      chunks.push(head.trim());
      rest = tail;
      if (!rest || !rest.trim()) break;
    }
    return chunks;
  }

  /* ===== 레이아웃 & 스타일 ===== */
  function ensureStyles() {
    if (document.getElementById('sp-layout-style')) return;
    const st = document.createElement('style');
    st.id = 'sp-layout-style';
    st.textContent = `
      #section-scene-parser .scene-parser-content { display:block !important; height:auto !important; }

      #sp-two-sections {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        align-items: stretch;
      }
      .sp-section {
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--glass-bg);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
      }
      .sp-section-title { font-weight: 900; color: var(--text); }

      .sp-input-wrap { display:flex; flex-direction:column; }
      .sp-input-wrap textarea {
        height:${INPUT_H}px; min-height:${INPUT_H}px; max-height:${INPUT_H}px;
        resize:none !important; overflow-y:auto !important;
        padding:16px; border-radius:10px; border:2px solid var(--border);
        background:var(--card); color:var(--text);
        line-height:1.6; font-size:14px; font-family:ui-sans-serif, system-ui, sans-serif;
      }

      #sp-bottom-left, #sp-bottom-right {
        border: 1px dashed rgba(255,255,255,0.12);
        border-radius: 12px;
        background: rgba(255,255,255,0.03);
        padding: 12px;
        overflow: auto;
        min-height: ${BOTTOM_BASE_MIN}px; /* 초기 동일 높이 */
      }

      #sp-cards { display:flex; flex-direction:column; gap:12px; }
      .sp-card { border:1px solid var(--border); border-radius:12px; background:var(--panel,rgba(255,255,255,.02)); padding:12px; display:flex; flex-direction:column; gap:8px; }
      .sp-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .sp-card-title { font-weight:700; color:var(--brand); }
      .sp-card-pre { margin:0; padding:0; white-space:pre-wrap; word-break:break-word; line-height:1.6; font-family:ui-monospace, SFMono-Regular, monospace; max-height:${CARD_H}px; overflow-y:auto; }

      .sp-table-wrap { width:100%; }

      @media (max-width: 1000px) { #sp-two-sections { grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(st);
  }

  function buildLayout() {
    const section    = document.getElementById('section-scene-parser');
    if (!section) return;
    const oldContent = section.querySelector('.scene-parser-content');
    if (!oldContent) return;

    const oldInputArea  = oldContent.querySelector('.scene-input-area');
    const oldOutputArea = oldContent.querySelector('.scene-output-area');
    const tableWrap = oldOutputArea ? oldOutputArea.querySelector('.table-wrap') : null;

    const two = document.createElement('div'); two.id = 'sp-two-sections';

    // 좌측
    const left = document.createElement('div'); left.className = 'sp-section';
    const leftTitle = document.createElement('div'); leftTitle.className = 'sp-section-title'; leftTitle.id = 'sp-left-title';
    const leftInputWrap = document.createElement('div'); leftInputWrap.className = 'sp-input-wrap';
    const sceneInput = $('#scene-input', oldInputArea || document);
    if (sceneInput) {
      sceneInput.removeAttribute('rows');
      sceneInput.style.height = sceneInput.style.minHeight = sceneInput.style.maxHeight = '';
      sceneInput.style.resize = 'none'; sceneInput.style.overflow = 'auto';
      leftInputWrap.appendChild(sceneInput);
    }
    const bottomLeft = document.createElement('div'); bottomLeft.id = 'sp-bottom-left';
    const leftCards = document.createElement('div'); leftCards.id='sp-cards';
    bottomLeft.appendChild(leftCards);
    left.appendChild(leftTitle);
    left.appendChild(leftInputWrap);
    left.appendChild(bottomLeft);

    // 우측
    const right = document.createElement('div'); right.className = 'sp-section';
    const rightTitle = document.createElement('div'); rightTitle.className = 'sp-section-title'; rightTitle.id = 'sp-right-title';
    const rightInputWrap = document.createElement('div'); rightInputWrap.className = 'sp-input-wrap';
    const promptInput = document.createElement('textarea'); promptInput.id='prompt-input';
    promptInput.placeholder = '예: ## 👤 주인공 이미지 프롬프트: \\n설명...\\n\\n[장면 001] ...';
    rightInputWrap.appendChild(promptInput);
    const bottomRight = document.createElement('div'); bottomRight.id = 'sp-bottom-right';
    const rightTableWrap = document.createElement('div'); rightTableWrap.className = 'sp-table-wrap';
    if (oldOutputArea) rightTableWrap.appendChild(oldOutputArea);
    bottomRight.appendChild(rightTableWrap);
    right.appendChild(rightTitle);
    right.appendChild(rightInputWrap);
    right.appendChild(bottomRight);

    two.appendChild(left);
    two.appendChild(right);
    oldContent.innerHTML = '';
    oldContent.appendChild(two);
  }

  /* ===== 타이틀 갱신 ===== */
  function updateTitles() {
    const leftTitle  = $('#sp-left-title');
    const rightTitle = $('#sp-right-title');
    const sceneInput = $('#scene-input');
    const promptInput= $('#prompt-input');

    if (leftTitle) {
      const src   = sceneInput ? sceneInput.value : '';
      const text  = sanitizeLines(clipBeforeImagePrompt(src));
      const chars = text.length;
      leftTitle.textContent = `대본입력창 / 글자수 ${chars.toLocaleString('ko-KR')} / 예상시간 ${fmtClock(chars)}`;
    }
    if (rightTitle) {
      const blocks = parseSceneBlocks(promptInput ? promptInput.value : '');
      rightTitle.textContent = `이미지 프롬프트 입력창 / 장면 갯수 ${blocks.length}`;
    }
  }

  /* ===== 하단 높이 동기화 ===== */
  function syncBottomHeights() {
    const L = $('#sp-bottom-left');
    const R = $('#sp-bottom-right');
    if (!L || !R) return;

    // 초기 동일 높이 적용
    L.style.minHeight = R.style.minHeight = `${BOTTOM_BASE_MIN}px`;
    L.style.height = R.style.height = 'auto';

    // 내용 기준 최대값으로 맞춤
    const h = Math.max(L.offsetHeight, R.offsetHeight, BOTTOM_BASE_MIN);
    L.style.minHeight = R.style.minHeight = `${h}px`;
  }

  /* ===== 렌더링 ===== */
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
    const rows = parseSceneBlocks(promptRaw).map(b => ({
      id: b.id,
      prompt: extractPrompt(b.text)
    })).filter(r => (r.prompt||'').trim());

    // ★ 주인공 프롬프트 행을 최상단에 추가
    const hero = parseHeroPrompt(promptRaw);
    const frag = document.createDocumentFragment();

    if (hero) {
      const tr = document.createElement('tr');

      const tdHero = document.createElement('td');
      tdHero.className = 'col-scene';
      tdHero.style.whiteSpace = 'nowrap';
      tdHero.style.padding = '12px';
      tdHero.style.borderBottom = '1px solid var(--border)';
      tdHero.textContent = '주인공';

      const tdPrompt = document.createElement('td');
      tdPrompt.className = 'col-prompt';
      tdPrompt.style.padding = '12px';
      tdPrompt.style.borderBottom = '1px solid var(--border)';
      const divText = document.createElement('div');
      divText.className = 'prompt-text';
      divText.textContent = hero;
      tdPrompt.appendChild(divText);

      const tdCopy = document.createElement('td');
      tdCopy.style.padding = '12px';
      tdCopy.style.borderBottom = '1px solid var(--border)';
      const btn = document.createElement('button');
      btn.textContent = '복사';
      btn.className = 'btn btn-danger';
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(hero); } catch {}
      });
      tdCopy.appendChild(btn);

      tr.appendChild(tdHero);
      tr.appendChild(tdPrompt);
      tr.appendChild(tdCopy);
      frag.appendChild(tr);
    }

    if (!rows.length) {
      if (!hero) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty" style="color: var(--muted); text-align:center; padding:12px;">이미지 프롬프트 입력창에서 유효한 프롬프트를 찾지 못했습니다.</td></tr>`;
      } else {
        tbody.innerHTML = '';
        tbody.appendChild(frag);
      }
      return;
    }

    rows.forEach(({ id, prompt }) => {
      const tr = document.createElement('tr');

      const tdScene = document.createElement('td');
      tdScene.className = 'col-scene';
      tdScene.style.whiteSpace = 'nowrap';
      tdScene.style.padding = '12px';
      tdScene.style.borderBottom = '1px solid var(--border)';
      tdScene.textContent = `장면 ${id}`;

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
      btn.className = 'btn btn-danger';
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(prompt || ''); } catch {}
      });
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
    const chunks = splitCards(raw);

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
      title.textContent = `카드 ${String(idx+1)} / ${n.toLocaleString('ko-KR')}자 / ${fmtHuman(n)}`;

      const btn = document.createElement('button');
      btn.textContent = '복사';
      btn.className = 'btn btn-secondary';
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(text || ''); } catch {}
        btn.classList.add('is-copied');
        setTimeout(()=>btn.classList.remove('is-copied'), 800);
      });

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

  /* ===== 초기화 & 이벤트 ===== */
  function initialize() {
    if (window._sceneParserInitialized) return;
    window._sceneParserInitialized = true;

    ensureStyles();
    buildLayout();
    restoreDateUI();

    const sceneInput  = $('#scene-input');
    const promptInput = $('#prompt-input');
    const btnSave     = $('#scene-save');
    const btnClear    = $('#scene-clear');

    const recomputeAll = () => {
      renderCards();
      renderPromptTable();
      updateTitles();
      syncBottomHeights();
    };

    if (sceneInput) {
      sceneInput.addEventListener('input', debounce(recomputeAll, 120));
      sceneInput.addEventListener('paste', () => setTimeout(recomputeAll, 0));
    }
    if (promptInput) {
      promptInput.addEventListener('input', debounce(recomputeAll, 120));
      promptInput.addEventListener('paste', () => setTimeout(recomputeAll, 0));
    }

    // 저장(JSON) — 우측 입력 기준(장면만 저장; 주인공은 제외)
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const rows = parseSceneBlocks($('#prompt-input')?.value || '')
          .map((b,i) => {
            const prompt = extractPrompt(b.text).trim();
            if (!prompt) return null;
            const id = b.id || pad3(i+1);
            return { id, prompt, suggested_filenames:[`${id}.jpg`, `${id}.png`] };
          }).filter(Boolean);

        if (!rows.length) { alert('저장할 프롬프트가 없습니다.'); return; }
        const payload = { version:1, exported_at: today(), count: rows.length, items: rows };
        downloadFile(`${today()}_image-prompts.json`, JSON.stringify(payload, null, 2));
      });
    }

    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (sceneInput)  sceneInput.value  = '';
        if (promptInput) promptInput.value = '';
        recomputeAll();
      });
    }

    window.addEventListener('resize', () => { syncBottomHeights(); });

    // 최초 1회
    recomputeAll();
  }

  function debounce(fn, ms){ let t=null; return function(...args){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), ms); }; }

  // 공개
  window.initializeSceneParser = initialize;

  if (document.getElementById('section-scene-parser')) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(() => { try{ initialize(); } catch(e){ console.error(e); } }, 0);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        try{ initialize(); } catch(e){ console.error(e); }
      });
    }
  }
})();
