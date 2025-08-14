// YouTube 채널 모니터 - 텍스트 분할기 (개행 안전·전면 교체)
console.log('text-splitter.js 로딩 시작');

// ============================================================================
// 설정
// ============================================================================
const TEXT_SPLITTER_CONFIG = {
  LIMIT: 10000,                 // 청크 최대 길이(공백 포함)
  CHUNK_HEADER_REPLACEMENT: '씸씸'
};

// ============================================================================
// DOM 요소
// ============================================================================
let elements = {};
function initElements() {
  elements = {
    sourceText: document.getElementById('source-text'),
    countWithSpaces: document.getElementById('count-with-spaces'),
    countWithoutSpaces: document.getElementById('count-without-spaces'),
    processBtn: document.getElementById('btn-process-text'),
    clearBtn: document.getElementById('btn-clear-text'),
    chunksContainer: document.getElementById('text-chunks'),
    emptyState: document.getElementById('empty-chunks-state')
  };
}

// ============================================================================
// 유틸
// ============================================================================
function charCounts(text) {
  const withSpaces = (text || '').length;
  const withoutSpaces = (text || '').replace(/\s/g, '').length;
  return { withSpaces, withoutSpaces };
}

function updateSourceCounts() {
  const text = elements.sourceText?.value || '';
  const { withSpaces, withoutSpaces } = charCounts(text);
  if (elements.countWithSpaces) elements.countWithSpaces.textContent = withSpaces.toLocaleString();
  if (elements.countWithoutSpaces) elements.countWithoutSpaces.textContent = withoutSpaces.toLocaleString();
}

function safeToast(msg, type = 'info') {
  if (typeof window.toast === 'function') window.toast(msg, type);
  else console.log(`[${type.toUpperCase()}] ${msg}`);
}

// ============================================================================
// 전처리 & 블록화
// ============================================================================
// 규칙:
// 1) '---' 제거
// 2) '*' 제거
// 3) 헤더 줄(# 또는 ##로 시작)은 "씸씸"으로 대체
// 4) 헤더 기준 블록으로 나누기 (헤더 없으면 전체를 1블록)
function preprocessAndGroup(raw) {
  if (!raw) return { blocks: [] };

  // 1) 2) 제거
  let txt = raw.replace(/---/g, '').replace(/\*/g, '');

  const lines = txt.split(/\r?\n/);
  const processed = [];
  const headerIdxs = [];

  const isHeader = (line) => /^\s*#{1,2}(\s|$)/.test(line);

  for (let i = 0; i < lines.length; i++) {
    if (isHeader(lines[i])) {
      headerIdxs.push(processed.length);
      processed.push(TEXT_SPLITTER_CONFIG.CHUNK_HEADER_REPLACEMENT);
    } else {
      processed.push(lines[i]);
    }
  }

  // 헤더 기준 블록 분리
  const blocks = [];
  if (headerIdxs.length === 0) {
    blocks.push(processed.join('\n'));
  } else {
    const N = processed.length;
    for (let h = 0; h < headerIdxs.length; h++) {
      const s = headerIdxs[h];
      const e = (h + 1 < headerIdxs.length) ? headerIdxs[h + 1] : N;
      const block = processed.slice(s, e).join('\n');
      blocks.push(block);
    }
    // 첫 헤더 이전 내용이 있으면 맨 앞에 삽입
    if (headerIdxs[0] > 0) {
      const preface = processed.slice(0, headerIdxs[0]).join('\n');
      if (preface.trim().length > 0) blocks.unshift(preface);
    }
  }

  return { blocks };
}

// 블록들을 LIMIT 이하로 묶어 청크 생성
// ⚠️ 기존 문제 수정: 서로 다른 블록을 합칠 때 개행을 반드시 넣어 문장 붙는 현상 방지
function packBlocksToChunks(blocks, limit = TEXT_SPLITTER_CONFIG.LIMIT) {
  const chunks = [];
  let cur = '';
  let curRange = [];

  const pushCur = () => {
    if (!cur) return;
    chunks.push({ text: cur, range: curRange.slice() });
    cur = '';
    curRange = [];
  };

  for (let i = 0; i < blocks.length; i++) {
    const b = String(blocks[i] ?? '');

    if (b.length <= limit) {
      const afterJoin = cur ? (cur + '\n' + b) : b; // ← 개행 보장
      if (afterJoin.length <= limit) {
        cur = afterJoin;
        if (curRange.length === 0) curRange = [i + 1, i + 1];
        else curRange[1] = i + 1;
      } else {
        pushCur();
        cur = b;
        curRange = [i + 1, i + 1];
      }
    } else {
      // 큰 블록은 내부에서 강제 절단
      pushCur();
      for (let p = 0; p < b.length; p += limit) {
        chunks.push({ text: b.slice(p, p + limit), range: [i + 1, i + 1] });
      }
    }
  }
  pushCur();
  return chunks;
}

// ============================================================================
// 렌더링
// ============================================================================
function renderChunks(chunks) {
  const wrap = elements.chunksContainer;
  if (!wrap) return;

  if (!chunks.length) {
    wrap.innerHTML = `<div id="empty-chunks-state" style="text-align:center; color:var(--muted); padding:40px 20px;">
      아직 결과가 없습니다. 왼쪽에서 텍스트를 입력하고 <strong>나누기</strong>를 눌러주세요.
    </div>`;
    return;
  }

  const html = chunks.map((c, idx) => {
    const header = `청크 ${idx + 1} · 블록 ${c.range[0]} ~ ${c.range[1]} · ${c.text.length.toLocaleString()}자`;
    const escaped = c.text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `
      <div class="text-chunk">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border);">
          <div style="font-weight:700;">${header}</div>
          <button class="btn btn-secondary" data-copy="${idx}">복사</button>
        </div>
        <pre style="white-space:pre-wrap; margin:0; padding:16px;">${escaped}</pre>
      </div>`;
  }).join('');

  wrap.innerHTML = html;

  // 복사 버튼 이벤트
  wrap.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-copy'), 10);
      const text = chunks[i].text || '';
      navigator.clipboard.writeText(text).then(() => {
        safeToast(`청크 ${i + 1}가 클립보드에 복사되었습니다.`, 'success');
      }).catch(() => {
        safeToast('복사 실패. 브라우저 권한을 확인하세요.', 'error');
      });
    });
  });
}

// ============================================================================
// 메인 흐름
// ============================================================================
function processText() {
  if (!elements.sourceText) return;

  const raw = elements.sourceText.value || '';
  if (!raw.trim()) {
    renderChunks([]);
    return;
  }

  const { blocks } = preprocessAndGroup(raw);
  const chunks = packBlocksToChunks(blocks, TEXT_SPLITTER_CONFIG.LIMIT);
  renderChunks(chunks);
}

function clearText() {
  if (!elements.sourceText) return;
  elements.sourceText.value = '';
  updateSourceCounts();
  renderChunks([]);
}

// ============================================================================
// 초기화
// ============================================================================
function initializeTextSplitter() {
  initElements();

  if (elements.sourceText) {
    elements.sourceText.addEventListener('input', updateSourceCounts);
  }
  if (elements.processBtn && !elements.processBtn.dataset.bound) {
    elements.processBtn.dataset.bound = '1';
    elements.processBtn.addEventListener('click', processText);
  }
  if (elements.clearBtn && !elements.clearBtn.dataset.bound) {
    elements.clearBtn.dataset.bound = '1';
    elements.clearBtn.addEventListener('click', clearText);
  }

  updateSourceCounts();
  console.log('텍스트 분할기 DOM 로드 완료');
}

// 전역 공개
window.initializeTextSplitter = initializeTextSplitter;

console.log('text-splitter.js 로딩 완료');
