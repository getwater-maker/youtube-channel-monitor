/**
 * text-splitter.js — 원래 디자인 복구 + 설명 오염 버그 픽스 + TXT 포맷 보정
 * --------------------------------------------------------------------------------
 * ✅ 원래 UI 복구 (입력칸·레이아웃 그대로)
 * ✅ 설명글 파서 엄격화: "## 유튜브 설명글" ~ "## 이미지 프롬프트(들)" 사이만, 오염 줄 제거
 * ✅ "챕터 / 대본글자수 N자 / 예상시간 [ hh:mm:ss ]" 헤더 표시
 * ✅ 카드(몰입형 오프닝/대본 01…) 타이틀 줄에 글자수·복사 버튼
 * ✅ 이미지 프롬프트 2열(좌: 썸1~3/오프닝1·움직임1/오프닝2·움직임2/챕1-1/1-2/2-1/2-2,
 *                     우: 챕3-1/3-2/4-1/4-2/5-1/5-2/6-1/6-2/7-1/7-2/8-1/8-2)
 * ✅ 라벨–값 간격 0px(밀착), 복사 버튼 유지
 * ✅ 기본정보 TXT:
 *    - "이미지 프롬프트" 항목 사이 **빈 줄 1개** 추가(가독성)
 *    - "대본" 제목 **상·하 구분선 둘 다** 출력
 *    - 오프닝과 본문 **사이 구분선 제거**
 * --------------------------------------------------------------------------------
 */

console.log('text-splitter.js (restored) start');

(function () {
  'use strict';

  // ---------------- Constants ----------------
  const READ_SPEED_CPM = 360;
  const SPLIT_LIMIT    = 10000;
  const CARD_H         = 220;

  const LEFT_LABELS = [
    '썸네일 1 :','썸네일 2 :','썸네일 3 :',
    '오프닝 1 :','움직임1 :',
    '오프닝 2 :','움직임2 :',
    '챕터 1-1 :','챕터 1-2 :','챕터 2-1 :','챕터 2-2 :'
  ];
  const RIGHT_LABELS = [
    '챕터 3-1 :','챕터 3-2 :',
    '챕터 4-1 :','챕터 4-2 :','챕터 5-1 :','챕터 5-2 :',
    '챕터 6-1 :','챕터 6-2 :','챕터 7-1 :','챕터 7-2 :','챕터 8-1 :','챕터 8-2 :'
  ];
  const ALL_LABELS = [...LEFT_LABELS, ...RIGHT_LABELS];

  // ---------------- Utils ----------------
  const $ = (sel, root=document) => root.querySelector(sel);
  const escapeRe = (s='') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const showToast = (msg, type) => {
    try { if (typeof window.toast === 'function' && window.toast !== showToast) return window.toast(msg,type); }
    catch(_) {}
    console.log('[Toast]', type||'', msg);
  };

  const today = () => {
    const d = new Date();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  const saveText = (filename, text) => {
    const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  };

  const bindCharBelow = (inputEl, counterEl) => {
    const update = () => counterEl.textContent = `${(inputEl.value||'').length.toLocaleString('ko-KR')}자`;
    inputEl.addEventListener('input', update); update();
  };

  const bindCharInlineRight = (inputEl, badgeEl) => {
    const update = () => badgeEl.textContent = `${(inputEl.value||'').length.toLocaleString('ko-KR')}자`;
    inputEl.addEventListener('input', update); update();
  };

  const getNonEmptyLines = (text) =>
    (text||'').replace(/\r\n/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean);

  const stripLeadingNumberDot = (line) => (line||'').replace(/^\s*\d+\.\s*/, '').trim();

  const tightenRow = (row) => {
    Object.assign(row.style,{
      display:'grid', gridTemplateColumns:'max-content 1fr max-content',
      gap:'0px', alignItems:'center', marginBottom:'6px'
    });
  };

  // ---------------- Parsing helpers ----------------
  function extractBetweenH2(text, startH2, endH2OrNull) {
    const lines = (text||'').replace(/\r\n/g,'\n').split('\n');
    const startRe = new RegExp(`^\\s*##\\s*${escapeRe(startH2)}\\s*$`);
    const endRe   = endH2OrNull ? new RegExp(`^\\s*##\\s*${escapeRe(endH2OrNull)}\\s*$`) : null;
    let s=-1, e=-1;
    for (let i=0;i<lines.length;i++){
      if (s === -1 && startRe.test(lines[i])) { s=i+1; continue; }
      if (s !== -1) { if (endRe ? endRe.test(lines[i]) : lines[i].startsWith('## ')) { e=i-1; break; } }
    }
    if (s === -1) return '';
    if (e === -1) e = lines.length-1;
    return lines.slice(s, e+1).join('\n');
  }

  function extractBetweenH2Prefix(text, startPrefix, endPrefixOrNull) {
    const lines = (text||'').replace(/\r\n/g,'\n').split('\n');
    const startRe = new RegExp(`^\\s*##\\s*${escapeRe(startPrefix)}(?:\\s*\\(.*?\\))?.*$`);
    const endRe   = endPrefixOrNull ? new RegExp(`^\\s*##\\s*${escapeRe(endPrefixOrNull)}.*$`) : null;
    let s=-1, e=-1;
    for (let i=0;i<lines.length;i++){
      if (s === -1 && startRe.test(lines[i])) { s=i+1; continue; }
      if (s !== -1) { if (endRe ? endRe.test(lines[i]) : lines[i].startsWith('## ')) { e=i-1; break; } }
    }
    if (s === -1) return '';
    if (e === -1) e = lines.length-1;
    return lines.slice(s, e+1).join('\n');
  }

  // Script body: "## 1장" 다음 줄 ~ 가장 이른 {썸네일/제목/설명/이미지 프롬프트} 직전
  function extractScriptBody(full) {
    const lines = (full||'').replace(/\r\n/g,'\n').split('\n');
    let start=-1;
    for (let i=0;i<lines.length;i++){ if (/^\s*##\s*1장/.test(lines[i])) { start=i+1; break; } }
    if (start===-1) return '';

    const targets = [
      /^\s*##\s*썸네일\s*문구(?:\s*5개)?\s*(?:\(|$)/,
      /^\s*##\s*썸네일(?:\s*\(.*?\))?\s*$/,
      /^\s*##\s*제목(?:\s*5개)?(?:\s*\(.*?\))?\s*$/,
      /^\s*##\s*유튜브\s*설명글(?:\s*\(.*?\))?\s*$/,
      /^\s*##\s*이미지\s*프롬프트(?:들)?(?:\s*\(.*?\))?\s*$/,
      /^\s*##\s*이미지\s*프름프트(?:들)?(?:\s*\(.*?\))?\s*$/ // 오타 허용
    ];
    let next=-1;
    for (let i=start;i<lines.length;i++){
      if (!lines[i].startsWith('##')) continue;
      if (targets.some(re => re.test(lines[i]))) { next=i; break; }
    }
    let end = (next===-1 ? lines.length-1 : next-1);
    while (end>=start && !lines[end].trim()) end--;
    let text = lines.slice(start, end+1).join('\n');
    text = text.replace(/썸네일\s*문구부터\s*이미지\s*프름프트까지\s*모두\s*입력되었습니다\.\s*/g, '');
    return text.trim();
  }

  // Opening
  const extractOpening = (full) => (extractBetweenH2Prefix(full, '몰입형 오프닝', null) || '').trim();

  // Description: strict line-scan
  function extractDescription(full) {
    const text = (full||'').replace(/\r\n/g,'\n');
    const lines = text.split('\n');

    const startRe = /^\s*##\s*유튜브\s*설명글(?:\s*\(.*?\))?\s*$/;
    let start = -1;
    for (let i=0;i<lines.length;i++){
      if (startRe.test(lines[i])) { start = i+1; break; }
    }
    if (start === -1) return ''; // 헤더 없으면 무조건 빈칸

    const endReList = [
      /^\s*##\s*이미지\s*프롬프트(?:들)?(?:\s*\(.*?\))?\s*$/,
      /^\s*##\s*이미지\s*프름프트(?:들)?(?:\s*\(.*?\))?\s*$/ // 오타 허용
    ];
    let end = lines.length - 1;
    for (let i=start;i<lines.length;i++){
      const ln = lines[i];
      if (ln.startsWith('##') && endReList.some(re => re.test(ln))) { end = i-1; break; }
    }

    let block = lines.slice(start, Math.max(start, end+1));
    while (block.length && !block[0].trim()) block.shift();
    while (block.length && !block[block.length-1].trim()) block.pop();

    // 라벨/오타/중간 H2 제거
    const labelLineRe = /^(?:썸네일|오프닝|움직임|챕터)\s*\d+(?:-[12])?\s*:\s*/i;
    block = block
      .filter(ln => !/^\s*##\s+/.test(ln))
      .filter(ln => !labelLineRe.test(ln))
      .map(ln => ln.replace(/이미지\s*프름프트/gi, '').trim());

    return block.join('\n').trim();
  }

  // Thumb/Title candidates (5 each)
  function extractThumb5(full) {
    const raw = extractBetweenH2Prefix(full,'썸네일 문구 5개','제목') ||
                extractBetweenH2(full,'썸네일 문구 5개','제목 5개') ||
                extractBetweenH2(full,'썸네일','제목') ||
                extractBetweenH2Prefix(full,'썸네일','제목 5개') || '';
    return getNonEmptyLines(raw).map(stripLeadingNumberDot).slice(0,5);
  }
  function extractTitle5(full) {
    const raw = extractBetweenH2(full,'제목 5개','유튜브 설명글') ||
                extractBetweenH2Prefix(full,'제목 5개','유튜브 설명글') ||
                extractBetweenH2(full,'제목','유튜브 설명글') || '';
    return getNonEmptyLines(raw).map(stripLeadingNumberDot).slice(0,5);
  }

  // Image prompts
  function normalizeLabel(raw) {
    if (!raw) return null;
    let s = raw.trim().replace(/\s+/g,' ');
    let m = s.match(/^(썸네일(?:프롬프트)?)\s*(\d+)$/i);
    if (m) return `썸네일 ${m[2]} :`;
    m = s.match(/^(?:몰입형)?오프닝(?:프롬프트)?\s*(\d+)$/i);
    if (m) return `오프닝 ${m[1]} :`;
    m = s.match(/^움직임\s*([12])$/i);
    if (m) return `움직임${m[1]} :`;
    m = s.match(/^챕터\s*(\d+-[12])$/i);
    if (m) return `챕터 ${m[1]} :`;
    const std = s.endsWith(':') ? s : `${s} :`;
    if (ALL_LABELS.includes(std)) return std;
    return null;
  }
  function extractImagePrompts(full) {
    const block = extractBetweenH2Prefix(full,'이미지 프롬프트들',null) ||
                  extractBetweenH2Prefix(full,'이미지 프롬프트',null) || '';
    const lines = getNonEmptyLines(block);
    const parsed = lines.map(line => {
      const m = line.match(/^(.*?)(?:\s*:\s*)(.*)$/);
      if (m) return { label: (m[1]||'').trim(), value: (m[2]||'').trim() };
      const parts = line.split(/\s+/);
      if (parts.length>1) return { label: parts[0], value: parts.slice(1).join(' ') };
      return { label: line.trim(), value: '' };
    });
    const map = new Map();
    parsed.forEach(({label,value}) => {
      const std = normalizeLabel(label);
      if (std) map.set(std, value);
    });
    return map;
  }

  // Sentence-based split preserving '---'
  function splitPreserveDashes(text) {
    const SEP='§§§SEP§§§';
    const normalized=(text||'').replace(/\r\n/g,'\n').replace(/\n?\s*---\s*\n?/g, `\n${SEP}\n`);
    let pieces;
    try { pieces = normalized.split(/(?<=[\.!\?…。！？])\s+/); }
    catch { pieces = normalized.split(/([\.!\?…。！？]\s+)/).reduce((a,c,i,arr)=>{ if(i%2===0)a.push(c+(arr[i+1]||'')); return a; },[]); }
    const out=[];
    for(const p of pieces){
      if(!p) continue;
      const parts=p.split(SEP);
      for(let i=0;i<parts.length;i++){
        const s=parts[i]; if(s) out.push(s);
        if(i<parts.length-1) out.push('---');
      }
    }
    return out.filter(s=>s.trim());
  }

  const formatDuration = (charCount) => {
    const seconds = Math.floor((charCount / READ_SPEED_CPM) * 60);
    const pad = (n) => String(n).padStart(2,'0');
    const h = Math.floor(seconds/3600), m = Math.floor((seconds%3600)/60), s = seconds%60;
    return `[ ${pad(h)}시 ${pad(m)}분 ${pad(s)}초 ]`;
  };

  // ---------------- State ----------------
  const state = {
    // inputs
    dateInput: null,
    scriptArea: null,
    refThumb: null,
    refTitle: null,

    // thumbnail/title rows
    thumbRows: [],
    titleRows: [],

    // description
    descInput: null,
    descCopyBtn: null,

    // opening & chapter
    openingInput: null,
    cards: [],
    gridMount: null,
    chapCountEl: null,
    chapTimeEl: null,

    // prompts
    leftRows: [],
    rightRows: [],

    // buttons
    btnSplit: null, btnMerge: null, btnMeta: null
  };

  // ---------------- UI builders ----------------
  const makeSection = (title) => {
    const sec=document.createElement('section');
    Object.assign(sec.style,{border:'1px solid rgba(255,255,255,.12)', borderRadius:'14px', padding:'14px', background:'rgba(255,255,255,0.02)', marginBottom:'14px'});
    if(title){ const h=document.createElement('h3'); h.textContent=title; Object.assign(h.style,{margin:'0 0 10px 0'}); sec.appendChild(h); }
    return sec;
  };

  const makeListRow4 = (index, placeholder='') => {
    const row = document.createElement('div');
    Object.assign(row.style,{display:'grid', gridTemplateColumns:'36px 1fr max-content max-content', gap:'6px', alignItems:'center', marginBottom:'6px'});
    const num=document.createElement('div'); num.textContent=`${index}.`; Object.assign(num.style,{textAlign:'right', fontWeight:'700'}); row.appendChild(num);
    const input=document.createElement('input'); input.type='text'; input.placeholder=placeholder; Object.assign(input.style,{width:'100%', padding:'8px 10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'}); row.appendChild(input);
    const count=document.createElement('div'); Object.assign(count.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)'}); row.appendChild(count);
    const btn=document.createElement('button'); btn.textContent='복사'; btn.className='btn'; Object.assign(btn.style,{padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,.18)'}); btn.addEventListener('click', async()=>{ try{await navigator.clipboard.writeText(input.value||''); showToast('복사되었습니다.','success');}catch{showToast('복사 실패','error');} }); row.appendChild(btn);
    const update=()=>count.textContent=`${(input.value||'').length.toLocaleString('ko-KR')}자`; input.addEventListener('input', update); update();
    return { row, inputEl: input };
  };

  const makeRowInput = (label, placeholder='') => {
    const row=document.createElement('div');
    Object.assign(row.style,{display:'grid', gridTemplateColumns:'max-content 1fr max-content', gap:'8px', alignItems:'center', marginBottom:'8px'});
    const l=document.createElement('div'); l.textContent=label; Object.assign(l.style,{minWidth:'90px', fontWeight:'700', opacity:.9}); row.appendChild(l);
    const input=document.createElement('input'); input.type='text'; input.placeholder=placeholder; Object.assign(input.style,{width:'100%', padding:'8px 10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'}); row.appendChild(input);
    const badge=document.createElement('div'); Object.assign(badge.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)'}); row.appendChild(badge);
    bindCharInlineRight(input, badge);
    return { row, input };
  };

  const makeCopyRowTight = (labelText) => {
    const row=document.createElement('div'); tightenRow(row);
    const label=document.createElement('div'); label.textContent=labelText; Object.assign(label.style,{fontWeight:'700', minWidth:'92px', paddingRight:'4px'});
    const input=document.createElement('input'); input.type='text'; Object.assign(input.style,{width:'100%', padding:'8px 10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'}); // 값 입력창(자동 채움)
    const btn=document.createElement('button'); btn.textContent='복사'; btn.className='btn'; Object.assign(btn.style,{marginLeft:'6px', padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,.18)'}); btn.addEventListener('click', async()=>{ try{await navigator.clipboard.writeText(input.value||''); showToast('복사되었습니다.','success');}catch{showToast('복사 실패','error');} });
    row.appendChild(label); row.appendChild(input); row.appendChild(btn);
    return { row, labelEl: label, inputEl: input };
  };

  // ---------------- Render ----------------
  const render = (root) => {
    // 상단: 날짜/다운로드
    const basic = makeSection('기본정보 & 작성대본');
    const header = document.createElement('div'); Object.assign(header.style,{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', marginBottom:'10px'});
    const leftControls = document.createElement('div'); Object.assign(leftControls.style,{display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap'});
    const dateWrap = document.createElement('div'); Object.assign(dateWrap.style,{display:'flex', alignItems:'center', gap:'6px'});
    const dateLbl = document.createElement('label'); dateLbl.textContent='업로드 날짜';
    const dateInput = document.createElement('input'); dateInput.type='date'; dateInput.value=today(); Object.assign(dateInput.style,{height:'32px', padding:'2px 8px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
    dateWrap.appendChild(dateLbl); dateWrap.appendChild(dateInput);
    const btnSplit = document.createElement('button'); btnSplit.textContent='대본다운(분할)'; btnSplit.className='btn btn-primary';
    const btnMerge = document.createElement('button'); btnMerge.textContent='대본다운(통합)'; btnMerge.className='btn'; Object.assign(btnMerge.style,{border:'1px solid rgba(255,255,255,.18)'});
    leftControls.appendChild(dateWrap); leftControls.appendChild(btnSplit); leftControls.appendChild(btnMerge);
    const btnMeta = document.createElement('button'); btnMeta.textContent='기본정보 다운'; btnMeta.className='btn btn-primary';
    header.appendChild(leftControls); header.appendChild(btnMeta); basic.appendChild(header);

    // 본문 그리드
    const grid = document.createElement('div'); Object.assign(grid.style,{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', alignItems:'stretch'}); basic.appendChild(grid);

    // 좌측: 참고/썸/제/설
    const left = document.createElement('div'); Object.assign(left.style,{display:'grid', gridAutoRows:'max-content', gap:'12px'}); grid.appendChild(left);

    // 참고값
    const refSec = makeSection('참고값');
    const refThumbRow = makeRowInput('참고썸네일', '참고용 썸네일'); refSec.appendChild(refThumbRow.row);
    const refTitleRow = makeRowInput('참고제목', '참고용 제목'); refSec.appendChild(refTitleRow.row);
    left.appendChild(refSec);

    // 썸네일 후보 5
    const thumbSec = makeSection('썸네일 후보(5개)');
    const thumbWrap = document.createElement('div'); Object.assign(thumbWrap.style,{border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)'});
    const thumbRows=[]; for (let i=1;i<=5;i++){ const r=makeListRow4(i,'썸네일 문구'); thumbRows.push(r); thumbWrap.appendChild(r.row); }
    thumbSec.appendChild(thumbWrap); left.appendChild(thumbSec);

    // 제목 후보 5
    const titleSec = makeSection('제목 후보(5개)');
    const titleWrap = document.createElement('div'); Object.assign(titleWrap.style,{border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)'});
    const titleRows=[]; for (let i=1;i<=5;i++){ const r=makeListRow4(i,'제목 문구'); titleRows.push(r); titleWrap.appendChild(r.row); }
    titleSec.appendChild(titleWrap); left.appendChild(titleSec);

    // 설명
    const descSec = document.createElement('div'); Object.assign(descSec.style,{border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)'});
    const descHead = document.createElement('div'); Object.assign(descHead.style,{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px'});
    const descLbl = document.createElement('div'); descLbl.textContent='설명'; Object.assign(descLbl.style,{fontWeight:'700'});
    const descCopy = document.createElement('button'); descCopy.textContent='복사'; descCopy.className='btn'; Object.assign(descCopy.style,{padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,.18)'}); descHead.appendChild(descLbl); descHead.appendChild(descCopy);
    const descInput = document.createElement('textarea'); descInput.rows=4; Object.assign(descInput.style,{width:'100%', resize:'vertical', padding:'10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
    const descCount = document.createElement('div'); Object.assign(descCount.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)', marginTop:'4px'});
    bindCharBelow(descInput, descCount);
    descCopy.addEventListener('click', async()=>{ try{await navigator.clipboard.writeText(descInput.value||''); showToast('설명 복사 완료','success');}catch{showToast('복사 실패','error');} });
    descSec.appendChild(descHead); descSec.appendChild(descInput); descSec.appendChild(descCount); left.appendChild(descSec);

    // 우측: 작성대본
    const scriptSec = makeSection('작성대본'); Object.assign(scriptSec.style,{display:'flex', flexDirection:'column'});
    const scriptArea = document.createElement('textarea'); scriptArea.placeholder='여기에 전체 원문을 붙여넣으면 자동으로 구간을 추출합니다.'; Object.assign(scriptArea.style,{width:'100%', minHeight:'280px', resize:'vertical', padding:'12px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
    const scriptCount = document.createElement('div'); Object.assign(scriptCount.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)', marginTop:'4px'}); bindCharBelow(scriptArea, scriptCount);
    scriptSec.appendChild(scriptArea); scriptSec.appendChild(scriptCount); grid.appendChild(scriptSec);

    // 이미지 프롬프트 (라벨-값 간격 0)
    const promptSec = makeSection('이미지 프롬프트');
    const twoCol = document.createElement('div'); Object.assign(twoCol.style,{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}); promptSec.appendChild(twoCol);
    const leftCol=document.createElement('div'), rightCol=document.createElement('div');
    [leftCol,rightCol].forEach(c=>Object.assign(c.style,{border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)'}));
    const leftRows=[], rightRows=[];
    LEFT_LABELS.forEach(l=>{ const r=makeCopyRowTight(l); leftRows.push(r); leftCol.appendChild(r.row); });
    RIGHT_LABELS.forEach(l=>{ const r=makeCopyRowTight(l); rightRows.push(r); rightCol.appendChild(r.row); });
    twoCol.appendChild(leftCol); twoCol.appendChild(rightCol);

    // 챕터
    const chapSec = makeSection('');
    const headRow = document.createElement('div'); Object.assign(headRow.style,{display:'flex', alignItems:'center', justifyContent:'flex-start', gap:'10px', marginBottom:'10px'});
    const chapTitle = document.createElement('div'); chapTitle.textContent='챕터'; Object.assign(chapTitle.style,{fontWeight:'800'});
    const chapCount = document.createElement('div'); chapCount.textContent=' / 대본글자수 0자'; Object.assign(chapCount.style,{fontWeight:'800', color:'var(--muted,#9aa4b2)'});
    const chapTime = document.createElement('div'); chapTime.textContent=' / 예상시간 [ 00시 00분 00초 ]'; Object.assign(chapTime.style,{fontWeight:'800', color:'var(--muted,#9aa4b2)'});
    headRow.appendChild(chapTitle); headRow.appendChild(chapCount); headRow.appendChild(chapTime); chapSec.appendChild(headRow);

    const cardsGrid = document.createElement('div'); Object.assign(cardsGrid.style,{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px', alignItems:'stretch'});
    const openingCard = document.createElement('div'); Object.assign(openingCard.style,{border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)', display:'flex', flexDirection:'column'});
    const openingHead = document.createElement('div'); Object.assign(openingHead.style,{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px'});
    const openingTitle = document.createElement('div'); openingTitle.textContent='몰입형 오프닝'; Object.assign(openingTitle.style,{fontWeight:'700'});
    const openingMeta = document.createElement('div'); const openingCnt = document.createElement('span'); const openingCopy = document.createElement('button'); openingCopy.textContent='내용복사'; openingCopy.className='btn'; Object.assign(openingCopy.style,{padding:'4px 8px', borderRadius:'999px', border:'1px solid rgba(255,255,255,.18)', marginLeft:'8px'});
    openingMeta.appendChild(openingCnt); openingMeta.appendChild(openingCopy); openingHead.appendChild(openingTitle); openingHead.appendChild(openingMeta);
    const openingTA = document.createElement('textarea'); Object.assign(openingTA.style,{width:'100%', height:`${CARD_H}px`, padding:'10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit', resize:'none'});
    openingCard.appendChild(openingHead); openingCard.appendChild(openingTA);
    cardsGrid.appendChild(openingCard);
    const dynMount = document.createElement('div'); dynMount.style.display='contents'; cardsGrid.appendChild(dynMount);
    chapSec.appendChild(cardsGrid);

    // Mount order
    root.innerHTML=''; root.appendChild(basic); root.appendChild(promptSec); root.appendChild(chapSec);

    // --------- keep state ---------
    state.dateInput=dateInput; state.scriptArea=scriptArea;
    state.refThumb=refThumbRow.input; state.refTitle=refTitleRow.input;
    state.thumbRows=thumbRows; state.titleRows=titleRows;
    state.descInput=descInput; state.descCopyBtn=descCopy;
    state.openingInput=openingTA; state.gridMount=dynMount; state.cards=[];
    state.leftRows=leftRows; state.rightRows=rightRows;
    state.chapCountEl=chapCount; state.chapTimeEl=chapTime;
    state.btnSplit=btnSplit; state.btnMerge=btnMerge; state.btnMeta=btnMeta;

    // opening count
    const refreshOpeningMeta = () => { openingCnt.textContent = ` / ${(state.openingInput.value||'').length.toLocaleString('ko-KR')}자`; };
    state.openingInput.addEventListener('input', refreshOpeningMeta); refreshOpeningMeta();

    // --------- logic ---------
    function rebuildSplitCards(combinedBody){
      state.cards=[]; state.gridMount.innerHTML='';
      if(!combinedBody || !combinedBody.trim()){
        const empty=document.createElement('div'); Object.assign(empty.style,{gridColumn:'1 / -1', border:'1px dashed rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', color:'var(--muted,#9aa4b2)'}); empty.textContent='대본 본문이 없습니다.';
        state.gridMount.appendChild(empty); return;
      }
      const sentences=splitPreserveDashes(combinedBody);
      const chunks=[]; let buf='';
      for(const s0 of sentences){
        const piece=(s0==='---')?'\n\n---\n\n':s0;
        const candidate = buf ? (piece==='\n\n---\n\n' ? (buf.replace(/\s*$/,'')+'\n\n---\n\n') : (buf+(buf.endsWith('\n')?'':' ')+piece)) : piece;
        if(buf.length && candidate.length>SPLIT_LIMIT){ chunks.push(buf.trim()); buf=piece; } else { buf=candidate; }
      }
      if(buf.trim()) chunks.push(buf.trim());

      chunks.forEach((text, idx)=>{
        const card=document.createElement('div'); Object.assign(card.style,{border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)', display:'flex', flexDirection:'column'});
        const head=document.createElement('div'); Object.assign(head.style,{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px'});
        const ttl=document.createElement('div'); ttl.textContent=`대본 ${String(idx+1).padStart(2,'0')}`; Object.assign(ttl.style,{fontWeight:'700'});
        const meta=document.createElement('div'); const cnt=document.createElement('span'); const btn=document.createElement('button'); btn.textContent='내용복사'; btn.className='btn'; Object.assign(btn.style,{padding:'4px 8px', borderRadius:'999px', border:'1px solid rgba(255,255,255,.18)', marginLeft:'8px'});
        meta.appendChild(cnt); meta.appendChild(btn); head.appendChild(ttl); head.appendChild(meta);
        const ta=document.createElement('textarea'); ta.value=text; Object.assign(ta.style,{width:'100%', height:`${CARD_H}px`, padding:'10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit', resize:'none'});
        cnt.textContent=` / ${(text||'').length.toLocaleString('ko-KR')}자`;
        btn.addEventListener('click', async()=>{ try{await navigator.clipboard.writeText(text||''); showToast('복사되었습니다.','success');}catch{showToast('복사 실패','error');} });
        card.appendChild(head); card.appendChild(ta);
        state.gridMount.appendChild(card);
        state.cards.push({textarea: ta});
      });
    }

    function fillTwoColPrompts(full){
      const map=extractImagePrompts(full);
      [...state.leftRows, ...state.rightRows].forEach(r => { const key=r.labelEl.textContent.trim(); r.inputEl.value = map.get(key) || ''; });
    }

    function parseAndFillAll(){
      const full = state.scriptArea.value || '';

      // 1) 설명 — 항상 먼저, 항상 덮어쓰기 (오염 방지)
      const desc = extractDescription(full);
      state.descInput.value = desc;
      state.descInput.dispatchEvent(new Event('input'));
      if (!desc) {
        // 헤더 없으면 알림(중복 방지 위해 조용히 로그만 남겨도 됨)
        if (!/^\s*##\s*유튜브\s*설명글(?:\s*\(.*?\))?\s*$/m.test(full||'')) {
          showToast('유튜브 설명글 헤더를 찾을 수 없습니다. 설명은 자동 입력되지 않습니다.','warning');
        }
      }

      // 2) 오프닝
      const opening = extractOpening(full);
      state.openingInput.value = opening; state.openingInput.dispatchEvent(new Event('input'));

      // 3) 썸/제
      const thumbs = extractThumb5(full);
      const titles = extractTitle5(full);
      for (let i=0;i<5;i++){
        state.thumbRows[i].inputEl.value = thumbs[i] || '';
        state.thumbRows[i].inputEl.dispatchEvent(new Event('input'));
        state.titleRows[i].inputEl.value = titles[i] || '';
        state.titleRows[i].inputEl.dispatchEvent(new Event('input'));
      }

      // 4) 이미지 프롬프트
      fillTwoColPrompts(full);

      // 5) 대본/예상시간/카드
      const body = extractScriptBody(full);
      const charCount = (body||'').replace(/\n/g,'').length;
      state.chapCountEl.textContent = ` / 대본글자수 ${charCount.toLocaleString('ko-KR')}자`;
      state.chapTimeEl.textContent  = ` / 예상시간 ${formatDuration(charCount)}`;
      rebuildSplitCards(body);
    }

    // Downloads
    btnSplit.addEventListener('click', ()=> {
      if (!state.cards.length) return showToast('분할된 대본 카드가 없습니다.','error');
      const dateStr = state.dateInput.value || today();
      state.cards.forEach((c, i) => {
        const content = (c.textarea.value||'').trim(); if(!content) return;
        saveText(`${dateStr}_대본_${String(i+1).padStart(2,'0')}.txt`, content+'\n');
      });
      showToast('대본 분할 파일을 저장했습니다.','success');
    });

    btnMerge.addEventListener('click', ()=> {
      if (!state.cards.length) return showToast('분할된 대본 카드가 없습니다.','error');
      const dateStr = state.dateInput.value || today();
      const opening = (state.openingInput.value||'').trim();
      const body = state.cards.map(c => (c.textarea.value||'').trim()).filter(Boolean).join('\n\n');
      const out = (opening ? opening+'\n\n' : '') + body + '\n';
      saveText(`${dateStr}_대본_통합.txt`, out);
      showToast('대본 통합 파일을 저장했습니다.','success');
    });

    btnMeta.addEventListener('click', ()=> {
      const dateStr = state.dateInput.value || today();
      const divider = '-------------------------------------------------';
      const L = [];

      // 업로도 예정 일
      L.push(`업로도 예정 일 : ${dateStr}`);
      L.push(divider);

      // 썸네일
      L.push('썸네일 후보 5개');
      L.push(`참고썸네일 : ${state.refThumb.value || ''}`);
      for (let i=0;i<5;i++) L.push(`${i+1}. ${(state.thumbRows[i].inputEl.value||'')}`);
      L.push(divider);

      // 제목
      L.push('제목 후보 5개');
      L.push(`참고제목 : ${state.refTitle.value || ''}`);
      for (let i=0;i<5;i++) L.push(`${i+1}. ${(state.titleRows[i].inputEl.value||'')}`);
      L.push(divider);

      // 설명
      L.push('업로드시 설명글');
      L.push((state.descInput.value||'').trim());
      L.push(divider);

      // 이미지 프롬프트 (항목 사이 빈 줄)
      L.push('이미지 프롬프트');
      const ipLines=[];
      state.leftRows.forEach(({labelEl,inputEl})=>{
        const l=labelEl.textContent.trim(); const v=(inputEl.value||'').trim();
        ipLines.push(`${l}${v ? ' ' + v : ''}`.trim());
      });
      state.rightRows.forEach(({labelEl,inputEl})=>{
        const l=labelEl.textContent.trim(); const v=(inputEl.value||'').trim();
        ipLines.push(`${l}${v ? ' ' + v : ''}`.trim());
      });
      L.push(ipLines.join('\n\n'));
      L.push(divider);

      // 대본 (상/하 구분선, 오프닝-본문 사이 구분선 없음)
      L.push('대본');
      L.push(divider);
      L.push((state.openingInput.value||'').trim());
      L.push(extractScriptBody(state.scriptArea.value || ''));

      saveText(`${dateStr}_기본정보.txt`, L.join('\n'));
      showToast('기본정보 파일을 저장했습니다.','success');
    });

    // Events
    scriptArea.addEventListener('input', parseAndFillAll);
    parseAndFillAll();
  };

  // ---------------- Mount ----------------
  const ensureRoot = () => {
    let root = $('#section-text-splitter') || $('#text-splitter') || $('#tab-text-splitter') || document.getElementById('text-splitter-area');
    if (!root) {
      root = document.createElement('section'); root.id='section-text-splitter';
      const container=document.querySelector('.container')||document.body;
      const h2=document.createElement('h2'); h2.className='section-header'; h2.textContent='텍스트 분할'; root.appendChild(h2);
      container.appendChild(root);
    }
    return root;
  };

  function init(){ const root=ensureRoot(); render(root); }
  document.addEventListener('DOMContentLoaded', ()=>{ const maybe=$('#section-text-splitter')||$('#text-splitter')||$('#tab-text-splitter'); if(maybe) init(); });
  window.initializeTextSplitter = init;

})();
console.log('text-splitter.js (restored) done');
