// SRS Manager - Handle SRS files storage and retrieval using IndexedDB
class SRSManager {
    constructor() {
        this.dbName = 'EONWalletDB';
        this.storeName = 'srsFiles';
        this.db = null;
        // Expected SRS file names (case-insensitive)
        this.expectedFiles = ['srs.ck.bin', 'srs.lk.9.bin'];
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'name' });
                }
            };
        });
    }

    async saveSRSFile(name, file) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const data = {
                    name: name.toLowerCase(), // Store as lowercase for consistency
                    content: reader.result,
                    size: file.size,
                    uploadedAt: new Date().toISOString()
                };
                
                const request = store.put(data);
                request.onsuccess = () => resolve(data);
                request.onerror = () => reject(request.error);
            };
            
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    async getSRSFile(name) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(name.toLowerCase());
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async hasSRSFile(name) {
        const file = await this.getSRSFile(name);
        return !!file;
    }

    async checkAllSRSFiles() {
        const ck = await this.hasSRSFile('srs.ck.bin');
        const lk = await this.hasSRSFile('srs.lk.9.bin');
        return { ck, lk, all: ck && lk };
    }

    async deleteSRSFile(name) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(name.toLowerCase());
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllSRSFiles() {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    isValidSRSFileName(fileName) {
        const lower = fileName.toLowerCase();
        return this.expectedFiles.includes(lower);
    }
}

// Global instance
window.SRSManager = new SRSManager();
