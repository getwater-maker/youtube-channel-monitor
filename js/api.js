// YouTube API 호출 함수
async function yt(endpoint, params, attempt = 0) {
  if (!window.hasKeys()) {
    throw new Error('API 키가 설정되지 않았습니다. API 키를 먼저 입력해주세요.');
  }
  
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort('timeout'), window.CONFIG.TIMEOUT);
  
  const p = new URLSearchParams(params);
  p.set('key', window.apiKeys[window.keyIdx]);
  const url = window.CONFIG.API_BASE + endpoint + '?' + p.toString();
  
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const data = await r.json();
    clearTimeout(timeout);
    
    if (data.error) {
      if (data.error.code === 403 && /quota/i.test(data.error.message || '')) {
        throw new Error('API 할당량이 초과되었습니다.');
      }
      if (attempt < window.apiKeys.length - 1) {
        window.nextKey();
        return yt(endpoint, params, attempt + 1);
      }
      throw new Error(data.error.message || 'API 오류');
    }
    return data;
  } catch (e) {
    clearTimeout(timeout);
    if (attempt < window.apiKeys.length - 1) {
      window.nextKey();
      return yt(endpoint, params, attempt + 1);
    }
    throw e;
  }
}

// 전역으로 노출
window.yt = yt;
