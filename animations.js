const DB_NAME = 'fitness-maker-animations';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('animations');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Ouverture du stockage bloquée.'));
  });
}

async function transaction(mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('animations', mode);
      const request = action(tx.objectStore('animations'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction annulée.'));
    });
  } finally { db.close(); }
}

export const getAnimation = id => transaction('readonly', store => store.get(id));
export const saveAnimation = (id, file) => transaction('readwrite', store => store.put(file, id));
export const deleteAnimation = id => transaction('readwrite', store => store.delete(id));
