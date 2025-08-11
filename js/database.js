// IndexedDB 관리
let db = null;

function openDB() { 
  return new Promise((res, rej) => { 
    if (db) return res(db); 
    const r = indexedDB.open('myChannelDB', 4);
    
    r.onupgradeneeded = e => { 
      db = e.target.result;
      if (!db.objectStoreNames.contains('my_channels')) {
        db.createObjectStore('my_channels', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('insights')) {
        db.createObjectStore('insights', { keyPath: 'channelId' });
      }
      if (!db.objectStoreNames.contains('dailySubs')) {
        db.createObjectStore('dailySubs', { keyPath: ['channelId', 'date'] });
      }
      if (!db.objectStoreNames.contains('doneVideos')) {
        db.createObjectStore('doneVideos', { keyPath: ['channelId', 'videoId'] });
      }
    };
    
    r.onsuccess = e => { 
      db = e.target.result; 
      res(db); 
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
