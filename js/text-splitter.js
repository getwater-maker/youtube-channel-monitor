/**
 * text-splitter.js — 작업 도우미 (개선된 디자인 및 기능)
 * - 참고영상정보와 AI가 만든 콘텐츠 위치 변경
 * - AI 콘텐츠에서 원본 정보 자동 추출 및 참고영상정보에 자동 입력
 * - 업로드 날짜 상하 버튼으로 변경
 */

console.log('text-splitter.js (수정된 버전) 로딩 시작');

(function () {
  'use strict';

  /* ---------- 상수 ---------- */
  const READ_SPEED_CPM = 360;     // 분당 360자
  const SPLIT_LIMIT = 10000;      // 카드 최대 10,000자
  const CARD_H = 220;

  // 썸네일 이미지 프롬프트 라벨 (썸네일 1~5에 대응)
  const THUMB_PROMPT_LABELS = [
    '썸네일 1 :', '썸네일 2 :', '썸네일 3 :', '썸네일 4 :', '썸네일 5 :'
  ];

  // #1 블록(오프닝/움직임)
  const OPENING_PAIRS = [
    ['#1-1 :', 'ani #1-1 :'],
    ['#1-2 :', 'ani #1-2 :'],
    ['#1-3 :', 'ani #1-3 :']
  ];

  // #2 ~ #9 (각 2개씩) - #9까지 확장
  const CHAPTER_PAIRS = Array.from({length: 8}, (_,i) => {
    const k = i + 2; // 2..9
    return [`#${k}-1 :`, `#${k}-2 :`];
  });

  /* ---------- 유틸 ---------- */
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

  const downloadFile = (filename, blobOrText, mime) => {
    const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type: mime || 'text/plain;charset=utf-8' });
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

  const autosize = (ta) => {
    const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', fit); fit();
  };

  // 날짜 변경 함수
  const changeDate = (dateInput, days) => {
    const currentDate = new Date(dateInput.value || today());
    currentDate.setDate(currentDate.getDate() + days);
    const mm = String(currentDate.getMonth()+1).padStart(2,'0');
    const dd = String(currentDate.getDate()).padStart(2,'0');
    dateInput.value = `${currentDate.getFullYear()}-${mm}-${dd}`;
  };

  // 문장 분할 (--- 보존)
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

  /* ---------- 파싱 도우미 ---------- */
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
    
    // "## 1장" 또는 "## n장" 패턴을 찾아서 시작점 결정
    for (let i=0;i<lines.length;i++){ 
      if (/^\s*##\s*\d+장/.test(lines[i])) { 
        start=i+1; // 헤더 다음 줄부터 시작
        break; 
      } 
    }
    if (start===-1) return '';
    
    // 다음 섹션들을 찾아서 끝점 결정
    const targets = [
      /^\s*##\s*썸네일\s*문구(?:\s*5개)?\s*(?:\(|$)/,
      /^\s*##\s*썸네일(?:\s*\(.*?\))?\s*$/,
      /^\s*##\s*제목(?:\s*5개)?(?:\s*\(.*?\))?\s*$/,
      /^\s*##\s*유튜브\s*설명글(?:\s*\(.*?\))?\s*$/,
      /^\s*##\s*이미지\s*프롬프트(?:들)?(?:\s*\(.*?\))?\s*$/,
      /^\s*##\s*이미지\s*프림프트(?:들)?(?:\s*\(.*?\))?\s*$/ // 오타 허용
    ];
    
    let end = lines.length-1;
    for (let i=start;i<lines.length;i++){
      const ln=lines[i];
      if (ln.startsWith('##') && targets.some(re=>re.test(ln))) { 
        end=i-1; 
        break; 
      }
    }
    
    // 끝부분 공백 제거
    while (end>=start && !lines[end].trim()) end--;
    
    let text = lines.slice(start,end+1).join('\n');
    text = text.replace(/썸네일\s*문구부터\s*이미지\s*프림프트까지\s*모두\s*입력되었습니다\.\s*/g,'');
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
      /^\s*##\s*이미지\s*프림프트(?:들)?(?:\s*\(.*?\))?\s*$/ // 오타 허용
    ];
    let end = lines.length-1;
    for (let i=start;i<lines.length;i++){
      const ln=lines[i];
      if (ln.startsWith('##') && endReList.some(re=>re.test(ln))) { end=i-1; break; }
    }
    let block = lines.slice(start, Math.max(start,end+1));
    while (block.length && !block[0].trim()) block.shift();
    while (block.length && !block[block.length-1].trim()) block.pop();

    const labelLineRe = /^(?:썸네일|오프닝|움직임|챕터|ani\s*#|#)\s*.*?:/i;
    block = block
      .filter(ln => !/^\s*##\s+/.test(ln))
      .filter(ln => !labelLineRe.test(ln))
      .map(ln => ln.replace(/이미지\s*프림프트/gi,'').trim());

    return block.join('\n').trim();
  }

  // 원본 정보 추출 함수
  function extractOriginalInfo(text) {
    const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
    
    // ## 원본 정보 섹션 찾기
    let startIndex = -1;
    let endIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*##\s*원본\s*정보\s*$/i.test(lines[i])) {
        startIndex = i + 1;
        break;
      }
    }
    
    if (startIndex === -1) return { thumbnail: '', title: '', url: '' };
    
    // 다음 ## 섹션까지 또는 파일 끝까지
    for (let i = startIndex; i < lines.length; i++) {
      if (lines[i].startsWith('##') && i > startIndex) {
        endIndex = i - 1;
        break;
      }
    }
    
    if (endIndex === -1) endIndex = lines.length - 1;
    
    const originalInfoLines = lines.slice(startIndex, endIndex + 1);
    
    let thumbnail = '';
    let title = '';
    let url = '';
    
    for (const line of originalInfoLines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('- 썸네일 문구:')) {
        thumbnail = trimmedLine.replace(/^- 썸네일 문구:\s*/, '').replace(/^\[|\]$/g, '');
      } else if (trimmedLine.startsWith('- 제목:')) {
        title = trimmedLine.replace(/^- 제목:\s*/, '').replace(/^\[|\]$/g, '');
      } else if (trimmedLine.startsWith('- URL:')) {
        url = trimmedLine.replace(/^- URL:\s*/, '').replace(/^\[|\]$/g, '');
      }
    }
    
    return { thumbnail, title, url };
  }

  // 샵 하나(#)만 있는 줄 제거 함수
  function removeSingleHashLines(text) {
    return text.replace(/^#\s*$/gm, '');
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

  /**
   * 과거 라벨 → 새 라벨 표준화
   */
  function normalizeLabel(raw) {
    if (!raw) return null;
    let s = String(raw).trim().replace(/\s+/g, ' ');
    s = s.replace(/\s*:\s*$/, '').trim();

    // 썸네일 n
    let m = s.match(/^썸네일\s*(\d)$/i);
    if (m) return `썸네일 ${m[1]} :`;

    // 새 규칙 직접 표기
    if (/^#\d+-[12]$/i.test(s)) return `${s} :`;
    if (/^ani\s+#\d+-[12]$/i.test(s)) return `${s} :`;

    // 오래된 라벨 → 새 규칙으로 매핑
    m = s.match(/^오프닝\s*([1-3])$/i);
    if (m) return `#1-${m[1]} :`;
    m = s.match(/^움직임\s*([1-3])$/i);
    if (m) return `ani #1-${m[1]} :`;

    m = s.match(/^챕터\s*(\d+)-([12])$/i);
    if (m) {
      const k = parseInt(m[1], 10);
      const j = m[2];
      return `#${k + 1}-${j} :`;
    }

    const maybe = `${s} :`;
    if (THUMB_PROMPT_LABELS.includes(maybe)) return maybe;
    if (/^#\d+-[12]\s:$/.test(maybe) || /^ani\s+#\d+-[12]\s:$/.test(maybe)) return maybe;
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

  /* ---------- 상태 ---------- */
  const state = {
    dateInput: null, btnMeta: null, btnImport: null, importInput: null,
    refThumb: null, refTitle: null, refUrl: null,
    scriptArea: null, descInput: null, descCopyBtn: null,

    // 추천 썸네일/제목
    thumbRows: [], titleRows: [],
    // 썸네일 이미지 프롬프트
    thumbImageRows: [],

    // 이미지 프롬프트 (#1~#9)
    promptRows: [],

    chapCountEl: null, chapTimeEl: null, gridMount: null, cards: [],
  };

  /* ---------- 공용 UI 빌더 ---------- */

  // 복사 버튼 초록표시용 스타일을 주입(once)
  function ensureCopiedStyle() {
    if (document.getElementById('ts-copied-style')) return;
    const st = document.createElement('style');
    st.id = 'ts-copied-style';
    st.textContent = `.btn-copied{background:#16a34a!important;border-color:#16a34a!important;color:#fff!important}`;
    document.head.appendChild(st);
  }

  const makeSection = (title) => {
    const sec=document.createElement('section');
    Object.assign(sec.style,{
      border:'2px solid var(--border, #2a3443)', 
      borderRadius:'16px', 
      padding:'24px', 
      background:'var(--card, #151b24)', 
      marginBottom:'24px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    });
    if(title){ 
      const h=document.createElement('h3'); 
      h.textContent=title; 
      Object.assign(h.style,{
        margin:'0 0 20px 0', 
        fontWeight:'800',
        fontSize:'1.3rem',
        color:'var(--text, #e4e6ea)',
        borderBottom:'2px solid var(--border, #2a3443)',
        paddingBottom:'12px'
      }); 
      sec.appendChild(h); 
    }
    return sec;
  };

  // 추천 제목용 (번호/인풋/글자수/복사)
  const makeListRow4 = (index, placeholder='') => {
    ensureCopiedStyle();
    const row=document.createElement('div');
    Object.assign(row.style,{
      display:'grid', 
      gridTemplateColumns:'36px 1fr 80px max-content', 
      gap:'12px', 
      alignItems:'center', 
      marginBottom:'12px',
      padding:'12px',
      background:'var(--glass-bg, rgba(255,255,255,0.02))',
      borderRadius:'12px',
      border:'1px solid var(--border, #2a3443)'
    });
    
    const num=document.createElement('div'); 
    num.textContent=`${index}.`; 
    Object.assign(num.style,{
      textAlign:'center', 
      fontWeight:'800',
      background:'var(--brand, #c4302b)',
      color:'white',
      borderRadius:'50%',
      width:'28px',
      height:'28px',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      fontSize:'14px'
    });
    
    const input=document.createElement('input'); 
    input.type='text'; 
    input.placeholder=placeholder; 
    Object.assign(input.style,{
      width:'100%', 
      padding:'12px 16px', 
      border:'2px solid var(--border, #2a3443)', 
      borderRadius:'10px', 
      background:'var(--panel, #1e2329)', 
      color:'var(--text, #e4e6ea)',
      fontSize:'14px',
      transition:'all 0.3s ease'
    });
    
    input.addEventListener('focus', () => {
      input.style.borderColor = 'var(--brand, #c4302b)';
      input.style.boxShadow = '0 0 0 3px rgba(196, 48, 43, 0.1)';
    });
    
    input.addEventListener('blur', () => {
      input.style.borderColor = 'var(--border, #2a3443)';
      input.style.boxShadow = 'none';
    });
    
    const count=document.createElement('div'); 
    Object.assign(count.style,{
      fontSize:'12px', 
      color:'var(--muted, #9aa4b2)',
      fontWeight:'600',
      textAlign:'center'
    });
    
    const btn=document.createElement('button'); 
    btn.textContent='복사'; 
    btn.className='btn'; 
    Object.assign(btn.style,{
      padding:'8px 16px', 
      borderRadius:'8px', 
      border:'2px solid var(--border, #2a3443)',
      background:'var(--glass-bg, rgba(255,255,255,0.05))',
      color:'var(--text, #e4e6ea)',
      fontWeight:'600',
      cursor:'pointer',
      transition:'all 0.3s ease'
    });

    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(input.value||'');
        btn.classList.add('btn-copied');
        showToast('복사되었습니다.','success');
      } catch {
        showToast('복사 실패','error');
      }
    });
    
    input.addEventListener('input', () => btn.classList.remove('btn-copied'));

    const update=()=>count.textContent=`${(input.value||'').length.toLocaleString('ko-KR')}자`; 
    input.addEventListener('input', update); 
    update();
    
    row.appendChild(num); 
    row.appendChild(input); 
    row.appendChild(count); 
    row.appendChild(btn);
    return { row, inputEl: input, btnEl: btn };
  };

  // 썸네일 문구 + 이미지 프롬프트 통합 행 (새로운 레이아웃)
  const makeThumbRow = (index, placeholder='') => {
    ensureCopiedStyle();
    const container=document.createElement('div');
    Object.assign(container.style,{
      marginBottom:'16px',
      padding:'16px',
      background:'var(--glass-bg, rgba(255,255,255,0.02))',
      borderRadius:'12px',
      border:'1px solid var(--border, #2a3443)'
    });

    // 첫 번째 행: 넘버링 | 썸네일 문구 | 썸네일 문구 복사버튼
    const firstRow=document.createElement('div');
    Object.assign(firstRow.style,{
      display:'grid', 
      gridTemplateColumns:'36px 1fr max-content', 
      gap:'12px', 
      alignItems:'center', 
      marginBottom:'12px'
    });
    
    const num=document.createElement('div'); 
    num.textContent=`${index}.`; 
    Object.assign(num.style,{
      textAlign:'center', 
      fontWeight:'800',
      background:'var(--brand, #c4302b)',
      color:'white',
      borderRadius:'50%',
      width:'28px',
      height:'28px',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      fontSize:'14px'
    });
    
    const textInput=document.createElement('input'); 
    textInput.type='text'; 
    textInput.placeholder=placeholder; 
    Object.assign(textInput.style,{
      width:'100%', 
      padding:'12px 16px', 
      border:'2px solid var(--border, #2a3443)', 
      borderRadius:'10px', 
      background:'var(--panel, #1e2329)', 
      color:'var(--text, #e4e6ea)',
      fontSize:'14px',
      transition:'all 0.3s ease'
    });
    
    const textBtn=document.createElement('button'); 
    textBtn.textContent='복사'; 
    textBtn.className='btn'; 
    Object.assign(textBtn.style,{
      padding:'8px 16px', 
      borderRadius:'8px', 
      border:'2px solid var(--border, #2a3443)',
      background:'var(--glass-bg, rgba(255,255,255,0.05))',
      color:'var(--text, #e4e6ea)',
      fontWeight:'600',
      cursor:'pointer',
      transition:'all 0.3s ease'
    });

    textBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(textInput.value||'');
        textBtn.classList.add('btn-copied');
        showToast('복사되었습니다.','success');
      } catch {
        showToast('복사 실패','error');
      }
    });
    
    textInput.addEventListener('input', () => textBtn.classList.remove('btn-copied'));

    firstRow.appendChild(num); 
    firstRow.appendChild(textInput); 
    firstRow.appendChild(textBtn);

    // 두 번째 행: 썸네일 글자수 | 이미지 프롬프트 | 프롬프트 복사버튼
    const secondRow=document.createElement('div');
    Object.assign(secondRow.style,{
      display:'grid',
      gridTemplateColumns:'36px 1fr max-content',
      gap:'12px',
      alignItems:'center',
      paddingLeft:'12px'
    });
    
    const count=document.createElement('div'); 
    Object.assign(count.style,{
      fontSize:'12px', 
      color:'var(--muted, #9aa4b2)',
      fontWeight:'600',
      textAlign:'center'
    });
    
    const promptInput=document.createElement('input'); 
    promptInput.type='text'; 
    promptInput.placeholder='이미지 프롬프트';
    Object.assign(promptInput.style,{
      width:'100%', 
      padding:'6px 10px', 
      border:'1px solid var(--border, #2a3443)', 
      borderRadius:'6px', 
      background:'var(--panel, #1e2329)', 
      color:'var(--text, #e4e6ea)',
      fontSize:'12px',
      opacity:'0.8'
    });
    
    const promptBtn=document.createElement('button'); 
    promptBtn.textContent='복사'; 
    promptBtn.className='btn'; 
    Object.assign(promptBtn.style,{
      padding:'8px 16px', 
      borderRadius:'8px', 
      border:'2px solid var(--border, #2a3443)',
      background:'var(--glass-bg, rgba(255,255,255,0.05))',
      color:'var(--text, #e4e6ea)',
      fontWeight:'600',
      cursor:'pointer',
      transition:'all 0.3s ease'
    });

    promptBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(promptInput.value||'');
        promptBtn.classList.add('btn-copied');
        showToast('복사되었습니다.','success');
      } catch {
        showToast('복사 실패','error');
      }
    });
    
    promptInput.addEventListener('input', () => promptBtn.classList.remove('btn-copied'));

    const updateCount=()=>count.textContent=`${(textInput.value||'').length.toLocaleString('ko-KR')}자`; 
    textInput.addEventListener('input', updateCount); 
    updateCount();

    secondRow.appendChild(count);
    secondRow.appendChild(promptInput);
    secondRow.appendChild(promptBtn);

    container.appendChild(firstRow);
    container.appendChild(secondRow);

    return { 
      container, 
      textInput, 
      textBtn, 
      promptInput, 
      promptBtn 
    };
  };

  // 이미지 프롬프트용 컴팩트 행 (한 줄에 2개)
  const makeCompactPromptPair = (leftLabel, rightLabel) => {
    ensureCopiedStyle();
    const row=document.createElement('div');
    Object.assign(row.style,{
      display:'grid',
      gridTemplateColumns:'1fr max-content 8px 1fr max-content',
      gap:'8px',
      alignItems:'center',
      marginBottom:'6px',
      padding:'6px 8px',
      background:'var(--glass-bg, rgba(255,255,255,0.02))',
      borderRadius:'6px',
      border:'1px solid var(--border, #2a3443)'
    });
    
    const makeInput = () => {
      const inp=document.createElement('input'); 
      inp.type='text'; 
      Object.assign(inp.style,{
        width:'100%', 
        padding:'6px 8px', 
        border:'1px solid var(--border, #2a3443)', 
        borderRadius:'4px', 
        background:'var(--panel, #1e2329)', 
        color:'var(--text, #e4e6ea)',
        fontSize:'12px'
      });
      return inp;
    };
    
    const makeBtn = (input) => {
      const btn=document.createElement('button'); 
      btn.textContent='복사'; 
      btn.className='btn'; 
      Object.assign(btn.style,{
        padding:'4px 8px', 
        borderRadius:'4px', 
        border:'1px solid var(--border, #2a3443)',
        background:'var(--glass-bg, rgba(255,255,255,0.05))',
        color:'var(--text, #e4e6ea)',
        fontSize:'10px',
        fontWeight:'600'
      });

      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(input.value||'');
          btn.classList.add('btn-copied');
          showToast('복사되었습니다.','success');
        } catch {
          showToast('복사 실패','error');
        }
      });
      
      input.addEventListener('input', () => btn.classList.remove('btn-copied'));
      return btn;
    };

    const leftInput = makeInput();
    const leftBtn = makeBtn(leftInput);
    const spacer = document.createElement('div');
    const rightInput = makeInput();
    const rightBtn = makeBtn(rightInput);

    leftInput.placeholder = leftLabel.replace(' :', '');
    rightInput.placeholder = rightLabel.replace(' :', '');

    row.appendChild(leftInput);
    row.appendChild(leftBtn);
    row.appendChild(spacer);
    row.appendChild(rightInput);
    row.appendChild(rightBtn);

    return { 
      row, 
      left: { inputEl: leftInput, btnEl: leftBtn, label: leftLabel },
      right: { inputEl: rightInput, btnEl: rightBtn, label: rightLabel }
    };
  };

  /* ---------- 렌더 ---------- */
  function render(root){
    // 헤더
    const header=document.createElement('div');
    Object.assign(header.style,{
      display:'flex', 
      alignItems:'center', 
      justifyContent:'space-between', 
      marginBottom:'32px',
      padding:'24px',
      background:'var(--card, #151b24)',
      borderRadius:'16px',
      border:'2px solid var(--border, #2a3443)'
    });
    
    const hLeft=document.createElement('h2'); 
    hLeft.textContent='작업 도우미'; 
    Object.assign(hLeft.style,{
      margin:0, 
      fontWeight:'900',
      fontSize:'2rem',
      background:'linear-gradient(135deg, #c4302b, #a02622)',
      WebkitBackgroundClip:'text',
      WebkitTextFillColor:'transparent',
      backgroundClip:'text'
    });
    
    const hRight=document.createElement('div'); 
    Object.assign(hRight.style,{
      display:'flex', 
      alignItems:'center', 
      gap:'16px'
    });

    const dateLabel=document.createElement('label'); 
    dateLabel.textContent='업로드 날짜';
    Object.assign(dateLabel.style,{
      fontWeight:'600',
      color:'var(--text, #e4e6ea)'
    });
    
    // 날짜 입력 및 버튼 컨테이너
    const dateContainer=document.createElement('div');
    Object.assign(dateContainer.style,{
      display:'flex',
      alignItems:'center',
      gap:'4px'
    });
    
    const dateInput=document.createElement('input'); 
    dateInput.type='date'; 
    dateInput.value=today(); 
    Object.assign(dateInput.style,{
      height:'40px', 
      padding:'8px 12px', 
      border:'2px solid var(--border, #2a3443)', 
      borderRadius:'8px', 
      background:'var(--panel, #1e2329)', 
      color:'var(--text, #e4e6ea)',
      fontWeight:'600'
    });

    // 날짜 변경 버튼들
    const dateUpBtn=document.createElement('button');
    dateUpBtn.textContent='▲';
    Object.assign(dateUpBtn.style,{
      width:'30px',
      height:'20px',
      padding:'0',
      border:'1px solid var(--border, #2a3443)',
      borderRadius:'4px',
      background:'var(--glass-bg, rgba(255,255,255,0.05))',
      color:'var(--text, #e4e6ea)',
      cursor:'pointer',
      fontSize:'10px',
      display:'flex',
      alignItems:'center',
      justifyContent:'center'
    });
    
    const dateDownBtn=document.createElement('button');
    dateDownBtn.textContent='▼';
    Object.assign(dateDownBtn.style,{
      width:'30px',
      height:'20px',
      padding:'0',
      border:'1px solid var(--border, #2a3443)',
      borderRadius:'4px',
      background:'var(--glass-bg, rgba(255,255,255,0.05))',
      color:'var(--text, #e4e6ea)',
      cursor:'pointer',
      fontSize:'10px',
      display:'flex',
      alignItems:'center',
      justifyContent:'center'
    });

    const dateBtnContainer=document.createElement('div');
    Object.assign(dateBtnContainer.style,{
      display:'flex',
      flexDirection:'column',
      gap:'2px'
    });
    
    dateBtnContainer.appendChild(dateUpBtn);
    dateBtnContainer.appendChild(dateDownBtn);
    
    dateContainer.appendChild(dateInput);
    dateContainer.appendChild(dateBtnContainer);

    // 날짜 버튼 이벤트
    dateUpBtn.addEventListener('click', () => changeDate(dateInput, 1));
    dateDownBtn.addEventListener('click', () => changeDate(dateInput, -1));

    const btnImport=document.createElement('button'); 
    btnImport.textContent='가져오기(txt)'; 
    btnImport.className='btn btn-secondary';
    Object.assign(btnImport.style,{
      padding:'10px 20px',
      borderRadius:'8px',
      fontWeight:'600'
    });
    
    const btnMeta=document.createElement('button'); 
    btnMeta.textContent='기본정보 다운(txt)'; 
    btnMeta.className='btn btn-primary';
    Object.assign(btnMeta.style,{
      padding:'10px 20px',
      borderRadius:'8px',
      fontWeight:'600',
      background:'linear-gradient(135deg, #c4302b, #a02622)',
      border:'none',
      color:'white'
    });

    // 숨겨진 파일 입력
    const importInput=document.createElement('input'); 
    importInput.type='file'; 
    importInput.accept='.txt,text/plain'; 
    importInput.style.display='none';

    hRight.appendChild(dateLabel); 
    hRight.appendChild(dateContainer);
    hRight.appendChild(btnImport); 
    hRight.appendChild(btnMeta);
    hRight.appendChild(importInput);

    header.appendChild(hLeft); 
    header.appendChild(hRight);

    // 상단 2열
    const gridTop=document.createElement('div');
    Object.assign(gridTop.style,{
      display:'grid', 
      gridTemplateColumns:'1fr 1fr', 
      gap:'32px', 
      alignItems:'start'
    });
    const leftCol=document.createElement('div'), rightCol=document.createElement('div');
    gridTop.appendChild(leftCol); 
    gridTop.appendChild(rightCol);

    // AI가 만든 콘텐츠 (위치 변경: 왼쪽으로)
    const scriptSec=makeSection('');
    const scriptHead=document.createElement('div'); 
    Object.assign(scriptHead.style,{
      display:'flex', 
      alignItems:'center', 
      justifyContent:'space-between',
      marginBottom:'16px'
    });
    
    const scriptTitle=document.createElement('div'); 
    scriptTitle.textContent='AI가 만든 콘텐츠'; 
    Object.assign(scriptTitle.style,{
      fontWeight:'800',
      fontSize:'1.3rem',
      color:'var(--text, #e4e6ea)'
    });
    
    const scriptBadge=charBadge({value:'', addEventListener:()=>{}});
    scriptHead.appendChild(scriptTitle); 
    scriptHead.appendChild(scriptBadge);
    
    const scriptArea=document.createElement('textarea'); 
    Object.assign(scriptArea.style,{
      width:'100%', 
      minHeight:'320px', 
      padding:'16px', 
      resize:'vertical', 
      border:'2px solid var(--border, #2a3443)', 
      borderRadius:'12px', 
      background:'var(--panel, #1e2329)', 
      color:'var(--text, #e4e6ea)',
      fontSize:'14px',
      lineHeight:'1.6',
      fontFamily:'ui-monospace, SFMono-Regular, monospace'
    });
    scriptArea.placeholder='여기에 전체 원문을 붙여넣으면 자동으로 구간을 추출합니다.';
    
    // 글자수 업데이트 함수 재정의
    const updateScriptBadge = () => scriptBadge.textContent = ` / ${(scriptArea.value||'').length.toLocaleString('ko-KR')}자`;
    scriptArea.addEventListener('input', updateScriptBadge);
    updateScriptBadge();
    
    scriptSec.appendChild(scriptHead); 
    scriptSec.appendChild(scriptArea);
    leftCol.appendChild(scriptSec);

    // 참고영상 정보 (위치 변경: 오른쪽으로)
    const refSec=makeSection('참고영상 정보');
    const table=document.createElement('div'); 
    Object.assign(table.style,{
      display:'grid', 
      gridTemplateColumns:'120px 1fr max-content', 
      rowGap:'16px', 
      columnGap:'16px', 
      alignItems:'center'
    });
    
    const mkRow=(labTxt, placeholder, isUrl=false)=>{
      const lab=document.createElement('div'); 
      lab.textContent=labTxt; 
      Object.assign(lab.style,{
        fontWeight:'700',
        color:'var(--text, #e4e6ea)'
      });
      
      const inp=document.createElement('input'); 
      inp.type='text'; 
      inp.placeholder=placeholder; 
      Object.assign(inp.style,{
        padding:'12px 16px', 
        border:'2px solid var(--border, #2a3443)', 
        borderRadius:'8px', 
        background:'var(--panel, #1e2329)', 
        color:'var(--text, #e4e6ea)',
        fontSize:'14px'
      });
      
      let tail;
      if(isUrl){
        tail=document.createElement('button'); 
        tail.textContent='이동'; 
        tail.className='btn btn-secondary'; 
        Object.assign(tail.style,{
          padding:'8px 16px', 
          borderRadius:'8px'
        });
        tail.addEventListener('click', ()=>{ 
          const u=(inp.value||'').trim(); 
          if(!u) return showToast('주소가 비어있습니다.','warning'); 
          window.open(u,'_blank'); 
        });
      } else {
        tail=document.createElement('div'); 
        Object.assign(tail.style,{
          fontSize:'12px', 
          color:'var(--muted, #9aa4b2)',
          fontWeight:'600'
        });
        const update=()=>tail.textContent=`${(inp.value||'').length.toLocaleString('ko-KR')}자`; 
        inp.addEventListener('input', update); 
        update();
      }
      table.appendChild(lab); 
      table.appendChild(inp); 
      table.appendChild(tail);
      return inp;
    };
    
    const refThumb=mkRow('썸네일','참고용 썸네일');
    const refTitle=mkRow('제목','참고용 제목');
    const refUrl=mkRow('주소','https://…', true);
    refSec.appendChild(table); 
    rightCol.appendChild(refSec);

    // 추천 제목 top 5 (왼쪽으로 이동)
    const titleSec=makeSection('추천 제목 top 5');
    const ttWrap=document.createElement('div'); 
    Object.assign(ttWrap.style,{
      border:'2px solid var(--border, #2a3443)', 
      borderRadius:'16px', 
      padding:'20px', 
      background:'var(--glass-bg, rgba(255,255,255,0.02))'
    });
    const titleRows=[]; 
    for(let i=1;i<=5;i++){ 
      const r=makeListRow4(i,'제목 문구'); 
      titleRows.push(r); 
      ttWrap.appendChild(r.row); 
    }
    titleSec.appendChild(ttWrap); 
    leftCol.appendChild(titleSec);

    // 유튜브 업로드 설명 (왼쪽으로 이동)
    const descSec=makeSection('');
    const descHead=document.createElement('div'); 
    Object.assign(descHead.style,{
      display:'flex', 
      alignItems:'center', 
      justifyContent:'space-between', 
      marginBottom:'16px'
    });
    
    const descTitle=document.createElement('div'); 
    descTitle.textContent='유튜브 업로드 설명'; 
    Object.assign(descTitle.style,{
      fontWeight:'800',
      fontSize:'1.3rem',
      color:'var(--text, #e4e6ea)'
    });
    
    const descRight=document.createElement('div'); 
    Object.assign(descRight.style,{
      display:'flex', 
      alignItems:'center', 
      gap:'12px'
    });
    
    const descCount=document.createElement('div'); 
    Object.assign(descCount.style,{
      fontWeight:'700', 
      color:'var(--muted, #9aa4b2)'
    });
    
    const descCopy=document.createElement('button'); 
    descCopy.textContent='복사'; 
    descCopy.className='btn btn-secondary'; 
    Object.assign(descCopy.style,{
      padding:'8px 16px', 
      borderRadius:'8px'
    });
    
    descRight.appendChild(descCount); 
    descRight.appendChild(descCopy);
    descHead.appendChild(descTitle); 
    descHead.appendChild(descRight);
    
    const descInput=document.createElement('textarea'); 
    Object.assign(descInput.style,{
      width:'100%', 
      padding:'16px', 
      border:'2px solid var(--border, #2a3443)', 
      borderRadius:'12px', 
      background:'var(--panel, #1e2329)', 
      color:'var(--text, #e4e6ea)', 
      overflow:'hidden', 
      resize:'none',
      fontSize:'14px',
      lineHeight:'1.6'
    });
    
    const updateDesc=()=>{ 
      descCount.textContent=`${(descInput.value||'').length.toLocaleString('ko-KR')}자`; 
      autosize(descInput); 
    };
    descInput.addEventListener('input', updateDesc); 
    updateDesc();
    
    descCopy.addEventListener('click', async()=>{ 
      try{ 
        await navigator.clipboard.writeText(descInput.value||''); 
        descCopy.classList.add('btn-copied'); 
        showToast('복사되었습니다.','success'); 
      }
      catch { showToast('복사 실패','error'); }
    });
    descInput.addEventListener('input', ()=>descCopy.classList.remove('btn-copied'));
    
    descSec.appendChild(descHead); 
    descSec.appendChild(descInput);
    leftCol.appendChild(descSec);

    // 추천 썸네일 top 5 (오른쪽으로 이동)
    const thumbSec=makeSection('추천 썸네일 top 5');
    const tWrap=document.createElement('div'); 
    Object.assign(tWrap.style,{
      border:'2px solid var(--border, #2a3443)', 
      borderRadius:'16px', 
      padding:'20px', 
      background:'var(--glass-bg, rgba(255,255,255,0.02))'
    });
    const thumbRows=[], thumbImageInputs=[];
    for(let i=1;i<=5;i++){
      const thumbRow = makeThumbRow(i,'썸네일 문구');
      tWrap.appendChild(thumbRow.container);
      thumbRows.push({ inputEl: thumbRow.textInput, btnEl: thumbRow.textBtn });
      thumbImageInputs.push({ inputEl: thumbRow.promptInput, btnEl: thumbRow.promptBtn });
    }
    thumbSec.appendChild(tWrap);
    rightCol.appendChild(thumbSec);

    // 이미지 프롬프트 (오른쪽으로 이동)
    const promptSec=makeSection('이미지 프롬프트');
    const promptList=document.createElement('div'); 
    Object.assign(promptList.style,{
      border:'2px solid var(--border, #2a3443)', 
      borderRadius:'16px', 
      padding:'16px', 
      background:'var(--glass-bg, rgba(255,255,255,0.02))'
    });
    
    const promptRows=[];

    // 그룹 타이틀 만들기
    const makeGroupTitle = (text) => {
      const g=document.createElement('div');
      g.textContent=text;
      Object.assign(g.style,{
        fontWeight:'800', 
        margin:'12px 0 8px 0', 
        fontSize:'14px',
        color:'var(--brand, #c4302b)',
        borderBottom:'1px solid var(--border, #2a3443)',
        paddingBottom:'4px'
      });
      return g;
    };

    // #1 블록 (3쌍을 컴팩트하게)
    promptList.appendChild(makeGroupTitle('# 1'));
    OPENING_PAIRS.forEach(([L,R])=>{
      const pair = makeCompactPromptPair(L, R);
      promptList.appendChild(pair.row);
      promptRows.push(pair.left);
      promptRows.push(pair.right);
    });

    // #2 ~ #9 (각 2개씩을 컴팩트하게)
    CHAPTER_PAIRS.forEach((chapterPair, idx)=>{
      const num = idx + 2; // 2..9
      promptList.appendChild(makeGroupTitle(`# ${num}`));
      const pair = makeCompactPromptPair(chapterPair[0], chapterPair[1]);
      promptList.appendChild(pair.row);
      promptRows.push(pair.left);
      promptRows.push(pair.right);
    });

    promptSec.appendChild(promptList);
    rightCol.appendChild(promptSec);

    // ------------------ 하단 — 대본 카드 ------------------
    const scriptBottom=makeSection('대본');
    const rowHead=document.createElement('div'); 
    Object.assign(rowHead.style,{
      display:'flex', 
      alignItems:'center', 
      gap:'16px', 
      marginBottom:'20px'
    });
    
    const dTitle=document.createElement('div'); 
    dTitle.textContent='대본'; 
    Object.assign(dTitle.style,{
      fontWeight:'800',
      fontSize:'1.2rem',
      color:'var(--text, #e4e6ea)'
    });
    
    const dCount=document.createElement('div'); 
    dCount.textContent=' / 대본글자수 0자'; 
    Object.assign(dCount.style,{
      fontWeight:'800', 
      color:'var(--muted, #9aa4b2)'
    });
    
    const dTime=document.createElement('div'); 
    dTime.textContent=' / 예상시간 [ 00시 00분 00초 ]'; 
    Object.assign(dTime.style,{
      fontWeight:'800', 
      color:'var(--muted, #9aa4b2)'
    });
    
    rowHead.appendChild(dTitle); 
    rowHead.appendChild(dCount); 
    rowHead.appendChild(dTime);
    
    const cardsGrid=document.createElement('div'); 
    Object.assign(cardsGrid.style,{
      display:'grid', 
      gridTemplateColumns:'repeat(auto-fit, minmax(350px, 1fr))', 
      gap:'20px', 
      alignItems:'stretch'
    });
    
    const mount=document.createElement('div'); 
    mount.style.display='contents'; 
    cardsGrid.appendChild(mount);
    
    scriptBottom.appendChild(rowHead); 
    scriptBottom.appendChild(cardsGrid);

    // 루트 조립
    const container=document.createElement('section');
    Object.assign(container.style,{
      border:'2px solid var(--border, #2a3443)', 
      borderRadius:'20px', 
      padding:'32px', 
      background:'var(--card, #151b24)', 
      marginBottom:'32px',
      boxShadow:'0 8px 32px rgba(0,0,0,0.2)'
    });
    
    root.innerHTML=''; 
    root.appendChild(container);
    container.appendChild(header); 
    container.appendChild(gridTop);
    root.appendChild(scriptBottom);

    // 상태 저장
    state.dateInput=dateInput; 
    state.btnMeta=btnMeta; 
    state.btnImport=btnImport; 
    state.importInput=importInput;
    state.refThumb=refThumb; 
    state.refTitle=refTitle; 
    state.refUrl=refUrl;
    state.scriptArea=scriptArea; 
    state.descInput=descInput; 
    state.descCopyBtn=descCopy;
    state.titleRows=titleRows;
    state.thumbRows=thumbRows;
    state.thumbImageRows=thumbImageInputs;
    state.promptRows=promptRows;
    state.chapCountEl=dCount; 
    state.chapTimeEl=dTime; 
    state.gridMount=mount; 
    state.cards=[];

    /* --------- 내부 기능 --------- */
    const fillPrompts = (full) => {
      const map=extractImagePrompts(full);
      
      // 썸네일 이미지 프롬프트(1~5)
      THUMB_PROMPT_LABELS.forEach((lab, i) => {
        const val = map.get(lab) || '';
        if (state.thumbImageRows[i]) state.thumbImageRows[i].inputEl.value = val;
      });

      // 나머지 이미지 프롬프트
      state.promptRows.forEach(r => {
        const key = r.label; // 'label' 속성에 '#1-1 :' 등이 저장됨
        r.inputEl.value = map.get(key) || '';
      });
    };

    const rebuildCards = (combined) => {
      state.cards=[]; 
      state.gridMount.innerHTML='';
      if (!combined || !combined.trim()) {
        const empty=document.createElement('div'); 
        Object.assign(empty.style,{
          gridColumn:'1 / -1', 
          border:'2px dashed var(--border, #2a3443)', 
          borderRadius:'16px', 
          padding:'40px', 
          color:'var(--muted, #9aa4b2)',
          textAlign:'center',
          background:'var(--glass-bg, rgba(255,255,255,0.02))'
        }); 
        empty.textContent='대본 텍스트가 없습니다.'; 
        state.gridMount.appendChild(empty); 
        return;
      }
      
      const sentences=splitPreserveDashes(combined);
      const chunks=[]; 
      let buf='';
      
      for (const s0 of sentences){
        const piece=(s0==='---')?'\n\n---\n\n':s0;
        const candidate = buf ? (piece==='\n\n---\n\n' ? (buf.replace(/\s*$/,'')+'\n\n---\n\n') : (buf+(buf.endsWith('\n')?'':' ')+piece)) : piece;
        if (buf.length && candidate.length>SPLIT_LIMIT) { 
          chunks.push(buf.trim()); 
          buf=piece; 
        } else { 
          buf=candidate; 
        }
      }
      if (buf.trim()) chunks.push(buf.trim());

      chunks.forEach((text, idx)=>{
        const card=document.createElement('div'); 
        Object.assign(card.style,{
          border:'2px solid var(--border, #2a3443)', 
          borderRadius:'16px', 
          padding:'20px', 
          background:'var(--card, #151b24)', 
          display:'flex', 
          flexDirection:'column',
          boxShadow:'0 4px 20px rgba(0,0,0,0.1)'
        });
        
        const head=document.createElement('div'); 
        Object.assign(head.style,{
          display:'flex', 
          alignItems:'center', 
          justifyContent:'space-between', 
          marginBottom:'16px'
        });
        
        const ttl=document.createElement('div'); 
        ttl.textContent=`대본 ${String(idx+1).padStart(2,'0')}`; 
        Object.assign(ttl.style,{
          fontWeight:'800',
          fontSize:'1.1rem',
          color:'var(--text, #e4e6ea)'
        });
        
        const meta=document.createElement('div'); 
        const cnt=document.createElement('span'); 
        cnt.textContent=` / ${(text||'').length.toLocaleString('ko-KR')}자`;
        Object.assign(cnt.style,{
          fontWeight:'700',
          color:'var(--muted, #9aa4b2)'
        });
        
        const btn=document.createElement('button'); 
        btn.textContent='내용복사'; 
        btn.className='btn btn-secondary'; 
        Object.assign(btn.style,{
          padding:'6px 12px', 
          borderRadius:'8px', 
          marginLeft:'12px',
          fontSize:'12px'
        });
        
        btn.addEventListener('click', async()=>{ 
          try{ 
            await navigator.clipboard.writeText(text||''); 
            btn.classList.add('btn-copied'); 
            showToast('복사되었습니다.','success'); 
          }
          catch{ showToast('복사 실패','error'); }
        });
        
        const ta=document.createElement('textarea'); 
        ta.readOnly=true; 
        ta.value=text; 
        Object.assign(ta.style,{
          width:'100%', 
          height:`${CARD_H}px`, 
          padding:'16px', 
          border:'2px solid var(--border, #2a3443)', 
          borderRadius:'12px', 
          background:'var(--panel, #1e2329)', 
          color:'var(--text, #e4e6ea)', 
          resize:'none',
          fontSize:'14px',
          lineHeight:'1.6',
          fontFamily:'ui-monospace, SFMono-Regular, monospace'
        });

        meta.appendChild(cnt); 
        meta.appendChild(btn); 
        head.appendChild(ttl); 
        head.appendChild(meta);
        card.appendChild(head); 
        card.appendChild(ta);
        state.gridMount.appendChild(card);
        state.cards.push({textarea: ta});
      });
    };

    // "## n장." 처리 개선: n장. 이후 같은 줄 내용 삭제, "## 1장." 유지
    function cleanChapterLines(text) {
      return text.replace(/^(##\s*\d+장\.?).*$/gm, '$1');
    }

    function parseAll(){
      const full = state.scriptArea.value || '';

      // 원본 정보 추출 및 참고영상정보에 자동 입력
      const originalInfo = extractOriginalInfo(full);
      if (originalInfo.thumbnail) state.refThumb.value = originalInfo.thumbnail;
      if (originalInfo.title) state.refTitle.value = originalInfo.title;
      if (originalInfo.url) state.refUrl.value = originalInfo.url;

      // 샵 하나만 있는 줄 제거
      const cleanedFull = removeSingleHashLines(full);

      const desc = extractDescription(cleanedFull);
      state.descInput.value = desc;
      state.descInput.dispatchEvent(new Event('input'));

      const thumbs=extractThumb5(cleanedFull), titles=extractTitle5(cleanedFull);
      for(let i=0;i<5;i++){
        if (state.thumbRows[i]) {
          state.thumbRows[i].inputEl.value = thumbs[i] || '';
          state.thumbRows[i].inputEl.dispatchEvent(new Event('input'));
        }
        state.titleRows[i].inputEl.value = titles[i] || '';
        state.titleRows[i].inputEl.dispatchEvent(new Event('input'));
      }

      // 이미지 프롬프트 매핑
      fillPrompts(cleanedFull);

      const opening=extractOpening(cleanedFull);
      const body=extractScriptBody(cleanedFull);
      
      // "## n장." 라인 정리 후 결합
      const cleanedOpening = cleanChapterLines(opening);
      const cleanedBody = cleanChapterLines(body);
      const combined=[cleanedOpening, cleanedBody].filter(Boolean).join('\n\n');
      
      const charCount=(combined||'').replace(/\n/g,'').length;
      state.chapCountEl.textContent = ` / 대본글자수 ${charCount.toLocaleString('ko-KR')}자`;
      state.chapTimeEl.textContent  = ` / 예상시간 ${formatDuration(charCount)}`;
      rebuildCards(combined);
    }

    /* --------- 기본정보 다운 (AI 콘텐츠 내보내기) --------- */
    btnMeta.addEventListener('click', ()=>{
      const aiContent = state.scriptArea.value || '';
      const dateStr = state.dateInput.value || today();
      const filename = `${dateStr}_AI콘텐츠.txt`;
      downloadFile(filename, aiContent, 'text/plain;charset=utf-8');
      showToast('AI 콘텐츠를 저장했습니다. (txt)','success');
    });

    /* --------- txt 가져오기 (AI 콘텐츠로 입력) --------- */
    btnImport.addEventListener('click', ()=> state.importInput.click());
    state.importInput.addEventListener('change', (e)=>{
      const file=e.target.files && e.target.files[0];
      if(!file) return;
      const reader=new FileReader();
      reader.onload = () => {
        try {
          const content = String(reader.result||'').trim();
          state.scriptArea.value = content;
          parseAll(); // 자동으로 나머지 칸 채우기
          showToast('AI 콘텐츠 가져오기가 완료되었습니다.','success');
        } catch (err) {
          console.error(err);
          showToast('가져오기에 실패했습니다. 파일을 확인해주세요.','error');
        } finally {
          state.importInput.value='';
        }
      };
      reader.readAsText(file, 'utf-8');
    });

    // 원문 변경 시 파싱
    state.scriptArea.addEventListener('input', parseAll);
    parseAll();
  }

  /* ---------- 마운트 ---------- */
  function ensureMount(){
    let root = $('#section-text-splitter') || $('#text-splitter') || $('#tab-text-splitter') || document.getElementById('text-splitter-area');
    if (!root) {
      root = document.createElement('section'); 
      root.id='section-text-splitter';
      const container=document.querySelector('.container')||document.body;
      const h2=document.createElement('h2'); 
      h2.className='section-header'; 
      h2.textContent='텍스트 분할';
      root.appendChild(h2); 
      container.appendChild(root);
    }
    return root;
  }
  
  function init(){ 
    const root=ensureMount(); 
    render(root); 
  }
  
  document.addEventListener('DOMContentLoaded', ()=>{ 
    const maybe=$('#section-text-splitter')||$('#text-splitter')||$('#tab-text-splitter'); 
    if(maybe) init(); 
  });
  
  window.initializeTextSplitter = init;

})();

console.log('text-splitter.js (수정된 버전) 로딩 완료');