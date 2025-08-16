/**
 * text-splitter.js — 작업 도우미
 * - 이미지 프롬프트(오프닝3/움직임3 포함)
 * - 유튜브 업로드 설명 복사/글자수, 설명 자동 높이
 * - 대본(오프닝+본문) 카드 분할/복사/예상시간
 * - 기본정보 다운(내보내기) v2
 * - 기본정보 가져오기(Import from TXT) ★신규
 */

console.log('text-splitter.js (export+import) start');

(function () {
  'use strict';

  // ===== Consts =====
  const READ_SPEED_CPM = 360;
  const SPLIT_LIMIT = 10000;
  const CARD_H = 220;

  // 프롬프트 라벨(단일 리스트 순서) — 오프닝3/움직임3 포함
  const PROMPT_LABELS = [
    '썸네일 1 :','썸네일 2 :','썸네일 3 :','썸네일 4 :','썸네일 5 :',
    '오프닝 1 :','움직임1 :',
    '오프닝 2 :','움직임2 :',
    '오프닝 3 :','움직임3 :',
    '챕터 1-1 :','챕터 1-2 :','챕터 2-1 :','챕터 2-2 :',
    '챕터 3-1 :','챕터 3-2 :','챕터 4-1 :','챕터 4-2 :','챕터 5-1 :','챕터 5-2 :',
    '챕터 6-1 :','챕터 6-2 :','챕터 7-1 :','챕터 7-2 :','챕터 8-1 :','챕터 8-2 :'
  ];

  // ===== Utils =====
  const $ = (sel, root=document) => root.querySelector(sel);
  const escapeRe = (s='') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const trimLines = (t='') => t.replace(/\r\n/g,'\n').split('\n').map(l=>l.replace(/\s+$/,'')).join('\n');

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

  const charBadge = (el) => {
    const span=document.createElement('span');
    Object.assign(span.style,{fontWeight:'700', color:'var(--muted,#9aa4b2)'});
    const update=()=> span.textContent = ` / ${(el.value||'').length.toLocaleString('ko-KR')}자`;
    el.addEventListener('input', update); update();
    return span;
  };

  const tightenRow = (row) => {
    Object.assign(row.style,{
      display:'grid',
      gridTemplateColumns:'max-content 1fr max-content',
      gap:'0px',
      alignItems:'center',
      marginBottom:'6px'
    });
  };

  const autosize = (ta) => {
    const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', fit); fit();
  };

  // ===== Parsing =====
  function extractBetweenH2(text, startH2, endH2OrNull) {
    const lines = (text||'').replace(/\r\n/g,'\n').split('\n');
    const startRe = new RegExp(`^\\s*##\\s*${escapeRe(startH2)}\\s*$`);
    const endRe   = endH2OrNull ? new RegExp(`^\\s*##\\s*${escapeRe(endH2OrNull)}\\s*$`) : null;
    let s=-1, e=-1;
    for (let i=0;i<lines.length;i++){
      if (s===-1 && startRe.test(lines[i])) { s=i+1; continue; }
      if (s!==-1) { if (endRe ? endRe.test(lines[i]) : lines[i].startsWith('## ')) { e=i-1; break; } }
    }
    if (s===-1) return '';
    if (e===-1) e=lines.length-1;
    return lines.slice(s,e+1).join('\n');
  }
  function extractBetweenH2Prefix(text, startPrefix, endPrefixOrNull) {
    const lines = (text||'').replace(/\r\n/g,'\n').split('\n');
    const startRe = new RegExp(`^\\s*##\\s*${escapeRe(startPrefix)}(?:\\s*\\(.*?\\))?.*$`);
    const endRe   = endPrefixOrNull ? new RegExp(`^\\s*##\\s*${escapeRe(endPrefixOrNull)}.*$`) : null;
    let s=-1, e=-1;
    for (let i=0;i<lines.length;i++){
      if (s===-1 && startRe.test(lines[i])) { s=i+1; continue; }
      if (s!==-1) { if (endRe ? endRe.test(lines[i]) : lines[i].startsWith('## ')) { e=i-1; break; } }
    }
    if (s===-1) return '';
    if (e===-1) e=lines.length-1;
    return lines.slice(s,e+1).join('\n');
  }

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
      if (targets.some(re=>re.test(lines[i]))){ next=i; break; }
    }
    let end = (next===-1 ? lines.length-1 : next-1);
    while (end>=start && !lines[end].trim()) end--;
    let text = lines.slice(start,end+1).join('\n');
    text = text.replace(/썸네일\s*문구부터\s*이미지\s*프름프트까지\s*모두\s*입력되었습니다\.\s*/g,'');
    return text.trim();
  }
  const extractOpening = (full) => (extractBetweenH2Prefix(full,'몰입형 오프닝',null)||'').trim();

  function extractDescription(full) {
    const text = (full||'').replace(/\r\n/g,'\n');
    const lines = text.split('\n');
    const startRe = /^\s*##\s*유튜브\s*설명글(?:\s*\(.*?\))?\s*$/;
    let start=-1;
    for (let i=0;i<lines.length;i++){ if (startRe.test(lines[i])) { start=i+1; break; } }
    if (start===-1) return '';

    const endReList = [
      /^\s*##\s*이미지\s*프롬프트(?:들)?(?:\s*\(.*?\))?\s*$/,
      /^\s*##\s*이미지\s*프름프트(?:들)?(?:\s*\(.*?\))?\s*$/ // 오타 허용
    ];
    let end = lines.length-1;
    for (let i=start;i<lines.length;i++){
      const ln=lines[i];
      if (ln.startsWith('##') && endReList.some(re=>re.test(ln))) { end=i-1; break; }
    }
    let block = lines.slice(start, Math.max(start,end+1));
    while (block.length && !block[0].trim()) block.shift();
    while (block.length && !block[block.length-1].trim()) block.pop();

    const labelLineRe = /^(?:썸네일|오프닝|움직임|챕터)\s*\d+(?:-[12])?\s*:\s*/i;
    block = block
      .filter(ln => !/^\s*##\s+/.test(ln))
      .filter(ln => !labelLineRe.test(ln))
      .map(ln => ln.replace(/이미지\s*프름프트/gi,'').trim());

    return block.join('\n').trim();
  }

  function getNonEmptyLines(text){ return (text||'').replace(/\r\n/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean); }
  const stripLeadingNumberDot = (line) => (line||'').replace(/^\s*\d+\.\s*/, '').trim();

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

  // 정규화
  function normalizeLabel(raw) {
    if (!raw) return null;
    let s = raw.trim().replace(/\s+/g,' ');
    let m = s.match(/^(썸네일(?:프롬프트)?)\s*(\d+)$/i); if (m) return `썸네일 ${m[2]} :`;
    m = s.match(/^(?:몰입형)?오프닝(?:프롬프트)?\s*(\d+)$/i); if (m) return `오프닝 ${m[1]} :`;
    m = s.match(/^움직임\s*([123])$/i); if (m) return `움직임${m[1]} :`;
    m = s.match(/^챕터\s*(\d+-[12])$/i); if (m) return `챕터 ${m[1]} :`;
    const std = s.endsWith(':') ? s : `${s} :`;
    if (PROMPT_LABELS.includes(std)) return std;
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

  // ===== State =====
  const state = {
    dateInput: null, btnMeta: null, btnImport: null, importInput: null,
    refThumb: null, refTitle: null, refUrl: null,
    scriptArea: null, descInput: null, descCopyBtn: null,
    thumbRows: [], titleRows: [],
    promptRows: [],
    chapCountEl: null, chapTimeEl: null, gridMount: null, cards: [],
  };

  // ===== UI builders =====
  const makeSection = (title) => {
    const sec=document.createElement('section');
    Object.assign(sec.style,{border:'1px solid rgba(255,255,255,.12)', borderRadius:'14px', padding:'14px', background:'rgba(255,255,255,0.02)', marginBottom:'14px'});
    if(title){ const h=document.createElement('h3'); h.textContent=title; Object.assign(h.style,{margin:'0 0 10px 0', fontWeight:'800'}); sec.appendChild(h); }
    return sec;
  };

  const makeListRow4 = (index, placeholder='') => {
    const row=document.createElement('div');
    Object.assign(row.style,{display:'grid', gridTemplateColumns:'36px 1fr max-content max-content', gap:'6px', alignItems:'center', marginBottom:'6px'});
    const num=document.createElement('div'); num.textContent=`${index}.`; Object.assign(num.style,{textAlign:'right', fontWeight:'700'});
    const input=document.createElement('input'); input.type='text'; input.placeholder=placeholder; Object.assign(input.style,{width:'100%', padding:'8px 10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
    const count=document.createElement('div'); Object.assign(count.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)'});
    const btn=document.createElement('button'); btn.textContent='복사'; btn.className='btn'; Object.assign(btn.style,{padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,.18)'});
    btn.addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText(input.value||''); showToast('복사되었습니다.','success'); } catch { showToast('복사 실패','error'); } });
    const update=()=>count.textContent=`${(input.value||'').length.toLocaleString('ko-KR')}자`; input.addEventListener('input', update); update();
    row.appendChild(num); row.appendChild(input); row.appendChild(count); row.appendChild(btn);
    return { row, inputEl: input };
  };

  const makeCopyRowTight = (labelText) => {
    const row=document.createElement('div'); tightenRow(row);
    const label=document.createElement('div'); label.textContent=labelText; Object.assign(label.style,{fontWeight:'700', minWidth:'92px', paddingRight:'4px'});
    const input=document.createElement('input'); input.type='text'; Object.assign(input.style,{width:'100%', padding:'8px 10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
    const btn=document.createElement('button'); btn.textContent='복사'; btn.className='btn'; Object.assign(btn.style,{marginLeft:'6px', padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,.18)'});
    btn.addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText(input.value||''); showToast('복사되었습니다.','success'); } catch { showToast('복사 실패','error'); } });
    row.appendChild(label); row.appendChild(input); row.appendChild(btn);
    return { row, labelEl: label, inputEl: input };
  };

  // ===== Render =====
  function render(root){
    // Header
    const header=document.createElement('div');
    Object.assign(header.style,{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px'});
    const hLeft=document.createElement('h2'); hLeft.textContent='작업 도우미'; Object.assign(hLeft.style,{margin:0, fontWeight:'900'});
    const hRight=document.createElement('div'); Object.assign(hRight.style,{display:'flex', alignItems:'center', gap:'8px'});
    const dateLabel=document.createElement('label'); dateLabel.textContent='업로드 날짜';
    const dateInput=document.createElement('input'); dateInput.type='date'; dateInput.value=today(); Object.assign(dateInput.style,{height:'32px', padding:'2px 8px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
    const btnImport=document.createElement('button'); btnImport.textContent='가져오기'; btnImport.className='btn';
    const btnMeta=document.createElement('button'); btnMeta.textContent='기본정보 다운'; btnMeta.className='btn btn-primary';
    // 숨겨진 파일 입력
    const importInput=document.createElement('input'); importInput.type='file'; importInput.accept='.txt,text/plain'; importInput.style.display='none';
    hRight.appendChild(dateLabel); hRight.appendChild(dateInput); hRight.appendChild(btnImport); hRight.appendChild(btnMeta); hRight.appendChild(importInput);
    header.appendChild(hLeft); header.appendChild(hRight);

    // 2열 그리드
    const gridTop=document.createElement('div');
    Object.assign(gridTop.style,{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', alignItems:'start'});
    const leftCol=document.createElement('div'), rightCol=document.createElement('div');
    gridTop.appendChild(leftCol); gridTop.appendChild(rightCol);

    // 좌측 — 참고영상 정보
    const refSec=makeSection('참고영상 정보');
    const table=document.createElement('div'); Object.assign(table.style,{display:'grid', gridTemplateColumns:'120px 1fr max-content', rowGap:'8px', columnGap:'8px', alignItems:'center'});
    const mkRow=(labTxt, placeholder, isUrl=false)=>{
      const lab=document.createElement('div'); lab.textContent=labTxt; Object.assign(lab.style,{fontWeight:'700'});
      const inp=document.createElement('input'); inp.type='text'; inp.placeholder=placeholder; Object.assign(inp.style,{padding:'8px 10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
      let tail;
      if(isUrl){
        tail=document.createElement('button'); tail.textContent='이동'; tail.className='btn'; Object.assign(tail.style,{padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,.18)'});
        tail.addEventListener('click', ()=>{ const u=(inp.value||'').trim(); if(!u) return showToast('주소가 비어있습니다.','warning'); window.open(u,'_blank'); });
      } else {
        tail=document.createElement('div'); Object.assign(tail.style,{fontSize:'12px', color:'var(--muted,#9aa4b2)'});
        const update=()=>tail.textContent=`${(inp.value||'').length.toLocaleString('ko-KR')}자`; inp.addEventListener('input', update); update();
      }
      table.appendChild(lab); table.appendChild(inp); table.appendChild(tail);
      return inp;
    };
    const refThumb=mkRow('썸네일','참고용 썸네일');
    const refTitle=mkRow('제목','참고용 제목');
    const refUrl=mkRow('주소','https://…', true);
    refSec.appendChild(table); leftCol.appendChild(refSec);

    // 좌측 — AI가 만든 콘텐츠
    const scriptSec=makeSection('');
    const scriptTitle=document.createElement('div'); scriptTitle.textContent='AI가 만든 콘텐츠'; Object.assign(scriptTitle.style,{fontWeight:'800', display:'inline-block'});
    const scriptArea=document.createElement('textarea'); Object.assign(scriptArea.style,{width:'100%', minHeight:'280px', padding:'12px', resize:'vertical', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
    scriptArea.placeholder='여기에 전체 원문을 붙여넣으면 자동으로 구간을 추출합니다.';
    const scriptBadge=charBadge(scriptArea);
    const titleWrap=document.createElement('div'); Object.assign(titleWrap.style,{display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px'});
    titleWrap.appendChild(scriptTitle); titleWrap.appendChild(scriptBadge);
    scriptSec.appendChild(titleWrap); scriptSec.appendChild(scriptArea);
    leftCol.appendChild(scriptSec);

    // 좌측 — 추천 썸네일 top 5
    const makeListRow4Local = makeListRow4;
    const thumbSec=makeSection('추천 썸네일 top 5');
    const tWrap=document.createElement('div'); Object.assign(tWrap.style,{border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)'});
    const thumbRows=[]; for(let i=1;i<=5;i++){ const r=makeListRow4Local(i,'썸네일 문구'); thumbRows.push(r); tWrap.appendChild(r.row); }
    thumbSec.appendChild(tWrap); leftCol.appendChild(thumbSec);

    // 좌측 — 추천 제목 top 5
    const titleSec=makeSection('추천 제목 top 5');
    const ttWrap=document.createElement('div'); Object.assign(ttWrap.style,{border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)'});
    const titleRows=[]; for(let i=1;i<=5;i++){ const r=makeListRow4Local(i,'제목 문구'); titleRows.push(r); ttWrap.appendChild(r.row); }
    titleSec.appendChild(ttWrap); leftCol.appendChild(titleSec);

    // 좌측 — 유튜브 업로드 설명
    const descSec=makeSection('');
    const descHead=document.createElement('div'); Object.assign(descHead.style,{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px'});
    const descTitle=document.createElement('div'); descTitle.textContent='유튜브 업로드 설명'; Object.assign(descTitle.style,{fontWeight:'800'});
    const descRight=document.createElement('div'); Object.assign(descRight.style,{display:'flex', alignItems:'center', gap:'8px'});
    const descCount=document.createElement('div'); Object.assign(descCount.style,{fontWeight:'700', color:'var(--muted,#9aa4b2)'});
    const descCopy=document.createElement('button'); descCopy.textContent='복사'; descCopy.className='btn'; Object.assign(descCopy.style,{padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,.18)'});
    descRight.appendChild(descCount); descRight.appendChild(descCopy);
    descHead.appendChild(descTitle); descHead.appendChild(descRight);
    const descInput=document.createElement('textarea'); Object.assign(descInput.style,{width:'100%', padding:'10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit', overflow:'hidden', resize:'none'});
    const updateDesc=()=>{ descCount.textContent=`${(descInput.value||'').length.toLocaleString('ko-KR')}자`; autosize(descInput); };
    descInput.addEventListener('input', updateDesc); updateDesc();
    descCopy.addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText(descInput.value||''); showToast('복사되었습니다.','success'); } catch { showToast('복사 실패','error'); } });
    descSec.appendChild(descHead); descSec.appendChild(descInput);
    leftCol.appendChild(descSec);

    // 우측 — 이미지 프롬프트 (단일 리스트)
    const promptSec=makeSection('이미지 프롬프트');
    const list=document.createElement('div'); Object.assign(list.style,{display:'grid', gridTemplateColumns:'1fr', gap:'8px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)'});
    const promptRows=[];
    PROMPT_LABELS.forEach(lab=>{
      const row=document.createElement('div'); tightenRow(row);
      const label=document.createElement('div'); label.textContent=lab; Object.assign(label.style,{fontWeight:'700', minWidth:'92px', paddingRight:'4px'});
      const input=document.createElement('input'); input.type='text'; Object.assign(input.style,{width:'100%', padding:'8px 10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit'});
      const btn=document.createElement('button'); btn.textContent='복사'; btn.className='btn'; Object.assign(btn.style,{marginLeft:'6px', padding:'6px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,.18)'});
      btn.addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText(input.value||''); showToast('복사되었습니다.','success'); } catch { showToast('복사 실패','error'); } });
      row.appendChild(label); row.appendChild(input); row.appendChild(btn);
      list.appendChild(row);
      promptRows.push({labelEl:label, inputEl:input});
    });
    promptSec.appendChild(list);
    rightCol.appendChild(promptSec);

    // 하단 — 대본
    const scriptBottom=makeSection('');
    const rowHead=document.createElement('div'); Object.assign(rowHead.style,{display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px'});
    const dTitle=document.createElement('div'); dTitle.textContent='대본'; Object.assign(dTitle.style,{fontWeight:'800'});
    const dCount=document.createElement('div'); dCount.textContent=' / 대본글자수 0자'; Object.assign(dCount.style,{fontWeight:'800', color:'var(--muted,#9aa4b2)'});
    const dTime=document.createElement('div'); dTime.textContent=' / 예상시간 [ 00시 00분 00초 ]'; Object.assign(dTime.style,{fontWeight:'800', color:'var(--muted,#9aa4b2)'});
    rowHead.appendChild(dTitle); rowHead.appendChild(dCount); rowHead.appendChild(dTime);
    const cardsGrid=document.createElement('div'); Object.assign(cardsGrid.style,{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px', alignItems:'stretch'});
    const mount=document.createElement('div'); mount.style.display='contents'; cardsGrid.appendChild(mount);
    scriptBottom.appendChild(rowHead); scriptBottom.appendChild(cardsGrid);

    // 루트 조립
    const container=document.createElement('section');
    Object.assign(container.style,{border:'1px solid rgba(255,255,255,.12)', borderRadius:'14px', padding:'14px', background:'rgba(255,255,255,0.02)', marginBottom:'14px'});
    root.innerHTML=''; root.appendChild(container);
    container.appendChild(header); container.appendChild(gridTop);
    root.appendChild(scriptBottom);

    // 상태 저장
    state.dateInput=dateInput; state.btnMeta=btnMeta; state.btnImport=btnImport; state.importInput=importInput;
    state.refThumb=refThumb; state.refTitle=refTitle; state.refUrl=refUrl;
    state.scriptArea=scriptArea; state.descInput=descInput; state.descCopyBtn=descCopy;
    state.thumbRows=thumbRows; state.titleRows=titleRows;
    state.promptRows=promptRows;
    state.chapCountEl=dCount; state.chapTimeEl=dTime; state.gridMount=mount; state.cards=[];

    // ===== 기능함수 =====
    const fillPrompts = (full) => {
      const map=extractImagePrompts(full);
      state.promptRows.forEach(r => { const key=r.labelEl.textContent.trim(); r.inputEl.value = map.get(key) || ''; });
    };

    const rebuildCards = (combined) => {
      state.cards=[]; state.gridMount.innerHTML='';
      if (!combined || !combined.trim()) {
        const empty=document.createElement('div'); Object.assign(empty.style,{gridColumn:'1 / -1', border:'1px dashed rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', color:'var(--muted,#9aa4b2)'}); empty.textContent='대본 텍스트가 없습니다.'; state.gridMount.appendChild(empty); return;
      }
      const sentences=splitPreserveDashes(combined);
      const chunks=[]; let buf='';
      for (const s0 of sentences){
        const piece=(s0==='---')?'\n\n---\n\n':s0;
        const candidate = buf ? (piece==='\n\n---\n\n' ? (buf.replace(/\s*$/,'')+'\n\n---\n\n') : (buf+(buf.endsWith('\n')?'':' ')+piece)) : piece;
        if (buf.length && candidate.length>SPLIT_LIMIT) { chunks.push(buf.trim()); buf=piece; } else { buf=candidate; }
      }
      if (buf.trim()) chunks.push(buf.trim());

      chunks.forEach((text, idx)=>{
        const card=document.createElement('div'); Object.assign(card.style,{border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'12px', background:'rgba(255,255,255,0.02)', display:'flex', flexDirection:'column'});
        const head=document.createElement('div'); Object.assign(head.style,{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px'});
        const ttl=document.createElement('div'); ttl.textContent=`대본 ${String(idx+1).padStart(2,'0')}`; Object.assign(ttl.style,{fontWeight:'700'});
        const meta=document.createElement('div'); const cnt=document.createElement('span'); cnt.textContent=` / ${(text||'').length.toLocaleString('ko-KR')}자`;
        const btn=document.createElement('button'); btn.textContent='내용복사'; btn.className='btn'; Object.assign(btn.style,{padding:'4px 8px', borderRadius:'999px', border:'1px solid rgba(255,255,255,.18)', marginLeft:'8px'});
        btn.addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText(text||''); showToast('복사되었습니다.','success'); } catch { showToast('복사 실패','error'); } });
        meta.appendChild(cnt); meta.appendChild(btn); head.appendChild(ttl); head.appendChild(meta);
        const ta=document.createElement('textarea'); ta.readOnly=true; ta.value=text; Object.assign(ta.style,{width:'100%', height:`${CARD_H}px`, padding:'10px', border:'1px solid rgba(255,255,255,.18)', borderRadius:'8px', background:'var(--panel,#151b24)', color:'inherit', resize:'none'});
        card.appendChild(head); card.appendChild(ta);
        state.gridMount.appendChild(card);
        state.cards.push({textarea: ta});
      });
    };

    function parseAll(){
      const full = state.scriptArea.value || '';

      // 설명 — 경고 토스트 없음
      const desc = extractDescription(full);
      state.descInput.value = desc;
      state.descInput.dispatchEvent(new Event('input'));

      // 썸/제
      const thumbs=extractThumb5(full), titles=extractTitle5(full);
      for(let i=0;i<5;i++){
        state.thumbRows[i].inputEl.value = thumbs[i] || '';
        state.thumbRows[i].inputEl.dispatchEvent(new Event('input'));
        state.titleRows[i].inputEl.value = titles[i] || '';
        state.titleRows[i].inputEl.dispatchEvent(new Event('input'));
      }

      // 프롬프트
      fillPrompts(full);

      // 대본 = 오프닝 + 본문
      const opening=extractOpening(full);
      const body=extractScriptBody(full);
      const combined=[opening, body].filter(Boolean).join('\n\n');
      const charCount=(combined||'').replace(/\n/g,'').length;
      state.chapCountEl.textContent = ` / 대본글자수 ${charCount.toLocaleString('ko-KR')}자`;
      state.chapTimeEl.textContent  = ` / 예상시간 ${formatDuration(charCount)}`;
      rebuildCards(combined);
    }

    // ===== 내보내기 =====
    btnMeta.addEventListener('click', ()=>{
      const dateStr = state.dateInput.value || today();
      const divider = '-------------------------------------------------';
      const L = [];

      // 업로드 예정일
      L.push(`업로드 예정일 : ${dateStr}`);
      L.push(divider);
      L.push(''); // 빈칸

      // 참고영상 정보
      L.push('참고영상 정보');
      L.push(state.refThumb.value || '');
      L.push(state.refTitle.value || '');
      L.push(state.refUrl.value   || '');
      L.push(divider);
      L.push('');

      // 추천 썸네일 top5
      L.push('추천 썸네일 top5');
      for (let i=0;i<5;i++) L.push(`${i+1}. ${(state.thumbRows[i].inputEl.value||'')}`);
      L.push(divider);
      L.push('');

      // 추천 제목 top5
      L.push('추천 제목 top5');
      for (let i=0;i<5;i++) L.push(`${i+1}. ${(state.titleRows[i].inputEl.value||'')}`);
      L.push(divider);
      L.push('');

      // 업로드 설명글
      L.push('업로드 설명글');
      L.push((state.descInput.value||'').trim());
      L.push(divider);
      L.push('');

      // 이미지 프롬프트 (한 칸 띄움)
      L.push('이미지 프롬프트');
      const ipLines=[];
      state.promptRows.forEach(({labelEl,inputEl})=>{
        const l=labelEl.textContent.trim(); const v=(inputEl.value||'').trim();
        ipLines.push(`${l}${v ? ' ' + v : ''}`.trim());
      });
      L.push(ipLines.join('\n\n'));
      L.push(divider);
      L.push('');

      // 대본 (오프닝+본문). scriptArea에는 없을 수 있으니 카드 기준이 아닌 원문 기준으로 재구성.
      const opening=extractOpening(state.scriptArea.value||'');
      const body=extractScriptBody(state.scriptArea.value||'');
      const combined=[opening, body].filter(Boolean).join('\n\n');
      L.push('대본');
      L.push(combined);

      const filename = `${dateStr}_콘텐츠정보.txt`;
      saveText(filename, L.join('\n'));
      showToast('기본정보 파일을 저장했습니다.','success');
    });

    // ===== 가져오기 =====
    btnImport.addEventListener('click', ()=> state.importInput.click());
    state.importInput.addEventListener('change', (e)=>{
      const file=e.target.files && e.target.files[0];
      if(!file) return;
      const reader=new FileReader();
      reader.onload = () => {
        try {
          importFromTxt(String(reader.result||''));
          showToast('가져오기가 완료되었습니다.','success');
        } catch (err) {
          console.error(err);
          showToast('가져오기에 실패했습니다. 포맷을 확인해주세요.','error');
        } finally {
          state.importInput.value='';
        }
      };
      reader.readAsText(file, 'utf-8');
    });

    function importFromTxt(raw) {
      const text = trimLines(raw);
      const lines = text.split('\n');

      const dividerIdx = [];
      lines.forEach((ln, i)=>{ if (/^-{5,}\s*$/.test(ln)) dividerIdx.push(i); });

      // 0) 업로드 예정일
      const dateLine = lines[0] || '';
      const mDate = dateLine.match(/업로드\s*예정일\s*:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      if (mDate) state.dateInput.value = mDate[1];

      // 편리한 슬라이스
      const sliceBlock = (startAfter, endBefore) => {
        const s = startAfter+1, e = endBefore-1;
        const blk = lines.slice(Math.max(0,s), Math.max(0,e)+1);
        // 앞뒤 빈줄 제거
        while (blk.length && !blk[0].trim()) blk.shift();
        while (blk.length && !blk[blk.length-1].trim()) blk.pop();
        return blk;
      };

      // 1) 참고영상 정보 — 첫 구분선 이후 블럭
      // 구조: (빈칸) / "참고영상 정보" / 썸네일 / 제목 / 주소
      let cursor = dividerIdx[0];
      const refBlock = sliceBlock(dividerIdx[0], dividerIdx[1]);
      const refStart = refBlock.indexOf('참고영상 정보');
      if (refStart !== -1) {
        state.refThumb.value = refBlock[refStart+1] || '';
        state.refTitle.value = refBlock[refStart+2] || '';
        state.refUrl.value   = refBlock[refStart+3] || '';
      }

      // 2) 추천 썸네일 top5
      const thumbBlock = sliceBlock(dividerIdx[1], dividerIdx[2]);
      const tIdx = thumbBlock.indexOf('추천 썸네일 top5');
      if (tIdx !== -1) {
        const list = thumbBlock.slice(tIdx+1, tIdx+6);
        for (let i=0;i<5;i++){
          const val = (list[i]||'').replace(/^\s*\d+\.\s*/, '').trim();
          state.thumbRows[i].inputEl.value = val;
          state.thumbRows[i].inputEl.dispatchEvent(new Event('input'));
        }
      }

      // 3) 추천 제목 top5
      const titleBlock = sliceBlock(dividerIdx[2], dividerIdx[3]);
      const ttIdx = titleBlock.indexOf('추천 제목 top5');
      if (ttIdx !== -1) {
        const list = titleBlock.slice(ttIdx+1, ttIdx+6);
        for (let i=0;i<5;i++){
          const val = (list[i]||'').replace(/^\s*\d+\.\s*/, '').trim();
          state.titleRows[i].inputEl.value = val;
          state.titleRows[i].inputEl.dispatchEvent(new Event('input'));
        }
      }

      // 4) 업로드 설명글
      const descBlock = sliceBlock(dividerIdx[3], dividerIdx[4]);
      const dIdx = descBlock.indexOf('업로드 설명글');
      let descText = '';
      if (dIdx !== -1) descText = descBlock.slice(dIdx+1).join('\n').trim();
      state.descInput.value = descText;
      state.descInput.dispatchEvent(new Event('input'));

      // 5) 이미지 프롬프트
      const ipBlock = sliceBlock(dividerIdx[4], dividerIdx[5]);
      const ipIdx = ipBlock.indexOf('이미지 프롬프트');
      const ipPairs = (ipIdx !== -1) ? ipBlock.slice(ipIdx+1) : [];
      // 빈 줄이 섞여 있음 → 라벨:값만 추출
      const map = new Map();
      ipPairs.forEach(line=>{
        const ln=line.trim(); if(!ln) return;
        const m = ln.match(/^(.*?):\s*(.*)$/);
        if (!m) return;
        const labelStd = normalizeLabel(m[1]);
        if (labelStd) map.set(labelStd, (m[2]||'').trim());
      });
      // UI 주입
      state.promptRows.forEach(r=>{
        const key=r.labelEl.textContent.trim();
        r.inputEl.value = map.get(key) || '';
      });

      // 6) 대본
      const scriptBlock = lines.slice(dividerIdx[5]+1);
      let scriptText = scriptBlock.join('\n');
      // 헤더가 없는 형태이므로, 파서를 위해 최소 헤더를 덧붙여 scriptArea에 구성
      const synthetic = `## 몰입형 오프닝\n\n\n## 1장\n${scriptText}\n`;
      state.scriptArea.value = synthetic;

      // 전반 재파싱(설명은 위에서 덮어썼으므로 유지)
      parseAll();

      // parseAll()은 설명을 원문에서 다시 추출하려 드니, 가져온 설명으로 다시 확정
      state.descInput.value = descText;
      state.descInput.dispatchEvent(new Event('input'));

      // 프롬프트도 원문에서 못 찾을 수 있으니 가져온 값으로 재확정
      state.promptRows.forEach(r=>{
        r.inputEl.dispatchEvent(new Event('input'));
      });
    }

    // 입력 변경 시 파싱
    state.scriptArea.addEventListener('input', parseAll);
    parseAll();
  }

  // Mount
  function ensureMount(){
    let root = $('#section-text-splitter') || $('#text-splitter') || $('#tab-text-splitter') || document.getElementById('text-splitter-area');
    if (!root) {
      root = document.createElement('section'); root.id='section-text-splitter';
      const container=document.querySelector('.container')||document.body;
      const h2=document.createElement('h2'); h2.className='section-header'; h2.textContent='텍스트 분할';
      root.appendChild(h2); container.appendChild(root);
    }
    return root;
  }
  function init(){ const root=ensureMount(); render(root); }
  document.addEventListener('DOMContentLoaded', ()=>{ const maybe=$('#section-text-splitter')||$('#text-splitter')||$('#tab-text-splitter'); if(maybe) init(); });
  window.initializeTextSplitter = init;

})();
console.log('text-splitter.js (export+import) done');
