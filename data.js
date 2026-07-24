/**
 * Offline Data Manager for NerReksha
 * Uses IndexedDB with fallback to LocalStorage
 */

const DB_NAME = 'NerRekshaDB';
const DB_VERSION = 1;
const STORES = {
    REPORTS: 'reports',
    SOS: 'sos',
    SAFE_PLACES: 'safe_places',
    PREFS: 'preferences'
};

class OfflineDataManager {
    constructor() {
        this.useIndexedDB = window.indexedDB !== undefined;
        this.db = null;
        this.initPromise = this.init();
    }

    async init() {
        if (!this.useIndexedDB) {
            console.warn("IndexedDB not available, falling back to LocalStorage.");
            return true;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.warn("IndexedDB failed to open. Falling back to LocalStorage.", event);
                this.useIndexedDB = false;
                resolve(true);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create stores if they don't exist
                if (!db.objectStoreNames.contains(STORES.REPORTS)) {
                    db.createObjectStore(STORES.REPORTS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.SOS)) {
                    db.createObjectStore(STORES.SOS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.SAFE_PLACES)) {
                    db.createObjectStore(STORES.SAFE_PLACES, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.PREFS)) {
                    db.createObjectStore(STORES.PREFS, { keyPath: 'key' });
                }
            };
        });
    }

    // --- Helper: Generate ID ---
    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // --- Core Methods ---
    
    async save(storeName, item, keyPath = 'id') {
        await this.initPromise;
        if (!item[keyPath]) item[keyPath] = this.generateId();

        if (this.useIndexedDB && this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(item);
                
                request.onsuccess = () => resolve(item);
                request.onerror = (e) => reject(e);
            });
        } else {
            // LocalStorage Fallback
            let data = JSON.parse(localStorage.getItem(DB_NAME + '_' + storeName) || '[]');
            const index = data.findIndex(d => d[keyPath] === item[keyPath]);
            if (index > -1) data[index] = item;
            else data.push(item);
            localStorage.setItem(DB_NAME + '_' + storeName, JSON.stringify(data));
            return Promise.resolve(item);
        }
    }

    async loadAll(storeName) {
        await this.initPromise;
        if (this.useIndexedDB && this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = (e) => reject(e);
            });
        } else {
            // LocalStorage Fallback
            return Promise.resolve(JSON.parse(localStorage.getItem(DB_NAME + '_' + storeName) || '[]'));
        }
    }

    async delete(storeName, id, keyPath = 'id') {
        await this.initPromise;
        if (this.useIndexedDB && this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(id);
                
                request.onsuccess = () => resolve(true);
                request.onerror = (e) => reject(e);
            });
        } else {
            // LocalStorage Fallback
            let data = JSON.parse(localStorage.getItem(DB_NAME + '_' + storeName) || '[]');
            data = data.filter(d => d[keyPath] !== id);
            localStorage.setItem(DB_NAME + '_' + storeName, JSON.stringify(data));
            return Promise.resolve(true);
        }
    }

    // --- Required Helper Functions ---

    async saveReport(reportData) {
        return this.save(STORES.REPORTS, reportData);
    }

    async loadReports() {
        return this.loadAll(STORES.REPORTS);
    }

    async updateReport(reportData) {
        return this.save(STORES.REPORTS, reportData);
    }

    async deleteReport(reportId) {
        return this.delete(STORES.REPORTS, reportId);
    }

    async saveSOS(sosData) {
        return this.save(STORES.SOS, sosData);
    }

    async loadSOS() {
        return this.loadAll(STORES.SOS);
    }

    // --- Additional Functions ---

    async saveSafePlace(placeData) {
        return this.save(STORES.SAFE_PLACES, placeData);
    }

    async loadSafePlaces() {
        return this.loadAll(STORES.SAFE_PLACES);
    }

    async deleteSafePlace(id) {
        return this.delete(STORES.SAFE_PLACES, id);
    }

    async updateSOSStatus(sosId, newStatus) {
        const sosList = await this.loadSOS();
        const sos = sosList.find(s => s.id === sosId);
        if (sos) {
            sos.status = newStatus;
            return this.save(STORES.SOS, sos);
        }
    }

    async clearAllData() {
        await this.initPromise;
        if (this.useIndexedDB && this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([STORES.REPORTS, STORES.SOS, STORES.SAFE_PLACES], 'readwrite');
                transaction.objectStore(STORES.REPORTS).clear();
                transaction.objectStore(STORES.SOS).clear();
                transaction.objectStore(STORES.SAFE_PLACES).clear();
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = (e) => reject(e);
            });
        } else {
            localStorage.removeItem(DB_NAME + '_' + STORES.REPORTS);
            localStorage.removeItem(DB_NAME + '_' + STORES.SOS);
            localStorage.removeItem(DB_NAME + '_' + STORES.SAFE_PLACES);
            return Promise.resolve(true);
        }
    }

    async saveBulkData(reports, sosList, places) {
        for (const report of reports) {
            await this.saveReport(report);
        }
        for (const sos of sosList) {
            await this.saveSOS(sos);
        }
        for (const place of places) {
            await this.saveSafePlace(place);
        }
    }

    async savePreference(key, value) {
        return this.save(STORES.PREFS, { key, value }, 'key');
    }

    async loadPreference(key) {
        await this.initPromise;
        if (this.useIndexedDB && this.db) {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([STORES.PREFS], 'readonly');
                const store = transaction.objectStore(STORES.PREFS);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result ? request.result.value : null);
                request.onerror = (e) => reject(e);
            });
        } else {
            let data = JSON.parse(localStorage.getItem(DB_NAME + '_' + STORES.PREFS) || '[]');
            const item = data.find(d => d.key === key);
            return Promise.resolve(item ? item.value : null);
        }
    }
}

// Instantiate globally
const NerRekshaData = new OfflineDataManager();

// Initialize
NerRekshaData.initPromise.then(() => {
    window.dispatchEvent(new Event('nerreksha-data-ready'));
});
