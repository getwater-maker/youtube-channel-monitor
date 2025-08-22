/* scene-parser.js — 씬 프롬프트 파서
   - 입력창 스크롤 제거 & autosize (입력 길이만큼 늘어남)
   - [n ~ m] / [n-m] / [n] 구간만 있어도 파싱
   - 결과에는 "이미지 프롬프트"의 따옴표 안 값만 표시
     우선순위: '이미지 프롬프트:' 라벨 뒤 첫 따옴표 구절 > 블록 내 최장 따옴표 구절
   - 복사 버튼: 토글 방식 ("복사" ↔ "복사됨"), 텍스트 분할기와 동일 스타일(.btn .btn-secondary)
   - 구분선: 신(씬) 구간마다 가로 구분선 추가
   - 파일 저장: JSON 형식, 파일명 = "YYYY-MM-DD_프롬프트.Json"
*/

(function () {
  // ====== 모듈 상태 ======
  let _lastResults = []; // [{scene, prompt}, ...]

  // ====== 유틸 ======
  const debounce = (fn, ms = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  // textarea autosize
  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.overflow = 'hidden';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  // 따옴표 구절 추출: "..." / '...' / “…” / ‘…’ / `...`
  function extractQuotedStrings(s) {
    const re = /(["“”'‘’`])([\s\S]*?)\1/g;
    const out = [];
    let m;
    while ((m = re.exec(s)) !== null) {
      const inner = (m[2] || '').trim();
      if (inner) out.push(inner);
    }
    return out;
  }

  // 블록에서 이미지 프롬프트 선택 규칙
  function pickImagePrompt(block) {
    // 1) '이미지 프롬프트:' 라벨 뒤 첫 따옴표 구절
    const labelIdx = block.search(/이미지\s*프롬프트[^:：]*[:：]/i);
    if (labelIdx !== -1) {
      const after = block.slice(labelIdx);
      const qs = extractQuotedStrings(after);
      if (qs.length) return qs[0];
    }
    // 2) 없으면 블록 전체에서 가장 긴 따옴표 구절
    const all = extractQuotedStrings(block);
    if (!all.length) return '';
    let longest = all[0];
    for (const q of all) if (q.length > longest.length) longest = q;
    return longest;
  }

  // [n ~ m] / [n-m] / [n] 구간 라인만 있으면 파싱
  function parseInput(raw) {
    const text = String(raw || '');

    // 구간 헤더 라인 탐지: 줄 어디에서든 [ .. ] 포함
    const headerRegex = /(^|\n)[^\n]*\[\s*\d+(?:\s*[~\-]\s*\d+)?\s*\][^\n]*\n?/g;

    const headers = [];
    let m;
    while ((m = headerRegex.exec(text)) !== null) {
      const lineStartIdx = m.index + (m[1] ? m[1].length : 0);
      const nl = text.indexOf('\n', lineStartIdx);
      const lineEnd = nl === -1 ? text.length : nl;
      const line = text.slice(lineStartIdx, lineEnd);
      const bracket = line.match(/\[\s*\d+(?:\s*[~\-]\s*\d+)?\s*\]/);
      if (!bracket) continue;
      const scene = bracket[0].replace(/^\[|\]$/g, '').trim();
      const afterHeaderIdx = nl === -1 ? text.length : nl + 1;
      headers.push({ scene, afterHeaderIdx });
    }

    const results = [];
    for (let i = 0; i < headers.length; i++) {
      const { scene, afterHeaderIdx } = headers[i];
      const nextStart = i + 1 < headers.length ? headers[i + 1].afterHeaderIdx : text.length;

      let block = text.slice(afterHeaderIdx, nextStart);
      // 단순한 구분선 제거, 여백 정리
      block = block.replace(/^\s*[-*_]{3,}\s*$/gm, '').trim();

      const prompt = pickImagePrompt(block); // 따옴표 안 값만
      results.push({ scene, prompt });
    }

    return results;
  }

  // 파일 저장(JSON) — 파일명: YYYY-MM-DD_프롬프트.Json
  function saveAsJson(items, dateStrInput) {
    if (!items || !items.length) {
      window.toast && window.toast('저장할 항목이 없습니다.', 'warning');
      return;
    }

    const dateStr = (dateStrInput && /^\d{4}-\d{2}-\d{2}$/.test(dateStrInput))
      ? dateStrInput
      : formatToday();

    const json = JSON.stringify(items, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });

    const filename = `${dateStr}_프롬프트.Json`; // 요청한 대로 대문자 J
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  function formatToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }

  // 표 렌더링 (복사 버튼 토글 + 구분선)
  function renderRows(rows, tbody) {
    _lastResults = rows.slice(); // 저장용 보관

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="empty" style="color: var(--muted); text-align:center; padding: 28px;">왼쪽에 입력을 붙여넣으세요. "[1 ~ 2]" 또는 "[7]" 구간 표기를 인식합니다.</td></tr>`;
      return;
    }

    const frag = document.createDocumentFragment();

    rows.forEach((r, idx) => {
      // 신구간 구분선(첫 구간 제외)
      if (idx > 0) {
        const sepTr = document.createElement('tr');
        sepTr.className = 'scene-sep';
        const sepTd = document.createElement('td');
        sepTd.colSpan = 3;
        sepTd.innerHTML = '<div class="scene-separator"></div>';
        sepTr.appendChild(sepTd);
        frag.appendChild(sepTr);
      }

      const tr = document.createElement('tr');

      const tdScene = document.createElement('td');
      tdScene.className = 'col-scene';
      tdScene.textContent = `[${r.scene}]`;

      const tdPrompt = document.createElement('td');
      tdPrompt.className = 'col-prompt';
      tdPrompt.textContent = r.prompt; // 따옴표 안 값만

      const tdCopy = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary'; // 텍스트 분할기와 동일한 스타일
      btn.style.whiteSpace = 'nowrap';
      btn.setAttribute('aria-label', `프롬프트 복사 ${idx + 1}`);
      btn.textContent = '복사';

      // 토글 동작: "복사" -> 클릭 -> "복사됨"(유지), 다시 클릭 -> "복사"
      btn.addEventListener('click', async () => {
        const isCopied = btn.classList.contains('is-copied');
        if (isCopied) {
          btn.classList.remove('is-copied');
          btn.textContent = '복사';
        } else {
          const ok = await copyText(r.prompt);
          if (ok) {
            btn.classList.add('is-copied');
            btn.textContent = '복사됨';
            window.toast && window.toast('복사되었습니다.', 'success');
          } else {
            btn.classList.add('is-failed');
            btn.textContent = '복사 실패';
            window.toast && window.toast('복사 실패', 'error');
            setTimeout(() => {
              btn.classList.remove('is-failed');
              btn.textContent = '복사';
            }, 1500);
          }
        }
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

  // 초기화 (네비게이션에서 섹션 진입 시 호출)
  function initializeSceneParser() {
    if (window._sceneParserInitialized) return; // 중복 방지
    window._sceneParserInitialized = true;

    const $input = document.getElementById('scene-input');
    const $tbody = document.getElementById('scene-tbody');
    const $clear = document.getElementById('scene-clear');
    const $save = document.getElementById('scene-save');
    const $date = document.getElementById('scene-date');

    if (!$input || !$tbody || !$clear || !$save || !$date) {
      console.warn('[scene-parser] 요소를 찾을 수 없습니다. index.html 구성을 확인하세요.');
      return;
    }

    // date 기본값 = 오늘
    if (!$date.value) $date.value = formatToday();

    // 초기 autosize 적용
    autoResize($input);

    // 디바운스 자동 파싱 + autosize
    const doParse = () => {
      autoResize($input);
      renderRows(parseInput($input.value), $tbody);
    };
    const debounced = debounce(doParse, 250);

    $input.addEventListener('input', debounced);

    // 지우기
    $clear.addEventListener('click', () => {
      $input.value = '';
      doParse();
      $input.focus();
    });

    // 파일 저장(JSON)
    $save.addEventListener('click', () => {
      if (!_lastResults.length) {
        window.toast && window.toast('저장할 항목이 없습니다.', 'warning');
        return;
      }
      saveAsJson(_lastResults, $date.value);
    });

    // 최초 진입 시 빈 상태 렌더링
    doParse();

    // 리사이즈 시 autosize 유지
    window.addEventListener('resize', () => autoResize($input));
  }

  // 전역 공개 (navigation.js에서 호출)
  window.initializeSceneParser = initializeSceneParser;
})();
