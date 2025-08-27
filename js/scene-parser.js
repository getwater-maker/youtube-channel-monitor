/**
 * scene-parser.js — 2섹션(좌=대화, 우=이미지프롬프트) 레이아웃 + JSON 저장
 *
 * 섹션 구성
 *  - 좌측 "대본 입력창": 대본 입력창 + 카드(무제한)
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
  
  /* 요약 프리뷰 칩 (한 줄 줄임표) */
      .sp-preview-chip{
        display:inline-block; max-width:380px; margin-right:8px; padding:6px 10px;
        border-radius:8px; border:1px dashed var(--border); color:var(--text);
        font-size:12px; vertical-align:middle; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        background:var(--glass-bg);
      }
      @media (max-width: 768px){ .sp-preview-chip{ max-width:240px; } }

  `;
  document.head.appendChild(st);
}

function wireCopyToggle(btn, getText) {
  // 스타일(버튼/칩) 보장
  ensureCopyStyles();
  btn.classList.add('sp-btn-copy', 'sp-btn-red');

  // 1) 전체 텍스트 확보
  let fullText = '';
  try {
    fullText = typeof getText === 'function' ? (getText() || '') : '';
  } catch { fullText = ''; }

  // 2) 버튼이 들어있는 셀(또는 부모) 기준으로
  //    이미 화면에 길게 렌더된 프롬프트를 "요약"으로 바꾸고, 전체는 숨김/보관
  const cell = btn.closest('td, .cell, .sp-cell') || btn.parentNode;
  if (cell) {
    // (a) 길게 노출된 후보 요소 찾기
    const longTextEl =
      cell.querySelector('[data-sp-role="prompt-full"]') ||
      Array.from(cell.childNodes).find(n => {
        // 텍스트노드 또는 텍스트 덩어리 div/p 등
        if (n.nodeType === 3) return String(n.textContent || '').trim().length > 40;
        if (n.nodeType === 1) {
          const t = String(n.textContent || '').trim();
          // 버튼/칩/아이콘이 아닌 일반 텍스트 블록만
          const tag = n.tagName;
          const isTextBlock = /^(DIV|P|SPAN)$/.test(tag);
          const isControl   = n.classList?.contains('sp-btn-copy') || n === btn;
          return !isControl && isTextBlock && t.length > 40;
        }
        return false;
      });

    // (b) longTextEl이 있으면 그 내용을 전체 텍스트로 사용
    if (longTextEl) {
      const content = String(longTextEl.textContent || '').trim();
      if (content.length > 0) {
        fullText = content;
      }
      // 화면에서는 요약(줄임표)만 보이게 처리
      //  - 기존 요소는 숨기고(접근성 위해 title 부여)
      //  - 대신 칩 형태의 요약 프리뷰를 버튼 앞에 추가
      longTextEl.style.display = 'none';
      longTextEl.setAttribute('aria-hidden', 'true');
      longTextEl.title = content;

      const shortText = content.length > 60 ? (content.slice(0, 60) + ' ...') : content;
      const chip = document.createElement('span');
      chip.className = 'sp-preview-chip';
      chip.textContent = shortText;
      chip.title = content; // 마우스 오버 시 전체 미리보기
      if (!btn.previousElementSibling || !btn.previousElementSibling.classList?.contains('sp-preview-chip')) {
        cell.insertBefore(chip, btn);
      }
    } else {
      // longTextEl이 없으면 버튼 앞에 요약 칩만 생성
      const shortText = fullText.length > 60 ? (fullText.slice(0, 60) + ' ...') : fullText;
      if (shortText) {
        const chip = document.createElement('span');
        chip.className = 'sp-preview-chip';
        chip.textContent = shortText;
        chip.title = fullText;
        if (!btn.previousElementSibling || !btn.previousElementSibling.classList?.contains('sp-preview-chip')) {
          cell.insertBefore(chip, btn);
        }
      }
    }
  }

  // 3) 버튼 라벨/툴팁 고정 (화면엔 ‘복사’만 보이도록)
  btn.textContent = '복사';
  btn.title = '전체 프롬프트 복사';

  // 4) 클릭 시 전체 텍스트 복사
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(fullText || ''); } catch {}
    btn.classList.toggle('sp-btn-red');
    btn.classList.toggle('sp-btn-green');
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

    // [장면 n: ...] → [장면 n]
    t = t.replace(/\[\s*장면\s*(\d{1,3})\s*:[^\]\n]*\]/gi, (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    // [장면 n: ...  (닫힘 누락)] → [장면 n]
    t = t.replace(/\[\s*장면\s*(\d{1,3})\s*:[^\n]*/gi,    (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    // [장면 n] → [장면 n]
    t = t.replace(/\[\s*장면\s*(\d{1,3})\s*\]/gi,         (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);

    // **장면 n** 또는 **장면 n:** → [장면 n]  (굵게 머리표기를 허용)
    t = t.replace(/\*\*\s*장면\s*(\d{1,3})\s*\*\*/gi,     (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    t = t.replace(/\*\*\s*장면\s*(\d{1,3})\s*:\s*\*\*/gi, (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);

    // ### [장면n] 패턴 추가 지원
    t = t.replace(/###\s*\[\s*장면\s*(\d{1,3})\s*\][^\n]*/gi, (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);

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

  /* ===== 씬 블록 / 프롬프트 추출 ===== */
  function parseSceneBlocks(text) {
    const t = normalizeForSceneBlocks(text||'');
    const lines = t.replace(/\r\n/g,'\n').split('\n');
    const headerRe = /\[\s*장면\s*(\d{1,3})\s*\]/i;

    let cur=null, started=false;
    const blocks=[];
    for (const ln of lines) {
      // 헤더 패턴을 먼저 확인
      const m = ln.match(headerRe);
      if (m) {
        started = true;
        if (cur) blocks.push(cur);
        cur = { label:`장면 ${pad3(parseInt(m[1],10))}`, body:[] };
        const suffix = ln.slice(ln.indexOf(m[0])+m[0].length).trim();
        if (suffix) cur.body.push(suffix);
      } else if (started && cur) {
        // 제목 다음의 빈 줄을 무시하고, 실제 내용이 시작되는 줄부터 본문으로 추가
        if (ln.trim().length > 0 || cur.body.length > 0) {
          cur.body.push(ln);
        }
      }
    }
    if (cur) blocks.push(cur);
    if (!blocks.length && (t || '').trim()) {
      blocks.push({ label:'-', body: t.split('\n') });
    }
    return blocks.map(b => ({ label:b.label, body:(Array.isArray(b.body)?b.body.join('\n'):b.body).trim() })).filter(b => b.body.length > 0);
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
    
    // **[장면 n]** 패턴 제거
    src = src.replace(/^\*\*\[장면[^\]]*\]\*\*\s*/i, '').trim();
    
    // Korean drama still photo로 시작하는 부분 찾기
    const koreanDramaMatch = src.match(/Korean drama still photo[^]*?(?=\n\n|\n(?=\*\*\[장면|\*\*[^[])|\n(?=##)|$)/i);
    if (koreanDramaMatch) {
      return koreanDramaMatch[0].trim();
    }
    
    // 콜론 뒤의 내용 추출
    const colonIdx = src.search(/:\s*/);
    if (colonIdx >= 0) {
      const tail = src.slice(colonIdx + 1).trim();
      return tail;
    }
    
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
	  const clipped      = clipTextBeforeImagePrompt(scriptRaw || '');
	  const cleanedNoHdr = sanitizeLines(clipped);
	  const cleaned      = normalizeForSceneBlocks(cleanedNoHdr);

	  // ① 따옴표 제거 (ASCII " 와 유니코드 “ ” 등)
	  const src = cleaned.replace(/["\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '');

	  // ② 분할 기준과 슬라이스는 반드시 제거된 문자열(src)을 사용
	  const start = startIndexForCards(src);
	  let rest    = src.slice(start);

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
      /* 라벨은 시각적으로 숨겨 동일선상 정렬(타이틀 아래 바로 입력창이 오도록) */
      .sp-input-wrap label { display:none; }

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

    /* 좌 — 대본 입력창 (타이틀 추가로 우측과 동일선상) */
    const left = document.createElement('div'); left.className = 'sp-section';
    const leftTitle = document.createElement('div'); leftTitle.className = 'sp-section-title';
    leftTitle.textContent = '대본 입력창';
    const leftInputWrap = document.createElement('div'); leftInputWrap.className = 'sp-input-wrap';
    const lblScene = document.createElement('label'); lblScene.setAttribute('for','scene-input'); lblScene.textContent = '대본 입력창';
    const sceneInput = $('#scene-input', oldInputArea || document);
    if (sceneInput) { sceneInput.style.resize='none'; sceneInput.style.overflow='auto'; }
    leftInputWrap.appendChild(lblScene);
    if (sceneInput) leftInputWrap.appendChild(sceneInput);
    const leftCards = document.createElement('div'); leftCards.id='sp-cards';

    left.appendChild(leftTitle);
    left.appendChild(leftInputWrap);
    left.appendChild(leftCards);

    /* 우 — 이미지 프롬프트 섹션 (기존 구조 유지) */
    const right = document.createElement('div'); right.className = 'sp-section';
    const rightTitle = document.createElement('div'); rightTitle.className = 'sp-section-title';
    rightTitle.textContent = '이미지 프롬프트';
    const rightInputWrap = document.createElement('div'); rightInputWrap.className = 'sp-input-wrap';
    const lblPrompt = document.createElement('label'); lblPrompt.setAttribute('for','prompt-input'); lblPrompt.textContent = '이미지 프롬프트 입력창';
    const promptInput = document.createElement('textarea'); promptInput.id='prompt-input';
    promptInput.placeholder = '예: [장면 001]\n이미지 프롬프트: "..."';
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
  // "### 👤 주인공 이미지 프롬프트:" 제목 다음 ~ 다음 제목("##" 또는 "###") 전까지를 추출
  function extractProtagonistPrompt(full) {
    const text = String(full || '').replace(/\r\n/g, '\n');
    const lines = text.split('\n');

    let start = -1;
    const headingRe = /^\s*#{2,3}\s*.*주인공.*프롬프트.*$/i;
    for (let i = 0; i < lines.length; i++) {
      if (headingRe.test(lines[i])) { start = i + 1; break; }
    }
    if (start === -1) return '';

    let end = lines.length;
    for (let i = start; i < lines.length; i++) {
      if (/^\s*#{2,3}\s+/.test(lines[i])) { end = i; break; }
    }

   const body = lines.slice(start, end)
      .filter(ln => !/^\s*#{2,3}\s+/.test(ln))
      .map(ln => ln.replace(/^\*\*(.+?)\*\*$/g, '$1'))
      .join('\n')
      .trim();

    // "Korean drama still photo of..." 부분만 추출
    const cleanPrompt = body.replace(/^[^:]*:\s*/, '').trim();
    return cleanPrompt;
  }

  /* ===== 섹션(🎬 …) 토큰 추출 =====
     - 패턴 A: "##/### (🎬) 훅 장면 이미지 프롬프트:" 또는 "##/### (🎬) 1장 장면별 이미지 프롬프트:" 등
     - 패턴 B: "##/### ... 3장 ..." 처럼 제목 안 어딘가에 "<숫자>장"이 포함된 경우(이미지 프롬프트 문구가 없어도 인정)
     - 둘 다 지원하며, '주인공 이미지 프롬프트' 제목은 제외한다. */
  function findSectionTokens(full) {
    const text = String(full || '');
    const byIndex = new Map();

    // 패턴 A: ...이미지 프롬프트
    let m;
    const reA = /^\s*#{2,3}\s*(?:🎬\s*)?(.+?)\s*(?:장면별\s*이미지\s*프롬프트|이미지\s*프롬프트)\s*:?\s*$/gim;
    while ((m = reA.exec(text)) !== null) {
      const fullLine = m[0];         // 제목 전체 라인
      if (/주인공\s*이미지\s*프롬프트/i.test(fullLine)) continue; // 주인공 섹션 제외

      // 숫자 'n장' 우선 인식, 없으면 원문 제목(훅 등)
      const numMatch = /(\d{1,3})\s*장\b/i.exec(fullLine) || /(\d{1,3})\s*장\b/i.exec(m[1] || '');
      const raw = (m[1] || '').trim();
      const title = numMatch ? `🎬 ${parseInt(numMatch[1],10)}장` : `🎬 ${raw}`;
      if (!byIndex.has(m.index)) byIndex.set(m.index, { type:'section', index:m.index, title });
    }

    // 패턴 B: #... <숫자>장 ... (이미지 프롬프트 문구가 없어도 섹션으로 인정)
    const reHeading = /^\s*#{2,3}\s+(.+)$/gim;
    while ((m = reHeading.exec(text)) !== null) {
      const fullLine = m[0];
      const idx  = m.index;
      if (byIndex.has(idx)) continue; // 이미 A에서 잡힌 라인은 건너뜀
      if (/주인공\s*이미지\s*프롬프트/i.test(fullLine)) continue; // 주인공 제외
      if (/이미지\s*프롬프트/i.test(fullLine)) continue;         // '이미지 프롬프트' 제목은 A에서 처리

      const num = /(\d{1,3})\s*장\b/i.exec(fullLine);
      if (num) {
        const n = parseInt(num[1], 10);
        byIndex.set(idx, { type:'section', index: idx, title: `🎬 ${n}장` });
      }
    }

    return Array.from(byIndex.values()).sort((a,b)=>a.index-b.index);
  }

  /* ===== 원문에서 장면 헤더(**장면 n** / [장면 n]) 위치 찾기 ===== */
  function findSceneTokens(full) {
    const text = String(full || '');
    const tokens = [];
    const push = (n, idx) => tokens.push({ type:'scene', index: idx, label:`장면 ${pad3(parseInt(n,10))}` });

    let m;
    const reBold = /\*\*\s*장면\s*(\d{1,3})\s*\*\*/gi;
    while ((m = reBold.exec(text)) !== null) push(m[1], m.index);

    const reBr = /\[\s*장면\s*(\d{1,3})\s*\]/gi;
    while ((m = reBr.exec(text)) !== null) push(m[1], m.index);

    // 인덱스 순서대로 정렬
    tokens.sort((a,b)=>a.index-b.index);
    return tokens;
  }

  /* ===== 표 렌더링 ===== */
  function renderPromptTable() {
    const tbody = document.getElementById('scene-tbody');
    if (!tbody) return;

    const thead = tbody.closest('table')?.querySelector('thead');
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th class="col-scene"  style="text-align:left; padding:8px 12px; border-bottom:1px solid var(--border); width:120px;">장면</th>
          <th class="col-prompt" style="text-align:left; padding:8px 12px; border-bottom:1px solid var(--border);">이미지 프롬프트</th>
          <th class="col-copy" style="text-align:center; padding:8px 12px; border-bottom:1px solid var(--border); width:80px;">복사</th>
        </tr>
      `;
    }

    const promptRaw = ($('#prompt-input')?.value || '');
    const promptClean = sanitizeLines(normalizeForSceneBlocks(promptRaw));
    const blocks = parseSceneBlocks(promptClean);

    const rows = blocks.map(({label, body}) => ({ label, prompt: extractPromptFromBlock(body) }))
                       .filter(r => (r.prompt||'').trim().length);

    const rowsMap = new Map(rows.map(r => [r.label, r.prompt]));
    const frag = document.createDocumentFragment();

    // 0) 헤더 바로 아래 "주인공" 행 (있을 때만)
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

    // 1) 섹션/장면 토큰을 원문 순서대로 병합
    const sectionTokens = findSectionTokens(promptRaw);
    const sceneTokens   = findSceneTokens(promptRaw);

    // 각 섹션별 프롬프트 개수 계산(해당 섹션 이후 ~ 다음 섹션 직전 장면 수)
    for (let i = 0; i < sectionTokens.length; i++) {
      const sec  = sectionTokens[i];
      const next = sectionTokens[i+1] || { index: Infinity };
      let count = 0;
      for (const s of sceneTokens) {
        if (s.index > sec.index && s.index < next.index && rowsMap.has(s.label)) count++;
      }
      sec.count = count;
    }

    const tokens = [...sectionTokens, ...sceneTokens].sort((a,b)=>a.index-b.index);
    const addedScenes = new Set();

    // 2) 토큰 순회하며 섹션은 "제목 / 프롬프트 n개"(복사버튼 X), 장면은 기존처럼 표시
    for (const tk of tokens) {
      if (tk.type === 'section') {
        const trSec = document.createElement('tr');

        const tdScene = document.createElement('td');
        tdScene.className = 'col-scene';
        tdScene.style.whiteSpace = 'nowrap';
        tdScene.style.padding = '12px';
        tdScene.style.borderBottom = '1px solid var(--border)';
        tdScene.textContent = `${tk.title} / 프롬프트 ${tk.count||0}개`;

        const tdPrompt = document.createElement('td');
        tdPrompt.className = 'col-prompt';
        tdPrompt.style.padding = '12px';
        tdPrompt.style.borderBottom = '1px solid var(--border)';
        tdPrompt.textContent = ''; // 섹션 제목행은 본문 없음

        const tdCopy = document.createElement('td');
        tdCopy.style.padding = '12px';
        tdCopy.style.borderBottom = '1px solid var(--border)';
        // 복사 버튼 없음

        trSec.appendChild(tdScene);
        trSec.appendChild(tdPrompt);
        trSec.appendChild(tdCopy);
        frag.appendChild(trSec);
      } else if (tk.type === 'scene') {
        if (addedScenes.has(tk.label)) continue; // 중복 방지
        const prompt = rowsMap.get(tk.label);
        if (!prompt) continue;

        const tr = document.createElement('tr');

        const tdScene = document.createElement('td');
        tdScene.className = 'col-scene';
        tdScene.style.whiteSpace = 'nowrap';
        tdScene.style.padding = '12px';
        tdScene.style.borderBottom = '1px solid var(--border)';
        tdScene.textContent = tk.label;

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

        addedScenes.add(tk.label);
      }
    }

    // 3) 내용 출력
    tbody.innerHTML = '';
    if (frag.childNodes.length) {
      tbody.appendChild(frag);
    } else {
      const trEmpty = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'empty';
      td.style.color = 'var(--muted)';
      td.style.textAlign = 'center';
      td.style.padding = '28px';
      td.textContent = '이미지 프롬프트 입력창에서 유효한 프롬프트를 찾지 못했습니다.';
      trEmpty.appendChild(td);
      tbody.appendChild(trEmpty);
    }
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
