// Text Splitter — 기본정보/작성대본 + 챕터(3열) + 문장단위 분할 + 기본정보 다운(대본 포함)
console.log('text-splitter.js 로딩 시작');

(function () {
  'use strict';

  // ---------- utils ----------
  const $ = (sel, root=document) => root.querySelector(sel);

  const showToast = (msg, type) => {
    try { if (typeof window.toast === 'function' && window.toast !== showToast) return window.toast(msg, type); }
    catch(_) {}
    alert(msg);
  };

  const today = () => {
    const d = new Date();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${m}-${dd}`;
  };

  const saveText = (filename, text) => {
    const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  };

  const bindCharBelow = (inputEl, counterEl) => {
    const update = () => counterEl.textContent = `${(inputEl.value||'').length.toLocaleString('ko-KR')}자`;
    inputEl.addEventListener('input', update); update();
  };

  const bindCharInlineRight = (inputEl, badgeEl) => {
    const update = () => badgeEl.textContent = `${(inputEl.value||'').length.toLocaleString('ko-KR')}자`;
    inputEl.addEventListener('input', update); update();
  };

  // 문장 단위로 분리하며, 챕터 구분선(---)은 보존
  function splitIntoSentencesPreserveSeparators(text) {
    const SEP = '§§§SEP§§§';
    const normalized = (text||'').replace(/\r\n/g, '\n').replace(/\n?\s*---\s*\n?/g, `\n${SEP}\n`);
    let pieces;
    try {
      pieces = normalized.split(/(?<=[\.!\?…。！？])\s+/);
    } catch {
      pieces = normalized.split(/([\.!\?…。！？]\s+)/).reduce((acc, cur, i, arr)=>{
        if (i % 2 === 0) { acc.push(cur + (arr[i+1] || '')); }
        return acc;
      }, []);
    }
    const out = [];
    for (const p of pieces) {
      if (!p) continue;
      const parts = p.split(SEP);
      for (let i=0;i<parts.length;i++){
        const s = parts[i];
        if (s) out.push(s);
        if (i < parts.length-1) out.push('---');
      }
    }
    return out.filter(s => s.trim().length > 0);
  }

  // ---------- state ----------
  const state = {
    leftStack: null,
    thumbs: [],  // [{input, badge}]
    titles: [],  // [{input, badge}]
    desc: null, descCounter: null,

    scriptSec: null,
    refUrlInput: null, refUrlBadge: null,
    scriptArea: null, scriptCounter: null,

    dateInput: null, btnSplit: null, btnMerge: null,
    gridMount: null,
    openingInput: null, openingCounter: null, // 몰입형 오프닝

    cards: [] // { title, textarea, counter }
  };

  // ---------- components ----------
  const makeSection = (title, tone='basic') => {
    const sec = document.createElement('section');
    Object.assign(sec.style, {
      border:'2px solid rgba(74,85,104,.7)',
      borderRadius:'14px',
      padding:'14px',
      background: tone==='basic' ? 'rgba(27,31,41,.5)' : 'rgba(33,38,49,.6)',
      marginBottom:'14px'
    });
    if (title) {
      const h = document.createElement('h3');
      h.textContent = title;
      Object.assign(h.style,{margin:'0 0 10px 0'});
      sec.appendChild(h);
    }
    return sec;
  };

  const makeRowInput = (prefixText, id, placeholder='') => {
    const row = document.createElement('div');
    Object.assign(row.style,{
      display:'grid',
      gridTemplateColumns:'max-content 1fr max-content',
      gap:'8px', alignItems:'center', marginBottom:'8px'
    });
    const prefix = document.createElement('div');
    prefix.textContent = prefixText;
    Object.assign(prefix.style,{minWidth:'90px', fontWeight:'700', opacity:.9});
    row.appendChild(prefix);

    const input = document.createElement('input');
    input.type='text'; input.id=id; input.placeholder=placeholder;
    Object.assign(input.style,{
      width:'100%', padding:'8px 10px',
      border:'1px solid rgba(74,85,104,.6)', borderRadius:'8px',
      background:'var(--panel,#151b24)', color:'inherit'
    });
    row.appendChild(input);

    const badge = document.createElement('div');
    Object.assign(badge.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)'});
    row.appendChild(badge);

    bindCharInlineRight(input, badge);
    return { row, input, badge };
  };

  const makeLabeledBlock = (label, id, {textarea=false, rows=3, placeholder=''}={}) => {
    const wrap = document.createElement('div');
    Object.assign(wrap.style,{
      border:'1px solid rgba(74,85,104,.6)',
      borderRadius:'12px',
      padding:'12px', background:'rgba(255,255,255,0.02)'
    });

    const lbl = document.createElement('div');
    lbl.textContent = label;
    Object.assign(lbl.style,{fontWeight:'700', marginBottom:'8px'});
    wrap.appendChild(lbl);

    const input = document.createElement(textarea ? 'textarea':'input');
    if (!textarea) input.type='text';
    if (textarea) { input.rows = rows; input.style.resize='vertical'; }
    input.id = id; input.placeholder=placeholder;
    Object.assign(input.style,{
      width:'100%', padding: textarea?'10px':'8px 10px',
      border:'1px solid rgba(74,85,104,.6)', borderRadius:'8px',
      background:'var(--panel,#151b24)', color:'inherit', lineHeight:'1.5'
    });
    wrap.appendChild(input);

    const counter = document.createElement('div');
    Object.assign(counter.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)', marginTop:'4px'});
    wrap.appendChild(counter);

    bindCharBelow(input, counter);
    return { wrap, input, counter };
  };

  // ---------- parsing ----------
  // '# 제목'은 챕터 시작 / '##' 줄은 삭제
  const parseChapters = (text) => {
    const lines = (text||'').replace(/\r\n/g,'\n').split('\n');
    const chapters=[]; let curTitle=null, curBody=[];
    const push = () => {
      if (curTitle===null) return;
      while (curBody.length && curBody[curBody.length-1].trim()==='') curBody.pop();
      chapters.push({
        title: curTitle.trim(),
        text: curBody.filter(ln => !/^\s*##\s*/.test(ln)).join('\n').trim()
      });
      curTitle=null; curBody=[];
    };
    for (const ln of lines){
      if (/^\s*##\s*/.test(ln)) continue;
      const m = ln.match(/^\s*#\s*(.+)$/);
      if (m){ push(); curTitle=m[1]; continue; }
      if (curTitle!==null) curBody.push(ln);
    }
    push();
    return chapters;
  };

  // ---------- render ----------
  const render = (root) => {
    // 섹션 1: 기본정보 & 작성대본
    const basicSec = makeSection('기본정보 & 작성대본', 'basic');

    // 헤더 행: 좌측 타이틀, 우측 [기본정보 다운]
    const basicHeader = document.createElement('div');
    Object.assign(basicHeader.style,{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', marginBottom:'10px'});
    const basicTitle = basicSec.querySelector('h3');
    basicHeader.appendChild(basicTitle);
    const metaBtn = document.createElement('button');
    metaBtn.textContent='기본정보 다운';
    metaBtn.className='btn btn-primary';
    Object.assign(metaBtn.style,{padding:'8px 12px', borderRadius:'8px'});
    basicHeader.appendChild(metaBtn);
    basicSec.prepend(basicHeader);

    const basicGrid = document.createElement('div');
    Object.assign(basicGrid.style,{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px'});
    basicSec.appendChild(basicGrid);

    // 왼쪽 스택(썸네일/제목/설명글)
    const left = document.createElement('div');
    Object.assign(left.style,{display:'grid', gridAutoRows:'max-content', gap:'12px'});
    basicGrid.appendChild(left);

    // 썸네일 4칸
    const thumbSec = makeSection('썸네일문구', 'basic');
    const th0 = makeRowInput('참고썸네일', 'ts-thumb-0', '참고용 썸네일 문구');
    const th1 = makeRowInput('1.', 'ts-thumb-1', '');
    const th2 = makeRowInput('2.', 'ts-thumb-2', '');
    const th3 = makeRowInput('3.', 'ts-thumb-3', '');
    [th0, th1, th2, th3].forEach(x => thumbSec.appendChild(x.row));
    left.appendChild(thumbSec);

    // 제목 4칸
    const titleSec = makeSection('제목', 'basic');
    const ti0 = makeRowInput('참고제목', 'ts-title-0', '참고용 제목');
    const ti1 = makeRowInput('1.', 'ts-title-1', '');
    const ti2 = makeRowInput('2.', 'ts-title-2', '');
    const ti3 = makeRowInput('3.', 'ts-title-3', '');
    [ti0, ti1, ti2, ti3].forEach(x => titleSec.appendChild(x.row));
    left.appendChild(titleSec);

    // 설명글
    const { wrap:descWrap, input:descInput, counter:descCounter } =
      makeLabeledBlock('설명글', 'ts-desc', {textarea:true, rows:4, placeholder:'영상 설명글'});
    left.appendChild(descWrap);

    // 우측: 작성대본 섹션 (참고영상주소 → textarea)
    const scriptSec = makeSection('작성대본', 'basic');

    const refRow = document.createElement('div');
    Object.assign(refRow.style,{display:'grid', gridTemplateColumns:'max-content 1fr max-content', gap:'8px', alignItems:'center', marginBottom:'8px'});
    const refLbl = document.createElement('div'); refLbl.textContent='참고영상주소'; Object.assign(refLbl.style,{minWidth:'90px', fontWeight:'700', opacity:.9});
    const refInput = document.createElement('input'); refInput.type='text';
    Object.assign(refInput.style,{width:'100%', padding:'8px 10px', border:'1px solid rgba(74,85,104,.6)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
    const refBadge = document.createElement('div'); Object.assign(refBadge.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)'});
    refRow.appendChild(refLbl); refRow.appendChild(refInput); refRow.appendChild(refBadge);
    scriptSec.appendChild(refRow);
    bindCharInlineRight(refInput, refBadge);

    const scriptArea = document.createElement('textarea');
    scriptArea.rows = 18;
    scriptArea.placeholder = '여기에 대본 전체를 붙여넣으세요.\n# 로 시작하는 줄은 챕터 제목, ## 로 시작하는 줄은 삭제됩니다.';
    Object.assign(scriptArea.style,{width:'100%', resize:'none', padding:'12px', border:'1px solid rgba(74,85,104,.6)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
    scriptSec.appendChild(scriptArea);

    const scriptCounter = document.createElement('div');
    Object.assign(scriptCounter.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)', marginTop:'4px'});
    scriptSec.appendChild(scriptCounter);
    bindCharBelow(scriptArea, scriptCounter);

    basicGrid.appendChild(scriptSec);

    // 섹션 2: 챕터 (한 줄 헤더: 챕터 · 날짜 · 버튼들)
    const chapSec = makeSection('', 'chapters');
    const headRow = document.createElement('div');
    Object.assign(headRow.style,{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', marginBottom:'10px'});

    const leftHead = document.createElement('div');
    leftHead.textContent='챕터';
    Object.assign(leftHead.style,{fontWeight:'800'});
    headRow.appendChild(leftHead);

    const rightHead = document.createElement('div');
    Object.assign(rightHead.style,{display:'flex', alignItems:'center', gap:'10px', whiteSpace:'nowrap'});

    const dateWrap = document.createElement('div');
    Object.assign(dateWrap.style,{display:'flex', alignItems:'center', gap:'6px'});
    const dateLbl = document.createElement('label'); dateLbl.textContent='업로드 날짜';
    const dateInput = document.createElement('input'); dateInput.type='date'; dateInput.value=today();
    Object.assign(dateInput.style,{height:'32px', padding:'2px 8px', border:'1px solid rgba(74,85,104,.6)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
    dateWrap.appendChild(dateLbl); dateWrap.appendChild(dateInput);
    rightHead.appendChild(dateWrap);

    const btnSplit = document.createElement('button');
    btnSplit.textContent='대본다운(분할)';
    btnSplit.className='btn btn-primary';
    Object.assign(btnSplit.style,{padding:'8px 12px', borderRadius:'8px'});
    rightHead.appendChild(btnSplit);

    const btnMerge = document.createElement('button');
    btnMerge.textContent='대본다운(통합)';
    btnMerge.className='btn';
    Object.assign(btnMerge.style,{padding:'8px 12px', borderRadius:'8px', border:'1px solid rgba(74,85,104,.6)'});
    rightHead.appendChild(btnMerge);

    headRow.appendChild(rightHead);
    chapSec.appendChild(headRow);

    const grid = document.createElement('div');
    Object.assign(grid.style,{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px'});
    chapSec.appendChild(grid);

    // 몰입형 오프닝
    const openingBlk = makeLabeledBlock('몰입형 오프닝', 'ts-opening', {textarea:true, rows:3, placeholder:'후에 입력'});
    grid.appendChild(openingBlk.wrap);

    // 동적 챕터 mount
    const dynMount = document.createElement('div'); dynMount.style.display='contents'; grid.appendChild(dynMount);

    // DOM 삽입
    root.innerHTML='';
    root.appendChild(basicSec);
    root.appendChild(chapSec);

    // ===== state 저장 =====
    state.leftStack = left;
    state.thumbs = [th0, th1, th2, th3].map(x => ({input:x.input, badge:x.badge}));
    state.titles = [ti0, ti1, ti2, ti3].map(x => ({input:x.input, badge:x.badge}));
    state.desc = descInput; state.descCounter = descCounter;

    state.scriptSec = scriptSec;
    state.refUrlInput = refInput; state.refUrlBadge = refBadge;
    state.scriptArea = scriptArea; state.scriptCounter = scriptCounter;

    state.dateInput = dateInput; state.btnSplit = btnSplit; state.btnMerge = btnMerge;
    state.gridMount = dynMount;
    state.openingInput = openingBlk.input; state.openingCounter = openingBlk.counter;

    // ===== 작성대본 높이 정렬(안정화) =====
    const alignScriptHeight = () => {
      try {
        const L = state.leftStack.getBoundingClientRect().height; // 좌측 전체 높이
        const secStyle = getComputedStyle(state.scriptSec);
        const padV = parseFloat(secStyle.paddingTop) + parseFloat(secStyle.paddingBottom);
        const hTitle = 24; // 섹션 타이틀 대략값(고정값으로 루프 방지)
        const hRef = refRow.getBoundingClientRect().height;
        const hCounter = state.scriptCounter.getBoundingClientRect().height;
        const target = Math.max(160, L - (hTitle + hRef + hCounter + padV + 16));
        state.scriptArea.style.height = `${target}px`;
      } catch {}
    };
    const scheduleAlign = () => requestAnimationFrame(alignScriptHeight);
    window.addEventListener('resize', scheduleAlign);
    // 좌측 입력 변화 시만 재계산 (우측 높이로 인한 루프 방지)
    [...state.thumbs, ...state.titles].forEach(x => x.input.addEventListener('input', scheduleAlign));
    state.desc.addEventListener('input', scheduleAlign);
    scheduleAlign();

    // ===== 작성대본 → 챕터 자동 생성 =====
    const rebuildChapters = () => {
      const chapters = parseChapters(state.scriptArea.value || '');
      state.cards = [];
      dynMount.innerHTML = '';

      if (!chapters.length) {
        const empty = document.createElement('div');
        Object.assign(empty.style,{gridColumn:'1 / -1', border:'1px dashed rgba(74,85,104,.6)', borderRadius:'12px', padding:'12px', color:'var(--muted,#9aa4b2)'});
        empty.textContent = '작성대본에 "# 제목" 줄을 넣으면 자동으로 챕터가 생성됩니다.';
        dynMount.appendChild(empty);
        return;
      }

      chapters.forEach(ch => {
        const card = document.createElement('div');
        Object.assign(card.style,{border:'1px solid rgba(74,85,104,.6)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)'});

        const title = document.createElement('div');
        title.textContent = ch.title; // 접두사 없음
        Object.assign(title.style,{fontWeight:'700', marginBottom:'8px'});
        card.appendChild(title);

        const ta = document.createElement('textarea');
        ta.rows = 6; ta.value = ch.text || '';
        Object.assign(ta.style,{width:'100%', padding:'10px', border:'1px solid rgba(74,85,104,.6)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit', resize:'vertical'});
        card.appendChild(ta);

        const counter = document.createElement('div');
        Object.assign(counter.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)', marginTop:'4px'});
        card.appendChild(counter);
        bindCharBelow(ta, counter);

        dynMount.appendChild(card);
        state.cards.push({ title: ch.title, textarea: ta, counter });
      });
    };
    state.scriptArea.addEventListener('input', rebuildChapters);
    rebuildChapters();

    // ===== 기본정보 다운 =====
    metaBtn.addEventListener('click', () => {
      const dateStr = state.dateInput.value || today();

      // [썸네일문구]
      const tVals = state.thumbs.map(x=>x.input.value.trim());
      const thumbLines = [];
      if (tVals[0]) thumbLines.push(`참고썸네일: ${tVals[0]}`);
      if (tVals[1]) thumbLines.push(`1. ${tVals[1]}`);
      if (tVals[2]) thumbLines.push(`2. ${tVals[2]}`);
      if (tVals[3]) thumbLines.push(`3. ${tVals[3]}`);
      const secThumb = thumbLines.length ? `[썸네일문구]\n${thumbLines.join('\n')}` : '';

      // [제목]
      const sVals = state.titles.map(x=>x.input.value.trim());
      const titleLines = [];
      if (sVals[0]) titleLines.push(`참고제목: ${sVals[0]}`);
      if (sVals[1]) titleLines.push(`1. ${sVals[1]}`);
      if (sVals[2]) titleLines.push(`2. ${sVals[2]}`);
      if (sVals[3]) titleLines.push(`3. ${sVals[3]}`);
      const secTitle = titleLines.length ? `[제목]\n${titleLines.join('\n')}` : '';

      // [설명글]
      const dVal = (state.desc.value||'').trim();
      const secDesc = dVal ? `[설명글]\n${dVal}` : '';

      // [참고영상주소]
      const ref = (state.refUrlInput.value||'').trim();
      const secRef = ref ? `[참고영상주소]\n${ref}` : '';

      // [대본(통합)] = 몰입형 오프닝 + 모든 챕터 본문
      const opening = (state.openingInput.value||'').trim();
      const bodies = [];
      if (opening) bodies.push(opening);
      state.cards.forEach(c => { const v=(c.textarea.value||'').trim(); if (v) bodies.push(v); });
      const secScript = bodies.length ? `[대본(통합)]\n${bodies.join('\n\n---\n\n')}` : '';

      const parts = [secThumb, secTitle, secDesc, secRef, secScript].filter(Boolean);
      if (!parts.length) return showToast('내보낼 내용이 없습니다.', 'warn');
      const content = parts.join('\n\n---\n\n') + '\n';

      saveText(`${dateStr}_기본정보.txt`, content);
      showToast('기본정보 파일을 저장했습니다.', 'success');
    });

    // ===== 대본다운(분할) — 문장 단위 10,000자 =====
    btnSplit.addEventListener('click', () => {
      if (!state.cards.length) return showToast('생성된 챕터가 없습니다.', 'error');
      const dateStr = state.dateInput.value || today();

      // 공통 헤더(날짜 제외)
      const headerParts = [];
      const thumbs = state.thumbs.map(x=>x.input.value.trim()).filter(Boolean);
      const titles = state.titles.map(x=>x.input.value.trim()).filter(Boolean);
      if (thumbs.length){
        headerParts.push('썸네일문구:');
        if (thumbs[0]) headerParts.push(`- ${thumbs[0]}`);
        thumbs.slice(1).forEach((v,i)=> headerParts.push(`- ${i+1}. ${v}`));
      }
      if (titles.length){
        headerParts.push('제목:');
        if (titles[0]) headerParts.push(`- ${titles[0]}`);
        titles.slice(1).forEach((v,i)=> headerParts.push(`- ${i+1}. ${v}`));
      }
      const desc = state.desc.value.trim(); if (desc) headerParts.push(`설명글:\n${desc}`);
      const opening = state.openingInput.value.trim(); if (opening) headerParts.push(`몰입형 오프닝:\n${opening}`);
      const headerText = headerParts.join('\n\n');

      // 본문(챕터 사이 --- 유지)
      const body = state.cards.map(c => (c.textarea.value||'').trim()).filter(Boolean).join('\n\n---\n\n');
      const sentences = splitIntoSentencesPreserveSeparators(body);

      const limit = 10000;
      const files = [];
      let buf = '';
      for (const s of sentences) {
        const add = buf.length ? (buf + (buf.endsWith('\n') ? '' : ' ') + s) : s;
        if (buf.length && add.length > limit) {
          files.push(buf.trim());
          buf = s;
        } else {
          buf = add;
        }
      }
      if (buf.trim().length) files.push(buf.trim());

      files.forEach((content, idx) => {
        const num = String(idx+1).padStart(2,'0');
        const fname = `${dateStr}_대본_${num}.txt`;
        const final = headerText ? `${headerText}\n\n${content}\n` : `${content}\n`;
        saveText(fname, final);
      });
      showToast(`총 ${files.length}개 파일로 저장했습니다.`, 'success');
    });

    // ===== 대본다운(통합) =====
    btnMerge.addEventListener('click', () => {
      if (!state.cards.length) return showToast('생성된 챕터가 없습니다.', 'error');
      const dateStr = state.dateInput.value || today();

      const headerParts = [];
      const thumbs = state.thumbs.map(x=>x.input.value.trim()).filter(Boolean);
      const titles = state.titles.map(x=>x.input.value.trim()).filter(Boolean);
      if (thumbs.length){
        headerParts.push('썸네일문구:');
        if (thumbs[0]) headerParts.push(`- ${thumbs[0]}`);
        thumbs.slice(1).forEach((v,i)=> headerParts.push(`- ${i+1}. ${v}`));
      }
      if (titles.length){
        headerParts.push('제목:');
        if (titles[0]) headerParts.push(`- ${titles[0]}`);
        titles.slice(1).forEach((v,i)=> headerParts.push(`- ${i+1}. ${v}`));
      }
      const desc = state.desc.value.trim(); if (desc) headerParts.push(`설명글:\n${desc}`);
      const opening = state.openingInput.value.trim(); if (opening) headerParts.push(`몰입형 오프닝:\n${opening}`);
      const headerText = headerParts.join('\n\n');

      const body = state.cards.map(c => (c.textarea.value||'').trim()).filter(Boolean).join('\n\n---\n\n');
      const final = headerText ? `${headerText}\n\n${body}\n` : `${body}\n`;
      const fname = `${dateStr}_대본_통합.txt`;
      saveText(fname, final);
      showToast('통합 파일로 저장했습니다.', 'success');
    });
  };

  // ---------- init ----------
  const ensureRoot = () => {
    let root = $('#section-text-splitter') || $('#text-splitter') || $('#tab-text-splitter') || document.getElementById('text-splitter-area');
    if (!root) {
      root = document.createElement('section');
      root.id='section-text-splitter';
      const container=document.querySelector('.container')||document.body;
      const h2=document.createElement('h2'); h2.className='section-header'; h2.textContent='텍스트 분할';
      root.appendChild(h2); container.appendChild(root);
    }
    return root;
  };

  function init() {
    const root = ensureRoot();
    render(root);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const maybe = $('#section-text-splitter') || $('#text-splitter') || $('#tab-text-splitter');
    if (maybe) init();
  });

  window.initializeTextSplitter = init;

})();
console.log('text-splitter.js 로딩 완료');
