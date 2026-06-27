/**
 * BFS Smart Attendance - OfflineDb.js
 * Handles IndexedDB wrapper for offline storage and auto-syncing.
 */

const offlineDb = {
  dbName: 'BFS_Attendance_DB',
  storeName: 'pending_records',
  db: null,

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.error);
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.updatePendingCountUI();
        resolve(this.db);
      };
    });
  },

  saveRecord(record) {
    if (!this.db) return;
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    // Add local timestamp for TimeDifference calculation on server
    record.deviceTime = new Date().toISOString();
    
    const request = store.add(record);
    request.onsuccess = () => {
      console.log("Record saved offline successfully.");
      this.updatePendingCountUI();
    };
  },

  getAllPendingRecords() {
    return new Promise((resolve, reject) => {
      if (!this.db) { resolve([]); return; }
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  clearRecords(ids) {
    if (!this.db || !ids || ids.length === 0) return;
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    ids.forEach(id => store.delete(id));
    
    transaction.oncomplete = () => {
      this.updatePendingCountUI();
    };
  },

  async syncPendingRecords() {
    if (!app.state.isOnline) return;

    try {
      const records = await this.getAllPendingRecords();
      if (records.length === 0) return;

      console.log(`Attempting to sync ${records.length} records...`);
      const btn = document.getElementById('btn-sync');
      if (btn) btn.innerHTML = "Syncing...";

      const res = await app.callBackend('syncOfflineRecords', { records: records });
      
      if (res.status === 'success') {
        const idsToDelete = records.map(r => r.id);
        this.clearRecords(idsToDelete);
        console.log("Offline records synced successfully!");
      } else {
        console.error("Failed to sync records:", res.message);
      }
      
      if (btn) btn.innerHTML = "Sync Now";
    } catch (err) {
      console.error("Sync error:", err);
      const btn = document.getElementById('btn-sync');
      if (btn) btn.innerHTML = "Sync Now";
    }
  },

  async updatePendingCountUI() {
    try {
      const records = await this.getAllPendingRecords();
      const countEl = document.getElementById('pending-sync-count');
      const syncBtn = document.getElementById('btn-sync');
      
      if (countEl) countEl.textContent = records.length;
      
      if (records.length > 0 && syncBtn) {
        syncBtn.style.display = 'inline-block';
      } else if (syncBtn) {
        syncBtn.style.display = 'none';
      }
    } catch (err) {
      console.error("Error updating pending count:", err);
    }
  }
};

// Initialize DB on script load
document.addEventListener("DOMContentLoaded", () => offlineDb.init());
