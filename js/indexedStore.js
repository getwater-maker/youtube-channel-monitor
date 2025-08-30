// js/indexedStore.js
const DB_NAME = 'yt_helper_db';
const DB_VERSION = 3; // 스키마 변경으로 버전 2 -> 3으로 올립니다.
let _db = null;

function openDB(){
  return new Promise((res, rej)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = req.result;
      if (!db.objectStoreNames.contains('kv'))       db.createObjectStore('kv', { keyPath:'key' });
      if (!db.objectStoreNames.contains('channels')) db.createObjectStore('channels', { keyPath:'id' });
      // [추가] 대본 초안을 위한 'drafts' 저장소를 추가합니다.
      if (!db.objectStoreNames.contains('drafts')) {
        const store = db.createObjectStore('drafts', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by_updatedAt', 'updatedAt'); // 수정일 기준으로 정렬하기 위한 인덱스
      }
    };
    req.onsuccess = ()=> {
      _db = req.result;
      _db.onversionchange = ()=>{
        console.warn('[IDB] versionchange → auto reload');
        _db.close();
        window.location.reload();
      };
      res(_db);
    };
    req.onerror = ()=> rej(req.error);
  });
}

export async function initDB(){
  try { await openDB(); }
  catch(e){ console.warn('[IDB] fallback to localStorage', e); }
}

/* -------- KV helpers (apiKey 등) -------- */
export async function kvSet(key, value){
  if (!_db) return localStorage.setItem(`kv:${key}`, JSON.stringify(value));
  const tx = _db.transaction('kv','readwrite');
  tx.objectStore('kv').put({ key, value });
  return new Promise(ok=> tx.oncomplete = ok);
}
export async function kvGet(key){
  if (!_db) {
    const v = localStorage.getItem(`kv:${key}`);
    return v ? JSON.parse(v) : null;
  }
  const tx = _db.transaction('kv','readonly');
  const req = tx.objectStore('kv').get(key);
  return new Promise(ok=>{
    req.onsuccess = ()=> ok(req.result?.value ?? null);
    // [수정] => 를 = 로 변경하여 문법 오류를 수정했습니다.
    req.onerror   = ()=> ok(null);
  });
}

/* -------- Channels -------- */
export async function channelsAll(){
  if (!_db) {
    const raw = localStorage.getItem('channels:list');
    return raw ? JSON.parse(raw) : [];
  }
  const tx = _db.transaction('channels','readonly');
  const req = tx.objectStore('channels').getAll();
  return new Promise(ok=>{
    req.onsuccess = ()=> ok(req.result || []);
    req.onerror   = ()=> ok([]);
  });
}

export async function channelsPut(ch){
  if (!_db) {
    const all = await channelsAll();
    const map = new Map(all.map(c=>[c.id,c]));
    map.set(ch.id, ch);
    localStorage.setItem('channels:list', JSON.stringify([...map.values()]));
    return true;
  }
  const tx = _db.transaction('channels','readwrite');
  tx.objectStore('channels').put(ch);
  return new Promise(ok=> tx.oncomplete = ok);
}

export async function channelsRemove(id){
  if (!_db) {
    const all = await channelsAll();
    localStorage.setItem('channels:list', JSON.stringify(all.filter(c=>c.id!==id)));
    return true;
  }
  const tx = _db.transaction('channels','readwrite');
  tx.objectStore('channels').delete(id);
  return new Promise(ok=> tx.oncomplete = ok);
}

/* -------- [추가] Drafts (Script Editor) -------- */
export async function draftsGetAll(){
  if (!_db) return [];
  const tx = _db.transaction('drafts','readonly');
  const store = tx.objectStore('drafts');
  const index = store.index('by_updatedAt'); // 수정일 인덱스 사용
  const req = index.getAll();
  return new Promise(ok=>{
    // 최신순으로 보여주기 위해 결과를 뒤집습니다.
    req.onsuccess = ()=> ok((req.result || []).reverse());
    req.onerror   = ()=> ok([]);
  });
}

export async function draftsPut(draft){
  if (!_db) return null;
  const tx = _db.transaction('drafts','readwrite');
  const store = tx.objectStore('drafts');
  const req = store.put(draft);
  return new Promise((ok, rej) => {
    req.onsuccess = () => ok(req.result);
    tx.oncomplete = () => ok(req.result);
    tx.onerror = () => rej(tx.error);
  });
}

export async function draftsRemove(id){
  if (!_db) return false;
  const tx = _db.transaction('drafts','readwrite');
  tx.objectStore('drafts').delete(id);
  return new Promise(ok=> tx.oncomplete = ()=>ok(true));
}