// js/script.js (통합본: 대본 정렬/--- 제거 + 이미지 프롬프트 챕터/중복제거/주인공 + UI 유지)
import { draftsGetAll, draftsPut, draftsRemove } from './indexedStore.js';

(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const pad2 = (n) => String(n).padStart(2, '0');
  const pad3 = (n) => String(n).padStart(3, '0');
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };

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

  function downloadFile(filename, data, mime = 'application/json;charset=utf-8') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  const debounce = (fn, ms) => { let t = null; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };

  /* ========== (UI 유지) 스타일 삽입 ========== */
  (function ensureStyles() {
    if ($('#sp-style')) return;
    const st = document.createElement('style');
    st.id = 'sp-style';
    st.textContent = `
      #sp-wrap { display:block; }
      .sp-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
      .sp-title { font-size:20px; font-weight:900; }
      .sp-actions { display:flex; gap:8px; align-items:center; }
      .sp-grid { display:grid; grid-template-columns: 1fr 1fr; gap:16px; align-items:start; }
      .sp-section { border:1px solid var(--border); border-radius:12px; background: var(--glass-bg); padding:12px; }
      .sp-section-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
      .sp-section-title { font-weight:800; }
      .sp-rem { display:inline-flex; gap:6px; align-items:center; }
      .sp-rem input[type="text"] { height:32px; padding:0 10px; border:1px solid var(--border); border-radius:8px; background:var(--card); color:var(--text); }
      .sp-textarea { height:360px; resize:none; overflow:auto; width:100%; border:1px solid var(--border); border-radius:10px; background:var(--card); color:var(--text); padding:14px; line-height:1.6; font-size:14px; }

      #sp-cards { display:flex; flex-direction:column; gap:12px; margin-top:10px; }
      .sp-card { border:1px solid var(--border); border-radius:12px; background:var(--panel); padding:12px; }
      .sp-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
      .sp-card-title { font-weight:700; color:var(--brand); }
      .sp-card-pre { margin:0; white-space:pre-wrap; word-break:break-word; max-height:220px; overflow:auto; font-family:ui-monospace, monospace; }

      .sp-table-wrap { width:100%; margin-top:10px; }
      table.sp { width:100%; border-collapse:collapse; table-layout: fixed; }
      table.sp thead th { text-align:left; padding:10px 12px; border-bottom:1px solid var(--border); }
      table.sp tbody td {
        padding:6px 10px;
        border-bottom:1px solid var(--border);
        vertical-align:middle;
        word-break: break-all;
      }
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

  let REMOVE_WORDS_SCRIPT = [];
  let REMOVE_WORDS_PROMPT = [];

  const buildRemoveRegex = (list) => {
    if (!Array.isArray(list) || !list.length) return null;
    const parts = list.map(w => String(w||'').trim()).filter(Boolean)
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    if (!parts.length) return null;
    return new RegExp(parts.join('|'), 'gi');
  };

  /* =====================================================
   *               대본 파싱 (Script)
   * -----------------------------------------------------
   * #/## 줄 제거, ###등 해시+장면 → [장면 nnn], 별표 제거, --- 제거,
   * [장면 nnn] 블록들을 **오름차순 정렬** (장면 외 텍스트는 직전 장면 블록에 포함)
   * ===================================================== */
  function preprocessScript(rawText) {
    const lines = String(rawText || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];

    for (let i = 0; i < lines.length; i++) {
      let ln = lines[i] ?? '';

      // --- 구분선은 빈 줄로
      if (/^\s*-{3,}\s*$/.test(ln)) { out.push(''); continue; }

      // 해시+장면 → [장면 nnn]
      const sceneInHash = /^\s*#+.*장면\s*(\d{1,3})/i.exec(ln);
      if (sceneInHash) {
        const n = pad3(parseInt(sceneInHash[1], 10));
        out.push(`[장면 ${n}]`);
        // 다음 줄이 빈 줄이면 1개만 유지
        const next = lines[i + 1] ?? '';
        if (/^\s*$/.test(next)) out.push('');
        continue;
      }

      // #, ## 시작 줄은 삭제 + 줄 당김 1
      if (/^\s*#\s+/.test(ln) || /^\s*##\s+/.test(ln)) { out.push(''); continue; }

      out.push(ln);
    }

    // 별표 제거
    let joined = out.join('\n').replace(/\*/g, '');

    // 사용자 제거어
    const remRe = buildRemoveRegex(REMOVE_WORDS_SCRIPT);
    if (remRe) joined = joined.replace(remRe, '').replace(/[ \t]{2,}/g, ' ');

    // [장면 nnn] 뒤 공백 1줄로 정규화
    joined = joined.replace(/(\[장면\s+\d{3}\])\n+/g, '$1\n');

    // 과도한 빈 줄 정규화
    joined = joined.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '');

    // === [장면 nnn] 블록 단위 정렬 ===
    (function sortBySceneBlocks() {
      const sceneRe = /^\s*\[장면\s+(\d{3})\]\s*$/;
      const L = joined.split('\n');
      const blocks = [];
      let buf = [];
      let curId = null;

      const push = () => {
        if (buf.length) {
          blocks.push({ id: curId, text: buf.join('\n') });
          buf = [];
        }
      };

      for (let i = 0; i < L.length; i++) {
        const line = L[i];
        const m = sceneRe.exec(line);
        if (m) {
          push();
          curId = parseInt(m[1], 10);
          buf.push(line);
        } else {
          buf.push(line);
        }
      }
      push();

      const prelude = blocks.filter(b => !Number.isFinite(b.id)); // 장면 전 텍스트
      const scenes  = blocks.filter(b =>  Number.isFinite(b.id)).sort((a,b)=> a.id - b.id);
      joined = [...prelude, ...scenes].map(b => b.text).join('\n');
    })();

    return joined;
  }

  /* =====================================================
   *           이미지 프롬프트 (Prompt)
   * -----------------------------------------------------
   * - 주인공:  "## ...주인공...프롬프트" 다음 본문 전체(다음 헤더/장면/--- 전까지)
   * - 장면:    "### [장면 n]" 다음 첫 유효한 1줄
   * - 챕터:    "## … (장면 a-b)" 범위별 출력, **겹치면 선착 챕터만** (중복 제거)
   * - 별표 제거 및 사용자 제거어 적용
   * ===================================================== */
  function collectPromptRowsWithChapters(rawText) {
    const src = String(rawText || '').replace(/\r\n/g, '\n');
    const lines = src.split('\n');

    const chapters = []; // { label, lo, hi }
    const scenes   = []; // { idNum, id:'nnn', prompt }
    let heroPrompt = null;

    const heroHeaderRe  = /^\s*##\s*.*주인공.*프롬프트.*$/i;
    const sceneHeaderRe = /^\s*###\s*\[\s*장면\s*(\d{1,3})\s*\].*$/i;
    const chapterRe     = /^\s*##\s*(.+?)\(\s*장면\s*(\d{1,3})\s*-\s*(\d{1,3})\s*\)\s*$/;

    const isSeparator = (s) => /^\s*-{3,}\s*$/.test(s);
    const isH2        = (s) => /^\s*##\s+/.test(s);
    const isH3        = (s) => /^\s*###\s+/.test(s);

    for (let i = 0; i < lines.length; i++) {
      let ln = String(lines[i] ?? '').replace(/\*/g, '');

      // 챕터
      const ch = chapterRe.exec(ln);
      if (ch) {
        const labelRaw = ch[1].trim().replace(/\s+$/, '');
        const lo = parseInt(ch[2], 10);
        const hi = parseInt(ch[3], 10);
        chapters.push({ label: `${labelRaw} (장면 ${lo}-${hi})`, lo, hi });
        continue;
      }

      // 주인공 헤더
      if (!heroPrompt && heroHeaderRe.test(ln)) {
        const buf = [];
        for (let j = i + 1; j < lines.length; j++) {
          const t = String(lines[j] ?? '');
          if (isSeparator(t) || isH2(t) || isH3(t) || sceneHeaderRe.test(t)) break;
          const clean = t.replace(/\*/g, '').trim();
          if (clean) buf.push(clean);
        }
        const joined = buf.join(' ').replace(/\s+/g, ' ').trim();
        if (joined) heroPrompt = joined;
        continue;
      }

      // 장면 헤더
      const m = sceneHeaderRe.exec(ln);
      if (m) {
        const idNum = parseInt(m[1], 10);
        const id = pad3(idNum);
        // 다음 첫 유효한 1줄
        let prompt = '';
        for (let j = i + 1; j < lines.length; j++) {
          const t = String(lines[j] ?? '');
          if (isSeparator(t) || isH2(t) || isH3(t) || sceneHeaderRe.test(t)) break;
          const clean = t.replace(/\*/g, '').trim();
          if (clean) { prompt = clean; break; }
        }
        if (prompt) scenes.push({ idNum, id, prompt });
      }
    }

    // 제거어(Prompt)
    const remRe = buildRemoveRegex(REMOVE_WORDS_PROMPT);
    if (remRe) {
      if (heroPrompt) heroPrompt = heroPrompt.replace(remRe, '').replace(/[ \t]{2,}/g, ' ').trim();
      for (const s of scenes) s.prompt = s.prompt.replace(remRe, '').replace(/[ \t]{2,}/g, ' ').trim();
    }

    return { heroPrompt, chapters, scenes };
  }

  /* 문장 기준 자르기 (최대 1만자) */
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
      let cut = ends[0];
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

  /* 카드 렌더링 (대본) */
  function renderCards() {
    const container = $('#sp-cards');
    if (!container) return;
    container.innerHTML = '';

    let raw = $('#sp-script-input')?.value || '';
    raw = preprocessScript(raw);

    const chunks = splitCardsBySentence(raw, 10000);
    if (!chunks.length) {
      const empty = document.createElement('div');
      empty.className = 'sp-card';
      empty.textContent = '카드로 만들 텍스트가 없습니다. 대본 입력창에 텍스트를 입력해주세요.';
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
        try { await navigator.clipboard.writeText(text); } catch {}
        btn.classList.remove('sp-red');
        btn.classList.add('sp-green');
        toast('복사되었습니다.', 'success');
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

  /* 프롬프트 테이블 렌더링 (챕터 그룹 + 주인공 프롬프트 + 중복 제거) */
  function renderPromptTable() {
    const tbody = $('#sp-tbody');
    if (!tbody) return;

    let raw = $('#sp-prompt-input')?.value || '';
    raw = String(raw).replace(/\*/g, '');

    const { heroPrompt, chapters, scenes } = collectPromptRowsWithChapters(raw);

    tbody.innerHTML = '';

    if (!heroPrompt && scenes.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.style.cssText = 'color:var(--muted); text-align:center; padding:28px;';
      td.textContent = '이미지 프롬프트 입력창에서 유효한 프롬프트를 찾지 못했습니다.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    const frag = document.createDocumentFragment();

    // 주인공 프롬프트 최상단
    if (heroPrompt) {
      const tr = document.createElement('tr');
      const tdScene = document.createElement('td'); tdScene.textContent = '주인공';
      const tdPrompt = document.createElement('td');
      const div = document.createElement('div');
      div.className = 'sp-ellipsis'; div.title = heroPrompt; div.textContent = heroPrompt; div.dataset.full = heroPrompt;
      tdPrompt.appendChild(div);
      const tdCopy = document.createElement('td'); tdCopy.style.textAlign = 'right';
      const btn = document.createElement('button'); btn.className = 'sp-btn sp-btn-sm sp-red'; btn.textContent = '복사';
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(div.dataset.full || ''); } catch {}
        const ok = btn.classList.toggle('sp-green');
        btn.classList.toggle('sp-red', !ok);
        toast('복사되었습니다.', 'success');
      });
      tdCopy.appendChild(btn);
      tr.appendChild(tdScene); tr.appendChild(tdPrompt); tr.appendChild(tdCopy);
      frag.appendChild(tr);
    }

    const used = new Set();
    const sortedChapters = chapters.slice().sort((a,b)=> a.lo - b.lo || a.hi - b.hi);

    const makeRow = (id, prompt) => {
      const tr = document.createElement('tr');
      const tdScene = document.createElement('td'); tdScene.textContent = id; // 숫자만
      const tdPrompt = document.createElement('td');
      const div = document.createElement('div'); div.className = 'sp-ellipsis'; div.title = prompt; div.textContent = prompt; div.dataset.full = prompt; tdPrompt.appendChild(div);
      const tdCopy = document.createElement('td'); tdCopy.style.textAlign = 'right';
      const btn = document.createElement('button'); btn.className = 'sp-btn sp-btn-sm sp-red'; btn.textContent = '복사';
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(div.dataset.full || ''); } catch {}
        const ok = btn.classList.toggle('sp-green');
        btn.classList.toggle('sp-red', !ok);
        toast('복사되었습니다.', 'success');
      });
      tdCopy.appendChild(btn);
      tr.appendChild(tdScene); tr.appendChild(tdPrompt); tr.appendChild(tdCopy);
      return tr;
    };

    if (sortedChapters.length > 0) {
      for (const ch of sortedChapters) {
        // 챕터 라벨 (왼쪽 정렬)
        const trH = document.createElement('tr');
        const tdH = document.createElement('td');
        tdH.colSpan = 3; tdH.textContent = ch.label; tdH.style.textAlign = 'left';
        trH.appendChild(tdH);
        frag.appendChild(trH);

        const bucket = scenes
          .filter(s => s.idNum >= ch.lo && s.idNum <= ch.hi && !used.has(s.idNum))
          .sort((a,b)=> a.idNum - b.idNum);
        for (const s of bucket) { used.add(s.idNum); frag.appendChild(makeRow(s.id, s.prompt)); }
      }
    } else {
      // 챕터 없음 → 전체 오름차순
      const bucket = scenes.slice().sort((a,b)=> a.idNum - b.idNum);
      for (const s of bucket) frag.appendChild(makeRow(s.id, s.prompt));
    }

    tbody.appendChild(frag);
  }

  async function showDraftsModal() {
    $('#sp-draft-modal')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'sp-draft-modal';
    overlay.className = 'sp-modal-overlay';

    const drafts = await draftsGetAll();
    const h = (s) => (s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

    const listHtml = drafts.length === 0
      ? '<div class="empty">저장된 초안이 없습니다.</div>'
      : drafts.map(d => `
          <div class="sp-draft-item" data-id="${d.id}">
            <div class="sp-draft-meta">
              <div class="sp-draft-name">${h(d.name)}</div>
              <div class="sp-draft-date">최종 수정: ${new Date(d.updatedAt).toLocaleString('ko-KR')}</div>
            </div>
            <div class="sp-draft-actions">
              <button class="sp-btn sp-btn-sm sp-blue btn-load-draft">불러오기</button>
              <button class="sp-btn sp-btn-sm sp-red btn-delete-draft">삭제</button>
            </div>
          </div>
        `).join('');

    overlay.innerHTML = `
      <div class="sp-modal">
        <div class="sp-modal-head">
          <div class="sp-modal-title">초안 불러오기</div>
          <button class="sp-modal-close">&times;</button>
        </div>
        <div class="sp-modal-body">
          <div class="sp-draft-list">${listHtml}</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('.sp-modal-close')) closeModal();
    });

    overlay.addEventListener('click', async (e) => {
      const draftItem = e.target.closest('.sp-draft-item');
      if (!draftItem) return;

      const id = Number(draftItem.dataset.id);
      const draft = drafts.find(d => d.id === id);

      if (e.target.classList.contains('btn-load-draft')) {
        if (draft) {
          $('#sp-script-input').value = draft.data.script || '';
          $('#sp-prompt-input').value = draft.data.prompt || '';
          renderCards();
          renderPromptTable();
          toast('초안을 불러왔습니다.', 'success');
          closeModal();
        }
      }

      if (e.target.classList.contains('btn-delete-draft')) {
        if (draft && confirm(`'${draft.name}' 초안을 정말 삭제하시겠습니까?`)) {
          await draftsRemove(id);
          toast('초안을 삭제했습니다.', 'success');
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
          <div class="sp-title">대본 작업</div>
          <div class="sp-actions">
            <input id="sp-date" type="date" class="sp-date" />
            <button id="sp-save" class="sp-btn sp-green">저장</button>
            <button id="sp-load" class="sp-btn sp-gray">불러오기</button>
            <button id="sp-export" class="sp-btn sp-blue">JSON 내보내기</button>
            <button id="sp-clear" class="sp-btn sp-gray">지우기</button>
          </div>
        </div>

        <div class="sp-grid">
          <div class="sp-section">
            <div class="sp-section-head">
              <div class="sp-section-title">대본 입력창</div>
              <div class="sp-rem">
                <input id="sp-rem-script" type="text" placeholder="삭제할 단어" />
                <button id="sp-rem-script-add" class="sp-btn sp-btn-sm sp-red">제거</button>
                <button id="sp-rem-script-reset" class="sp-btn sp-btn-sm sp-gray">복구</button>
              </div>
            </div>
            <textarea id="sp-script-input" class="sp-textarea" placeholder="대본을 입력하세요..."></textarea>
            <div id="sp-cards"></div>
          </div>

          <div class="sp-section">
            <div class="sp-section-head">
              <div class="sp-section-title">이미지 프롬프트</div>
              <div class="sp-rem">
                <input id="sp-rem-prompt" type="text" placeholder="삭제할 단어" />
                <button id="sp-rem-prompt-add" class="sp-btn sp-btn-sm sp-red">제거</button>
                <button id="sp-rem-prompt-reset" class="sp-btn sp-btn-sm sp-gray">복구</button>
              </div>
            </div>
            <textarea id="sp-prompt-input" class="sp-textarea" placeholder="프롬프트를 입력하세요..."></textarea>

            <div class="sp-table-wrap">
              <table class="sp">
                <thead>
                  <tr>
                    <th>장면</th>
                    <th>이미지 프롬프트</th>
                    <th style="text-align:right;">복사</th>
                  </tr>
                </thead>
                <tbody id="sp-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    const scriptInput = $('#sp-script-input');
    const promptInput = $('#sp-prompt-input');
    if (scriptInput) scriptInput.value = '';
    if (promptInput) promptInput.value = '';

    const date = $('#sp-date');
    if (date && !date.value) date.value = todayStr();

    const recomputeAll = () => { renderCards(); renderPromptTable(); };
    const onScriptInput  = debounce(recomputeAll, 120);
    const onPromptInput  = debounce(recomputeAll, 120);

    scriptInput?.addEventListener('input', onScriptInput);
    scriptInput?.addEventListener('paste', () => setTimeout(recomputeAll, 0));
    promptInput?.addEventListener('input', onPromptInput);
    promptInput?.addEventListener('paste', () => setTimeout(recomputeAll, 0));

    $('#sp-rem-script-add')?.addEventListener('click', () => {
      const w = ($('#sp-rem-script')?.value || '').trim();
      if (w && !REMOVE_WORDS_SCRIPT.includes(w)) REMOVE_WORDS_SCRIPT.push(w);
      $('#sp-rem-script').value = '';
      renderCards();
    });
    $('#sp-rem-script')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#sp-rem-script-add').click(); }
    });
    $('#sp-rem-script-reset')?.addEventListener('click', () => {
      REMOVE_WORDS_SCRIPT = [];
      renderCards();
    });

    $('#sp-rem-prompt-add')?.addEventListener('click', () => {
      const w = ($('#sp-rem-prompt')?.value || '').trim();
      if (w && !REMOVE_WORDS_PROMPT.includes(w)) REMOVE_WORDS_PROMPT.push(w);
      $('#sp-rem-prompt').value = '';
      renderPromptTable();
    });
    $('#sp-rem-prompt')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); $('#sp-rem-prompt-add').click(); }
    });
    $('#sp-rem-prompt-reset')?.addEventListener('click', () => {
      REMOVE_WORDS_PROMPT = [];
      renderPromptTable();
    });

    $('#sp-clear')?.addEventListener('click', () => {
      if (scriptInput) scriptInput.value = '';
      if (promptInput) promptInput.value = '';
      recomputeAll();
      toast('모두 지웠습니다.', 'success');
    });

    // JSON 내보내기: 챕터/중복제거 반영
    $('#sp-export')?.addEventListener('click', () => {
      const rawPrompts = promptInput?.value || '';
      const { heroPrompt, scenes, chapters } = collectPromptRowsWithChapters(rawPrompts);

      if (!heroPrompt && scenes.length === 0) { toast('저장할 프롬프트가 없습니다.', 'warning'); return; }

      let items = [];
      if (chapters.length > 0) {
        const used = new Set();
        const sortedChapters = chapters.slice().sort((a,b)=> a.lo - b.lo || a.hi - b.hi);
        for (const ch of sortedChapters) {
          const bucket = scenes
            .filter(s => s.idNum >= ch.lo && s.idNum <= ch.hi && !used.has(s.idNum))
            .sort((a,b)=> a.idNum - b.idNum);
          for (const s of bucket) { used.add(s.idNum); items.push({ id: s.id, prompt: s.prompt, suggested_filenames: [`${s.id}.jpg`, `${s.id}.png`] }); }
        }
      } else {
        items = scenes.slice().sort((a,b)=> a.idNum - b.idNum)
          .map(s => ({ id: s.id, prompt: s.prompt, suggested_filenames: [`${s.id}.jpg`, `${s.id}.png`] }));
      }

      const payload = { version: 2, exported_at: todayStr(), count: items.length, hero_prompt: heroPrompt || '', items };
      const filename = `[${(date?.value || todayStr()).slice(5)}] ／ [${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}:${pad2(new Date().getSeconds())}] prompts.json`;
      downloadFile(filename, JSON.stringify(payload, null, 2));
      toast('JSON으로 저장했습니다.', 'success');
    });

    $('#sp-save')?.addEventListener('click', async () => {
      const defaultName = `초안 ${todayStr()} ${new Date().toTimeString().slice(0,5)}`;
      const name = window.prompt('저장할 초안의 이름을 입력하세요.', defaultName);
      if (name === null) { toast('저장이 취소되었습니다.', 'info'); return; }
      const finalName = name.trim();
      if (!finalName) { toast('초안 이름은 비워둘 수 없습니다.', 'warning'); return; }

      const scriptContent = $('#sp-script-input')?.value || '';
      const promptValue = $('#sp-prompt-input')?.value || '';

      const draft = { name: finalName, data: { script: scriptContent, prompt: promptValue }, createdAt: new Date(), updatedAt: new Date() };

      try { await draftsPut(draft); toast(`'${finalName}'(으)로 저장했습니다.`, 'success'); }
      catch(e) { console.error('Draft save failed', e); toast('저장에 실패했습니다.', 'error'); }
    });

    $('#sp-load')?.addEventListener('click', showDraftsModal);

    // 최초 렌더
    recomputeAll();
  }

  window.initializeSceneParser = function () { buildLayout('#yt-tab-script'); };
})();

export function initScript() {
  if (typeof window.initializeSceneParser === 'function') {
    window.initializeSceneParser();
  } else {
    document.addEventListener('DOMContentLoaded', () => window.initializeSceneParser?.(), { once: true });
  }
}
