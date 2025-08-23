/**
 * scene-parser.js — FULL REPLACEMENT (sentence-aware)
 * - 표: 장면 | 이미지 프롬프트 | 복사  (넘버링 없음)
 * - [장면1] 이전 텍스트 무시, [장면n:] → [장면 nnn] 로 정규화, "## n장."으로 시작하는 줄 삭제(공백 1회)
 * - 대본 패널:
 *    · 헤더 한 줄: "대본 / 대본글자수 N자 / 예상시간 [...]"
 *    · 텍스트는 사용자가 입력한 원문 그대로 보존(덮어쓰지 않음)
 *    · 카드 분할은 '정제된 텍스트'를 사용하되, **문장 단위**로 10,000자 근처에서 안전 분할
 *    · 카드2는 (시작지점 이후 텍스트 길이 > 10,000)일 때만, 카드3은 > 20,000일 때만 표시
 *    · 각 카드: 헤더 "카드 n / n자 / [..]" + 개별 스크롤 + 빨강↔초록 토글 복사 버튼
 * - 모든 복사 버튼: 기본 빨강(#c4302b), 클릭 시 초록(#16a34a), 다시 클릭 시 빨강
 * - 날짜 UI: "업로드 날짜" + date + ▲/▼ 스택(클래식)
 */

(function () {
  'use strict';

  /* ===== Constants ===== */
  const READ_SPEED_CPM   = 360;         // 분당 360자
  const CARD_LIMIT       = 10000;       // 카드 당 목표 글자수
  const TA_HEIGHT        = 220;         // textarea & card 높이(px)

  /* ===== Utilities ===== */
  const pad2 = n => String(n).padStart(2,'0');
  const pad3 = n => String(n).padStart(3,'0');

  const fmtDuration = chars => {
    const s = Math.floor((chars / READ_SPEED_CPM) * 60);
    return `[ ${pad2(Math.floor(s/3600))}시 ${pad2(Math.floor((s%3600)/60))}분 ${pad2(s%60)}초 ]`;
  };

  const today = () => {
    const d = new Date();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  const downloadFile = (filename, data, mime) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  };

  const showToast = (msg, type) => {
    try { if (typeof window.toast === 'function' && window.toast !== showToast) return window.toast(msg, type); }
    catch(_) {}
    console.log('[Toast]', type||'', msg);
  };

  /* ===== Copy buttons: RED <-> GREEN ===== */
  function ensureCopyStyles() {
    if (document.getElementById('copy-style-toggle')) return;
    const st = document.createElement('style');
    st.id = 'copy-style-toggle';
    st.textContent = `
      .btn-copy { padding:6px 12px; border-radius:8px; font-weight:700; cursor:pointer; border:1px solid transparent; }
      .btn-red   { background:#c4302b; border-color:#c4302b; color:#fff; }
      .btn-green { background:#16a34a; border-color:#16a34a; color:#fff; }
    `;
    document.head.appendChild(st);
  }
  function wireCopyToggle(btn, getText) {
    ensureCopyStyles();
    btn.classList.add('btn-copy', 'btn-red');
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(typeof getText==='function' ? (getText()||'') : ''); } catch {}
      if (btn.classList.contains('btn-red')) {
        btn.classList.remove('btn-red'); btn.classList.add('btn-green');
      } else {
        btn.classList.remove('btn-green'); btn.classList.add('btn-red');
      }
    });
  }

  /* ===== Text preprocessing for parsing only (원문은 보존) =====
     1) 첫 [장면1] 이전 삭제 (']' 또는 ':' 허용)
     2) [장면n: ...] → [장면 nnn] 로 정규화(뒤 내용 제거)
     3) [장면 n] → [장면 nnn]
     4) "## n장."으로 시작하는 줄 삭제, 빈 줄 1회 유지
  */
  function preprocessScriptText(text) {
    if (!text) return '';

    // 1) 첫 [장면1] 이전 삭제
    const firstIdx = text.search(/\[\s*장면\s*0*1\s*(?:\]|:)/i);
    if (firstIdx > 0) text = text.slice(firstIdx);

    // 2) [장면n: ...] 케이스
    text = text.replace(/\[\s*장면\s*(\d{1,3})\s*:[^\]\n]*\]/gi, (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);
    text = text.replace(/\[\s*장면\s*(\d{1,3})\s*:[^\n]*/gi,    (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);

    // 3) [장면 n]
    text = text.replace(/\[\s*장면\s*(\d{1,3})\s*\]/gi,         (_, n) => `[장면 ${pad3(parseInt(n,10))}]`);

    // 4) "## n장."으로 시작하는 줄 삭제
    const lines = text.replace(/\r\n/g,'\n').split('\n');
    const out = [];
    for (const ln of lines) {
      if (/^##\s*\d+\s*장\./i.test(ln)) {
        if (out.length===0 || out[out.length-1] !== '') out.push(''); // 빈 줄 1회 유지
      } else out.push(ln);
    }
    let res = out.join('\n').replace(/\n{3,}/g, '\n\n');
    return res;
  }

  /* ===== Prompt extraction ===== */
  function findQuotedSegments(t) {
    const re = /["“”'‘’]([^"“”'‘’]+)["“”'‘’]/g;
    const out = []; let m;
    while ((m = re.exec(t)) !== null) out.push({ text: m[1], index: m.index });
    return out;
  }
  // "이미지 프(롬|름)프트:" 뒤 첫 인용구, 없으면 가장 긴 인용구
  function extractPromptFromBlock(blockText) {
    const labelRe = /이미지\s*프(?:롬|름)프트\s*:/i;
    const idx = blockText.search(labelRe);
    const qs  = findQuotedSegments(blockText);
    if (!qs.length) return '';
    if (idx >= 0) {
      const after = qs.find(q => q.index >= idx);
      if (after) return (after.text||'').trim();
    }
    return qs.sort((a,b)=>b.text.length-a.text.length)[0].text.trim();
  }

  /* ===== Scene block parsing for table ===== */
  function parseSceneBlocks(fullText) {
    const text  = preprocessScriptText(fullText);
    const lines = text.replace(/\r\n/g,'\n').split('\n');
    const headerRe = /\[\s*장면\s*(\d{1,3})\s*\]/i;

    let started=false, cur=null;
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
    return blocks.map(b => ({ label:b.label, body:b.body.join('\n').trim() }));
  }

  /* ===== Table: 장면 | 이미지 프롬프트 | 복사 ===== */
  function ensureSceneTableHeader() {
    const tbody = document.getElementById('scene-tbody');
    if (!tbody) return;
    const table = tbody.closest('table');
    const thead = table ? table.querySelector('thead') : null;
    if (!thead) return;
    thead.innerHTML = `
      <tr>
        <th style="text-align:left; padding:12px; border-bottom:1px solid var(--border); width:160px;">장면</th>
        <th style="text-align:left; padding:12px; border-bottom:1px solid var(--border);">이미지 프롬프트</th>
        <th style="text-align:left; padding:12px; border-bottom:1px solid var(--border); width:110px;">복사</th>
      </tr>
    `;
  }
  function renderSceneTable(rows) {
    const tbody = document.getElementById('scene-tbody');
    if (!tbody) return;
    ensureSceneTableHeader();

    if (!rows || rows.length===0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:28px; color:var(--muted);">입력을 붙여넣으세요.</td></tr>';
      return;
    }
    const frag = document.createDocumentFragment();
    rows.forEach(({ label, prompt }) => {
      const tr = document.createElement('tr');

      const tdL = document.createElement('td');
      tdL.textContent = label;
      Object.assign(tdL.style,{ padding:'12px', borderBottom:'1px solid var(--border)' });

      const tdP = document.createElement('td');
      tdP.textContent = prompt || '';
      Object.assign(tdP.style,{ padding:'12px', borderBottom:'1px solid var(--border)' });

      const tdC = document.createElement('td');
      Object.assign(tdC.style,{ padding:'12px', borderBottom:'1px solid var(--border)' });

      const btn = document.createElement('button');
      btn.textContent = '복사';
      wireCopyToggle(btn, () => prompt || '');
      tdC.appendChild(btn);

      tr.appendChild(tdL); tr.appendChild(tdP); tr.appendChild(tdC);
      frag.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(frag);
  }
  const computeSceneRowsFromInput = () => {
    const input = document.getElementById('scene-input');
    if (!input) return [];
    const blocks = parseSceneBlocks(input.value || '');
    return blocks.map(({ label, body }) => ({ label, prompt: extractPromptFromBlock(body) }));
  };

  /* ===== Date UI (classic) ===== */
  function changeDate(dateInput, days){
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
    Object.assign(label.style, { fontWeight:'600', marginRight:'8px', color:'var(--text,#e4e6ea)' });

    const wrap = document.createElement('div');
    wrap.className = 'sp-date-wrap';
    Object.assign(wrap.style, { display:'inline-flex', alignItems:'center', gap:'6px', marginRight:'8px' });

    date.type = 'date';
    if (!date.value) date.value = today();
    Object.assign(date.style, {
      height:'40px', padding:'8px 12px',
      border:'2px solid var(--border,#2a3443)', borderRadius:'8px',
      background:'var(--panel,#1e2329)', color:'var(--text,#e4e6ea)', fontWeight:'600'
    });

    const col = document.createElement('div');
    Object.assign(col.style,{ display:'flex', flexDirection:'column', gap:'2px' });
    const mk = t => {
      const b=document.createElement('button'); b.textContent=t;
      Object.assign(b.style,{
        width:'30px', height:'20px', padding:'0',
        border:'1px solid var(--border,#2a3443)', borderRadius:'4px',
        background:'var(--glass-bg,rgba(255,255,255,.05))',
        color:'var(--text,#e4e6ea)', fontSize:'10px',
        display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer'
      }); return b;
    };
    const up=mk('▲'), dn=mk('▼');
    up.addEventListener('click',()=>changeDate(date,1));
    dn.addEventListener('click',()=>changeDate(date,-1));

    col.appendChild(up); col.appendChild(dn);
    wrap.appendChild(date); wrap.appendChild(col);

    actions.insertBefore(label, actions.firstChild || null);
    actions.insertBefore(wrap, label.nextSibling);
  }

  /* ===== Sentence-aware card splitting ===== */

  // 카드 시작 지점: "초반 45초 훅" > 첫 [장면1] > 0
  function startIndexForCards(cleanedText) {
    let i = cleanedText.search(/초반\s*45\s*초\s*훅/i);
    if (i === -1) {
      const j = cleanedText.search(/\[\s*장면\s*0*1\s*(?:\]|:)/i);
      i = (j === -1) ? 0 : j;
    }
    return i < 0 ? 0 : i;
  }

  // 문장 경계 인덱스 계산: 마침표/물음표/느낌표/중국어종결/ellipsis 뒤의 따옴표까지 포함
  function sentenceEndPositions(str) {
    const ends = [];
    const END_PUNCT = '.!?！？。…';
    const TRAIL = '’”"\')］〕〉》」』）]'; // 닫는 따옴표/괄호류
    for (let i=0;i<str.length;i++) {
      const ch = str[i];
      if (END_PUNCT.includes(ch)) {
        let j = i + 1;
        while (j < str.length && TRAIL.includes(str[j])) j++;
        ends.push(j);
      }
    }
    if (ends.length === 0 || ends[ends.length-1] !== str.length) {
      ends.push(str.length); // 문장부호가 없으면 끝까지 하나로 취급
    }
    return ends;
  }

  // limit 이하의 가장 가까운 문장 경계에서 자르기.
  // limit 이내 경계가 없으면 첫 경계에서 자른다(문장 하나가 limit보다 길 때 허용).
  function cutAtSentenceBoundary(str, limit) {
    const ends = sentenceEndPositions(str);
    let cut = ends[0];
    for (let k=0;k<ends.length;k++) {
      if (ends[k] <= limit) cut = ends[k];
      else break;
    }
    return { head: str.slice(0, cut), tail: str.slice(cut) };
  }

  // 문장 단위 카드 1~3 생성
  function splitCardsBySentence(rawText) {
    const cleaned = preprocessScriptText(rawText || '');
    const baseStart = startIndexForCards(cleaned);
    const base = cleaned.slice(baseStart);      // 분할 대상
    const totalLen = base.length;

    if (!totalLen) return ['', '', '', 0];      // [c1,c2,c3,totalLen]

    const c1res = cutAtSentenceBoundary(base, CARD_LIMIT);
    const c1 = c1res.head;

    const c2 = (totalLen > CARD_LIMIT)
      ? cutAtSentenceBoundary(c1res.tail, CARD_LIMIT).head
      : '';

    const c3 = (totalLen > CARD_LIMIT*2)
      ? cutAtSentenceBoundary(cutAtSentenceBoundary(c1res.tail, CARD_LIMIT).tail, CARD_LIMIT).head
      : '';

    return [c1, c2, c3, totalLen];
  }

  /* ===== Script Panel (UI) ===== */
  function ensurePanelStyle() {
    if (document.getElementById('scene-panel-style')) return;
    const st = document.createElement('style');
    st.id = 'scene-panel-style';
    st.textContent = `
      #scene-script-panel{border:2px solid var(--border,#2a3443);border-radius:16px;padding:20px;background:var(--card,#151b24);margin:16px 0 24px;box-shadow:0 4px 20px rgba(0,0,0,.1)}
      #scene-script-head{display:flex;align-items:center;gap:8px;margin-bottom:12px;white-space:nowrap}
      #scene-script-head .title{font-weight:800;font-size:1.2rem;color:var(--text,#e4e6ea)}
      #scene-script-head .meta{font-weight:800;color:var(--muted,#9aa4b2)}
      #scene-script-input{width:100%;height:${TA_HEIGHT}px;padding:16px;resize:none;overflow-y:auto;border:2px solid var(--border,#2a3443);border-radius:12px;background:var(--panel,#1e2329);color:var(--text,#e4e6ea);font:14px/1.6 ui-monospace,SFMono-Regular,monospace}
      #scene-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}
      .scene-card{border:1px solid var(--border,#2a3443);border-radius:12px;background:var(--glass-bg,rgba(255,255,255,.02));padding:12px;display:flex;flex-direction:column;gap:8px;height:${TA_HEIGHT}px}
      .scene-card-row{display:flex;align-items:center;justify-content:space-between}
      .scene-card-title{font-weight:700;color:var(--brand,#c4302b)}
      .scene-card pre{flex:1 1 auto;min-height:0;overflow-y:auto;margin:0;padding:0;white-space:pre-wrap;word-break:break-word;line-height:1.6;font-family:inherit}
      .scene-cards-hidden{display:none !important;}
    `;
    document.head.appendChild(st);
  }

  function renderScriptPanel() {
    const section = document.getElementById('section-scene-parser');
    if (!section || document.getElementById('scene-script-panel')) return;
    ensurePanelStyle();

    const content = section.querySelector('.scene-parser-content');

    const panel  = document.createElement('section'); panel.id = 'scene-script-panel';
    const head   = document.createElement('div');     head.id  = 'scene-script-head';

    const title  = document.createElement('span'); title.className='title'; title.textContent = '대본';
    const meta   = document.createElement('span'); meta.className='meta';  meta.textContent  = ' / 대본글자수 0자 / 예상시간 [ 00시 00분 00초 ]';
    head.appendChild(title); head.appendChild(meta);

    const ta     = document.createElement('textarea'); ta.id   = 'scene-script-input';
    ta.placeholder = '여기에 대본을 붙여넣으면, 카드 1·2·3이 문장 단위로 분할되어 생성됩니다. (시작: "초반 45초 훅" → 없으면 첫 [장면1])';

    const grid   = document.createElement('div');  grid.id = 'scene-cards'; grid.classList.add('scene-cards-hidden');

    function makeCard(idx, chunkText) {
      const card = document.createElement('div'); card.className = 'scene-card';
      const row  = document.createElement('div'); row.className  = 'scene-card-row';
      const left = document.createElement('div'); left.className = 'scene-card-title';
      const n    = (chunkText || '').length;
      left.textContent = `카드 ${idx} / ${n.toLocaleString('ko-KR')}자 / ${fmtDuration(n)}`;
      const btn  = document.createElement('button'); btn.textContent='복사';
      wireCopyToggle(btn, () => chunkText || '');
      const pre  = document.createElement('pre'); pre.textContent = chunkText || '';

      row.appendChild(left); row.appendChild(btn);
      card.appendChild(row); card.appendChild(pre);
      return card;
    }

    function renderCardsFrom(raw) {
      const [c1, c2, c3, totalLen] = splitCardsBySentence(raw);
      grid.innerHTML = '';

      if (totalLen > 0) grid.appendChild(makeCard(1, c1));
      if (totalLen > CARD_LIMIT) grid.appendChild(makeCard(2, c2));
      if (totalLen > CARD_LIMIT*2) grid.appendChild(makeCard(3, c3));
    }

    function onInput() {
      const raw = ta.value || '';
      meta.textContent = ` / 대본글자수 ${raw.length.toLocaleString('ko-KR')}자 / 예상시간 ${fmtDuration(raw.length)}`;
      if (raw.trim().length > 0) {
        grid.classList.remove('scene-cards-hidden');
        renderCardsFrom(raw);
      } else {
        grid.classList.add('scene-cards-hidden');
        grid.innerHTML = '';
      }
    }

    ta.addEventListener('input', onInput);
    onInput();

    panel.appendChild(head);
    panel.appendChild(ta);
    panel.appendChild(grid);

    if (content) section.insertBefore(panel, content);
    else section.prepend(panel);
  }

  /* ===== Init ===== */
  function initializeSceneParser() {
    if (window._sceneParserInitialized) return;
    window._sceneParserInitialized = true;

    // Script panel (top)
    renderScriptPanel();

    // Date UI (classic)
    restoreDateUI();

    // Table wiring
    const $input = document.getElementById('scene-input');
    const $tbody = document.getElementById('scene-tbody');
    const $save  = document.getElementById('scene-save');
    const $clear = document.getElementById('scene-clear');
    if (!$input || !$tbody) {
      console.warn('[scene-parser] Missing #scene-input or #scene-tbody');
      return;
    }

    const rerender = () => renderSceneTable(computeSceneRowsFromInput());
    $input.addEventListener('input', () => {
      // NOTE: 입력 박스 내용은 보존. 파싱은 내부적으로 preprocessScriptText()를 사용.
      rerender();
    });
    if ($clear) $clear.addEventListener('click', () => { $input.value=''; rerender(); });
    if ($save) {
      $save.addEventListener('click', () => {
        const rows = computeSceneRowsFromInput();
        const header = '장면\t이미지 프롬프트';
        const lines  = [header, ...rows.map(r => `${r.label}\t${(r.prompt||'').replace(/\t/g,' ')}`)];
        downloadFile(`scene-prompts_${today()}.tsv`, lines.join('\n'), 'text/tab-separated-values;charset=utf-8');
        showToast('파일 저장 완료','success');
      });
    }

    rerender();
  }

  window.initializeSceneParser = initializeSceneParser;

  if (document.getElementById('section-scene-parser')) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(() => { try { initializeSceneParser(); } catch(e){ console.error(e); } }, 0);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        try { initializeSceneParser(); } catch(e){ console.error(e); }
      });
    }
  }
})();
