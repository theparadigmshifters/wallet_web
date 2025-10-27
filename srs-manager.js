// SRS Manager - Handle SRS files storage and retrieval using IndexedDB
class SRSManager {
    constructor() {
        this.dbName = 'EONWalletDB';
        this.storeName = 'srsFiles';
        this.db = null;
        // Expected SRS file names (case-insensitive)
        this.expectedFiles = ['srs.ck.bin', 'srs.lk.9.bin'];
        // Remote SRS file paths
        this.remoteFiles = {
            'srs.ck.bin': 'srs/SRS.CK.BIN',
            'srs.lk.9.bin': 'srs/SRS.LK.9.BIN'
        };
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

    async saveSRSFileFromArrayBuffer(name, arrayBuffer) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const data = {
                name: name.toLowerCase(),
                content: arrayBuffer,
                size: arrayBuffer.byteLength,
                uploadedAt: new Date().toISOString()
            };
            
            const request = store.put(data);
            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    async downloadAndSaveSRSFile(name) {
        const remotePath = this.remoteFiles[name.toLowerCase()];
        if (!remotePath) {
            throw new Error(`Unknown SRS file: ${name}`);
        }

        const response = await fetch(remotePath);
        if (!response.ok) {
            throw new Error(`Failed to download ${name}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return await this.saveSRSFileFromArrayBuffer(name, arrayBuffer);
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

    async downloadAllSRSFiles() {
        const results = [];
        for (const fileName of this.expectedFiles) {
            try {
                const data = await this.downloadAndSaveSRSFile(fileName);
                results.push({ fileName, success: true, data });
            } catch (error) {
                results.push({ fileName, success: false, error: error.message });
            }
        }
        return results;
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
