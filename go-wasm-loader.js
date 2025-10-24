// Go WASM Loader for EON Wallet
class GoWasmLoader {
    constructor() {
        this.ready = false;
        this.readyPromise = null;
        this.mockFS = new Map();
        this.fdMap = new Map(); // Map file descriptors to paths
        this.nextFd = 3; // Start from 3 (0,1,2 are stdin/stdout/stderr)
        // POSIX file type constants
        this.S_IFDIR = 0o040000;  // Directory
        this.S_IFREG = 0o100000;  // Regular file
    }

    patchFileSystem() {
        const self = this;
        
        // Override fs methods to support eonark initialization
        const originalMkdir = globalThis.fs.mkdir;
        globalThis.fs.mkdir = function(path, perm, callback) {
            console.log(`[FS] mkdir: ${path} (perm: ${perm.toString(8)})`);
            self.mockFS.set(path, { 
                type: 'dir', 
                mode: self.S_IFDIR | 0o755,
                dev: 0,
                ino: Math.floor(Math.random() * 1000000),
                nlink: 2,
                uid: 0,
                gid: 0,
                rdev: 0,
                size: 4096,
                blksize: 4096,
                blocks: 1,
                atimeMs: Date.now(),
                mtimeMs: Date.now(),
                ctimeMs: Date.now(),
                birthtimeMs: Date.now()
            });
            callback(null);
        };
        
        const originalStat = globalThis.fs.stat;
        globalThis.fs.stat = function(path, callback) {
            const mockStat = self.mockFS.get(path);
            if (mockStat) {
                console.log(`[FS] stat: ${path} -> ${mockStat.type} (mode: ${mockStat.mode.toString(8)})`);
                const stats = {
                    dev: mockStat.dev || 0,
                    ino: mockStat.ino || 0,
                    mode: mockStat.mode,
                    nlink: mockStat.nlink || 1,
                    uid: mockStat.uid || 0,
                    gid: mockStat.gid || 0,
                    rdev: mockStat.rdev || 0,
                    size: mockStat.size || 0,
                    blksize: mockStat.blksize || 4096,
                    blocks: mockStat.blocks || 0,
                    atimeMs: mockStat.atimeMs || Date.now(),
                    mtimeMs: mockStat.mtimeMs || Date.now(),
                    ctimeMs: mockStat.ctimeMs || Date.now(),
                    birthtimeMs: mockStat.birthtimeMs || Date.now(),
                    isDirectory: function() { return mockStat.type === 'dir'; },
                    isFile: function() { return mockStat.type === 'file'; },
                    isBlockDevice: function() { return false; },
                    isCharacterDevice: function() { return false; },
                    isSymbolicLink: function() { return false; },
                    isFIFO: function() { return false; },
                    isSocket: function() { return false; }
                };
                callback(null, stats);
            } else {
                console.log(`[FS] stat: ${path} -> ENOENT`);
                const err = new Error('ENOENT: no such file or directory, stat \'' + path + '\'');
                err.code = 'ENOENT';
                err.errno = -2;
                err.syscall = 'stat';
                err.path = path;
                callback(err);
            }
        };

        const originalOpen = globalThis.fs.open;
        globalThis.fs.open = function(path, flags, mode, callback) {
            console.log(`[FS] open: ${path} (flags: ${flags}, mode: ${mode})`);
            const file = self.mockFS.get(path);
            if (file && file.type === 'file') {
                const fd = self.nextFd++;
                self.fdMap.set(fd, { path: path, offset: 0 });
                console.log(`[FS] open: assigned fd=${fd} for ${path}`);
                callback(null, fd);
            } else {
                const err = new Error('ENOENT: no such file or directory, open \'' + path + '\'');
                err.code = 'ENOENT';
                callback(err);
            }
        };

        // Add fs.read to read from file descriptor
        const originalRead = globalThis.fs.read;
        globalThis.fs.read = function(fd, buffer, offset, length, position, callback) {
            console.log(`[FS] read: fd=${fd}, buffer.length=${buffer.length}, offset=${offset}, length=${length}, position=${position}`);
            
            const fdInfo = self.fdMap.get(fd);
            if (!fdInfo) {
                const err = new Error('EBADF: bad file descriptor');
                err.code = 'EBADF';
                callback(err);
                return;
            }
            
            const file = self.mockFS.get(fdInfo.path);
            if (!file || file.type !== 'file') {
                const err = new Error('EBADF: bad file descriptor');
                err.code = 'EBADF';
                callback(err);
                return;
            }
            
            const fileData = file.data;
            const readPosition = position !== null && position !== undefined ? position : fdInfo.offset;
            
            // Calculate how many bytes we can actually read
            const availableInFile = fileData.byteLength - readPosition;
            const availableInBuffer = buffer.length - offset;
            const bytesToRead = Math.min(length, availableInFile, availableInBuffer);
            
            if (bytesToRead <= 0) {
                console.log(`[FS] read: EOF or no space, returning 0 bytes`);
                callback(null, 0, buffer);
                return;
            }
            
            try {
                // Copy data from file to buffer
                const sourceView = new Uint8Array(fileData, readPosition, bytesToRead);
                
                // The buffer passed from Go is a Uint8Array view
                // We need to write directly into it starting at 'offset'
                for (let i = 0; i < bytesToRead; i++) {
                    buffer[offset + i] = sourceView[i];
                }
                
                // Update file offset if position was null
                if (position === null || position === undefined) {
                    fdInfo.offset = readPosition + bytesToRead;
                }
                
                console.log(`[FS] read: read ${bytesToRead} bytes from ${fdInfo.path} at position ${readPosition}`);
                callback(null, bytesToRead, buffer);
            } catch (error) {
                console.error(`[FS] read error:`, error);
                const err = new Error('EIO: i/o error');
                err.code = 'EIO';
                callback(err);
            }
        };

        // Add fs.fstat to get file stats by fd
        const originalFstat = globalThis.fs.fstat;
        globalThis.fs.fstat = function(fd, callback) {
            console.log(`[FS] fstat: fd=${fd}`);
            
            const fdInfo = self.fdMap.get(fd);
            if (!fdInfo) {
                const err = new Error('EBADF: bad file descriptor');
                err.code = 'EBADF';
                callback(err);
                return;
            }
            
            const file = self.mockFS.get(fdInfo.path);
            if (!file) {
                const err = new Error('EBADF: bad file descriptor');
                err.code = 'EBADF';
                callback(err);
                return;
            }
            
            const stats = {
                dev: file.dev || 0,
                ino: file.ino || 0,
                mode: file.mode,
                nlink: file.nlink || 1,
                uid: file.uid || 0,
                gid: file.gid || 0,
                rdev: file.rdev || 0,
                size: file.size || 0,
                blksize: file.blksize || 4096,
                blocks: file.blocks || 0,
                atimeMs: file.atimeMs || Date.now(),
                mtimeMs: file.mtimeMs || Date.now(),
                ctimeMs: file.ctimeMs || Date.now(),
                birthtimeMs: file.birthtimeMs || Date.now(),
                isDirectory: function() { return file.type === 'dir'; },
                isFile: function() { return file.type === 'file'; },
                isBlockDevice: function() { return false; },
                isCharacterDevice: function() { return false; },
                isSymbolicLink: function() { return false; },
                isFIFO: function() { return false; },
                isSocket: function() { return false; }
            };
            callback(null, stats);
        };

        // Add fs.close to close file descriptor
        const originalClose = globalThis.fs.close;
        globalThis.fs.close = function(fd, callback) {
            console.log(`[FS] close: fd=${fd}`);
            self.fdMap.delete(fd);
            callback(null);
        };

        const originalReadFile = globalThis.fs.readFile;
        if (!originalReadFile) {
            globalThis.fs.readFile = function(path, options, callback) {
                if (typeof options === 'function') {
                    callback = options;
                    options = {};
                }
                console.log(`[FS] readFile: ${path}`);
                const file = self.mockFS.get(path);
                if (file && file.type === 'file') {
                    callback(null, file.data);
                } else {
                    const err = new Error('ENOENT: no such file or directory');
                    err.code = 'ENOENT';
                    callback(err);
                }
            };
        }

        const originalWriteFile = globalThis.fs.writeFile;
        if (!originalWriteFile) {
            globalThis.fs.writeFile = function(path, data, options, callback) {
                if (typeof options === 'function') {
                    callback = options;
                    options = {};
                }
                console.log(`[FS] writeFile: ${path} (${data.byteLength || data.length} bytes)`);
                self.mockFS.set(path, { 
                    type: 'file', 
                    data: data, 
                    mode: self.S_IFREG | 0o644,
                    size: data.byteLength || data.length || 0,
                    dev: 0,
                    ino: Math.floor(Math.random() * 1000000),
                    nlink: 1,
                    uid: 0,
                    gid: 0,
                    rdev: 0,
                    blksize: 4096,
                    blocks: Math.ceil((data.byteLength || data.length || 0) / 4096),
                    atimeMs: Date.now(),
                    mtimeMs: Date.now(),
                    ctimeMs: Date.now(),
                    birthtimeMs: Date.now()
                });
                callback(null);
            };
        }

        // Mock process.cwd if it throws
        const originalCwd = globalThis.process.cwd;
        globalThis.process.cwd = function() {
            try {
                return originalCwd ? originalCwd.call(globalThis.process) : '/';
            } catch (e) {
                return '/';
            }
        };
    }

    async loadSRSFiles() {
        console.log('[SRS] Loading SRS files from IndexedDB...');
        
        try {
            const ckFile = await window.SRSManager.getSRSFile('srs.ck.bin');
            const lkFile = await window.SRSManager.getSRSFile('srs.lk.9.bin');
            
            if (!ckFile || !lkFile) {
                throw new Error('SRS files not found. Please upload SRS.CK.BIN and SRS.LK.9.BIN in Settings.');
            }
            
            // Pre-create directory structure
            this.mockFS.set('/tmp', { 
                type: 'dir', 
                mode: this.S_IFDIR | 0o755,
                size: 4096,
                dev: 0, ino: 1, nlink: 2, uid: 0, gid: 0, rdev: 0,
                blksize: 4096, blocks: 1,
                atimeMs: Date.now(), mtimeMs: Date.now(), 
                ctimeMs: Date.now(), birthtimeMs: Date.now()
            });
            
            this.mockFS.set('/tmp/.cache', { 
                type: 'dir', 
                mode: this.S_IFDIR | 0o755,
                size: 4096,
                dev: 0, ino: 2, nlink: 2, uid: 0, gid: 0, rdev: 0,
                blksize: 4096, blocks: 1,
                atimeMs: Date.now(), mtimeMs: Date.now(), 
                ctimeMs: Date.now(), birthtimeMs: Date.now()
            });
            
            this.mockFS.set('/tmp/.cache/eonark', { 
                type: 'dir', 
                mode: this.S_IFDIR | 0o755,
                size: 4096,
                dev: 0, ino: 3, nlink: 2, uid: 0, gid: 0, rdev: 0,
                blksize: 4096, blocks: 1,
                atimeMs: Date.now(), mtimeMs: Date.now(), 
                ctimeMs: Date.now(), birthtimeMs: Date.now()
            });
            
            // Store SRS files
            const ckPath = '/tmp/.cache/eonark/SRS.CK.BIN';
            const lkPath = '/tmp/.cache/eonark/SRS.LK.9.BIN';
            
            this.mockFS.set(ckPath, {
                type: 'file',
                data: ckFile.content, // Keep as ArrayBuffer
                mode: this.S_IFREG | 0o644,
                size: ckFile.size,
                dev: 0, ino: 4, nlink: 1, uid: 0, gid: 0, rdev: 0,
                blksize: 4096, 
                blocks: Math.ceil(ckFile.size / 4096),
                atimeMs: Date.now(), mtimeMs: Date.now(), 
                ctimeMs: Date.now(), birthtimeMs: Date.now()
            });
            
            this.mockFS.set(lkPath, {
                type: 'file',
                data: lkFile.content, // Keep as ArrayBuffer
                mode: this.S_IFREG | 0o644,
                size: lkFile.size,
                dev: 0, ino: 5, nlink: 1, uid: 0, gid: 0, rdev: 0,
                blksize: 4096,
                blocks: Math.ceil(lkFile.size / 4096),
                atimeMs: Date.now(), mtimeMs: Date.now(), 
                ctimeMs: Date.now(), birthtimeMs: Date.now()
            });
            
            console.log(`[SRS] ✓ Loaded SRS.CK.BIN (${window.SRSManager.formatSize(ckFile.size)})`);
            console.log(`[SRS] ✓ Loaded SRS.LK.9.BIN (${window.SRSManager.formatSize(lkFile.size)})`);
            
            return true;
        } catch (error) {
            console.error('[SRS] Failed to load SRS files:', error);
            throw error;
        }
    }

    async init() {
        if (this.readyPromise) {
            return this.readyPromise;
        }

        this.readyPromise = new Promise(async (resolve, reject) => {
            try {
                // Check if SRS files are available
                const srsStatus = await window.SRSManager.checkAllSRSFiles();
                if (!srsStatus.all) {
                    reject(new Error('SRS files not uploaded. Please go to Settings and upload SRS.CK.BIN and SRS.LK.9.BIN'));
                    return;
                }
                
                // Load wasm_exec.js
                const script = document.createElement('script');
                script.src = 'wasm_exec.js';
                script.onload = async () => {
                    try {
                        // Load SRS files first
                        await this.loadSRSFiles();
                        
                        // Then patch file system
                        this.patchFileSystem();
                        
                        // Initialize Go runtime
                        const go = new Go();
                        
                        go.env = Object.assign({}, go.env || {}, {
                            'HOME': '/tmp',
                            'XDG_CACHE_HOME': '/tmp/.cache'
                        });
                        
                        const result = await WebAssembly.instantiateStreaming(
                            fetch('eon_wallet_go.wasm'),
                            go.importObject
                        );
                        
                        // Run the Go program
                        go.run(result.instance);
                        
                        // Wait for Go WASM to signal ready
                        const maxWait = 15000;
                        const startTime = Date.now();
                        
                        const checkReady = () => {
                            if (window.goWasmReady) {
                                this.ready = true;
                                console.log('✓ Go WASM initialized successfully');
                                resolve();
                            } else if (Date.now() - startTime > maxWait) {
                                reject(new Error('Go WASM initialization timeout'));
                            } else {
                                setTimeout(checkReady, 100);
                            }
                        };
                        
                        checkReady();
                    } catch (error) {
                        console.error('Go WASM initialization error:', error);
                        reject(error);
                    }
                };
                script.onerror = () => {
                    reject(new Error('Failed to load wasm_exec.js'));
                };
                document.head.appendChild(script);
            } catch (error) {
                reject(error);
            }
        });

        return this.readyPromise;
    }

    async generateProof(salt, hash, secret, x, y, z, w) {
        if (!this.ready) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                const result = window.goGenerateProof(salt, hash, secret, x, y, z, w);
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result.proof);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async generateVk(salt, hash) {
        if (!this.ready) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                const result = window.goGenerateVk(salt, hash);
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result.vk);
                }
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Global instance
window.GoWasm = new GoWasmLoader();
