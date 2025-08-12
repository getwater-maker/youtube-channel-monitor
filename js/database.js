// YouTube 채널 모니터 - IndexedDB 관리
console.log('database.js 로딩 시작');

// IndexedDB 연결
window.db = null;

function openDB() { 
  return new Promise((resolve, reject) => { 
    if (window.db) {
      console.log('기존 DB 연결 재사용');
      return resolve(window.db);
    }
    
    console.log('새 DB 연결 시작');
    const request = indexedDB.open('myChannelDB', 4);
    
    request.onupgradeneeded = e => { 
      console.log('DB 업그레이드 필요');
      window.db = e.target.result;
      
      if (!window.db.objectStoreNames.contains('my_channels')) {
        console.log('my_channels 스토어 생성');
        window.db.createObjectStore('my_channels', { keyPath: 'id' });
      }
      
      if (!window.db.objectStoreNames.contains('insights')) {
        console.log('insights 스토어 생성');
        window.db.createObjectStore('insights', { keyPath: 'channelId' });
      }
      
      if (!window.db.objectStoreNames.contains('dailySubs')) {
        console.log('dailySubs 스토어 생성');
        window.db.createObjectStore('dailySubs', { keyPath: ['channelId', 'date'] });
      }
      
      if (!window.db.objectStoreNames.contains('doneVideos')) {
        console.log('doneVideos 스토어 생성');
        window.db.createObjectStore('doneVideos', { keyPath: ['channelId', 'videoId'] });
      }
    };
    
    request.onsuccess = e => { 
      window.db = e.target.result;
      console.log('DB 연결 성공');
      resolve(window.db); 
    };
    
    request.onerror = e => {
      console.error('DB 연결 실패:', e);
      reject(e);
    };
  });
}

// 모든 데이터 가져오기
function idbAll(store) { 
  return openDB().then(db => new Promise((resolve, reject) => { 
    try {
      const tx = db.transaction(store, 'readonly'); 
      const s = tx.objectStore(store); 
      const q = s.getAll(); 
      
      q.onsuccess = () => {
        console.log(`${store}에서 ${q.result.length}개 데이터 조회`);
        resolve(q.result);
      };
      
      q.onerror = () => {
        console.error(`${store} 조회 실패:`, q.error);
        reject(q.error);
      };
    } catch (e) {
      console.error(`${store} 트랜잭션 실패:`, e);
      reject(e);
    }
  })); 
}

// 단일 데이터 가져오기
function idbGet(store, key) { 
  return openDB().then(db => new Promise((resolve, reject) => { 
    try {
      const tx = db.transaction(store, 'readonly'); 
      const s = tx.objectStore(store); 
      const q = s.get(key); 
      
      q.onsuccess = () => {
        console.log(`${store}에서 키 ${JSON.stringify(key)} 조회:`, !!q.result);
        resolve(q.result);
      };
      
      q.onerror = () => {
        console.error(`${store} 단일 조회 실패:`, q.error);
        reject(q.error);
      };
    } catch (e) {
      console.error(`${store} 단일 조회 트랜잭션 실패:`, e);
      reject(e);
    }
  })); 
}

// 데이터 저장/업데이트
function idbPut(store, obj) { 
  return openDB().then(db => new Promise((resolve, reject) => { 
    try { 
      const tx = db.transaction(store, 'readwrite'); 
      const s = tx.objectStore(store); 
      const q = s.put(obj); 
      
      q.onsuccess = () => {
        console.log(`${store}에 데이터 저장 성공`);
        resolve();
      };
      
      q.onerror = () => {
        console.error(`${store} 저장 실패:`, q.error);
        reject(q.error);
      };
      
      tx.onerror = () => {
        console.error(`${store} 저장 트랜잭션 실패:`, tx.error);
        reject(tx.error);
      };
    } catch (e) {
      console.error(`${store} 저장 예외:`, e);
      reject(e);
    } 
  })); 
}

// 데이터 삭제
function idbDel(store, key) { 
  return openDB().then(db => new Promise((resolve, reject) => { 
    try {
      const tx = db.transaction(store, 'readwrite'); 
      const s = tx.objectStore(store); 
      const q = s.delete(key); 
      
      q.onsuccess = () => {
        console.log(`${store}에서 키 ${JSON.stringify(key)} 삭제 성공`);
        resolve();
      };
      
      q.onerror = () => {
        console.error(`${store} 삭제 실패:`, q.error);
        reject(q.error);
      };
    } catch (e) {
      console.error(`${store} 삭제 트랜잭션 실패:`, e);
      reject(e);
    }
  })); 
}

// 전역으로 노출
window.openDB = openDB;
window.idbAll = idbAll;
window.idbGet = idbGet;
window.idbPut = idbPut;
window.idbDel = idbDel;

console.log('database.js 로딩 완료');

// DB 초기화 테스트
openDB().then(() => {
  console.log('DB 초기화 성공');
}).catch(e => {
  console.error('DB 초기화 실패:', e);
});