// IndexedDB 관리 - 중복 선언 방지
window.db = window.db || null;

function openDB() { 
  return new Promise((res, rej) => { 
    if (window.db) return res(window.db); 
    const r = indexedDB.open('myChannelDB', 4);
    
    r.onupgradeneeded = e => { 
      window.db = e.target.result;
      if (!window.db.objectStoreNames.contains('my_channels')) {
        window.db.createObjectStore('my_channels', { keyPath: 'id' });
      }
      if (!window.db.objectStoreNames.contains('insights')) {
        window.db.createObjectStore('insights', { keyPath: 'channelId' });
      }
      if (!window.db.objectStoreNames.contains('dailySubs')) {
        window.db.createObjectStore('dailySubs', { keyPath: ['channelId', 'date'] });
      }
      if (!window.db.objectStoreNames.contains('doneVideos')) {
        window.db.createObjectStore('doneVideos', { keyPath: ['channelId', 'videoId'] });
      }
    };
    
    r.onsuccess = e => { 
      window.db = e.target.result; 
      res(window.db); 
    };
    
    r.onerror = e => rej(e);
  });
}

function idbAll(store) { 
  return openDB().then(db => new Promise((res, rej) => { 
    const tx = db.transaction(store, 'readonly'); 
    const s = tx.objectStore(store); 
    const q = s.getAll(); 
    q.onsuccess = () => res(q.result); 
    q.onerror = () => rej(q.error);
  })); 
}

function idbGet(store, key) { 
  return openDB().then(db => new Promise((res, rej) => { 
    const tx = db.transaction(store, 'readonly'); 
    const s = tx.objectStore(store); 
    const q = s.get(key); 
    q.onsuccess = () => res(q.result); 
    q.onerror = () => rej(q.error);
  })); 
}

function idbPut(store, obj) { 
  return openDB().then(db => new Promise((res, rej) => { 
    try { 
      const tx = db.transaction(store, 'readwrite'); 
      const s = tx.objectStore(store); 
      const q = s.put(obj); 
      q.onsuccess = () => res(); 
      q.onerror = () => rej(q.error); 
      tx.onerror = () => rej(tx.error);
    } catch (e) {
      rej(e);
    } 
  })); 
}

function idbDel(store, key) { 
  return openDB().then(db => new Promise((res, rej) => { 
    const tx = db.transaction(store, 'readwrite'); 
    const s = tx.objectStore(store); 
    const q = s.delete(key); 
    q.onsuccess = () => res(); 
    q.onerror = () => rej(q.error);
  })); 
}

// 전역으로 노출
window.openDB = openDB;
window.idbAll = idbAll;
window.idbGet = idbGet;
window.idbPut = idbPut;
window.idbDel = idbDel;
