// js/youtube.js
import { kvGet } from './indexedStore.js';

// 모든 API 요청을 처리하는 중앙 함수
export async function ytApi(endpoint, params) {
  const key = await kvGet('apiKey');
  if (!key) throw new Error('API 키가 설정되지 않았습니다. 헤더의 \'API 입력\' 버튼을 눌러 키를 설정하세요.');
  
  const qs = new URLSearchParams({ ...params, key });
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${qs.toString()}`;
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${endpoint} 실패 (${r.status}) ${t}`);
  }
  return r.json();
}

// API 키의 유효성을 검사하는 함수
export async function verifyApiKey(key) {
  if (!key) return false;
  try {
    const qs = new URLSearchParams({ part: 'id', id: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw', key }); // Google Developers 채널 ID로 테스트
    const url = `https://www.googleapis.com/youtube/v3/channels?${qs.toString()}`;
    const r = await fetch(url);
    return r.ok; // 요청이 성공하면 true, 실패(4xx, 5xx)하면 false
  } catch (e) {
    console.error('API Key verification failed:', e);
    return false;
  }
}