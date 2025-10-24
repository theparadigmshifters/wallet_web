const WasmWallet = {
    rustWasm: null,
    goWasmReady: false,
    initPromise: null,

    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            console.log('Initializing wallet WASM modules...');
            
            // Initialize Rust WASM (in main thread now)
            const wasmModule = await import('./wasm-pkg/eon_wallet_wasm.js');
            await wasmModule.default();
            this.rustWasm = wasmModule;
            console.log('✓ Rust WASM ready');

            // Initialize Go WASM
            try {
                await window.GoWasm.init();
                this.goWasmReady = true;
                console.log('✓ Go WASM ready');
            } catch (error) {
                console.error('✗ Go WASM initialization failed:', error);
                throw error;
            }

            console.log('✓ Wallet WASM initialized');
        })();

        return this.initPromise;
    },

    async createWallet(secret) {
        await this.init();
        const result = this.rustWasm.create_wallet(secret);
        return JSON.parse(result);
    },

    async importWallet(walletData) {
        await this.init();
        const walletJson = typeof walletData === 'string' ? walletData : JSON.stringify(walletData);
        return this.rustWasm.import_wallet(walletJson);
    },

    async verifyWallet(wallet, secret) {
        await this.init();
        const walletJson = typeof wallet === 'string' ? wallet : JSON.stringify(wallet);
        return this.rustWasm.verify_wallet(walletJson, secret);
    },

    async signTransaction(wallet, secret, tx) {
        await this.init();
        
        if (!this.goWasmReady) {
            throw new Error('Go WASM not ready for proof generation');
        }

        const walletJson = typeof wallet === 'string' ? wallet : JSON.stringify(wallet);
        const walletObj = typeof wallet === 'string' ? JSON.parse(wallet) : wallet;
        const txJson = typeof tx === 'string' ? tx : JSON.stringify(tx);
        
        // Step 1: Verify wallet with Rust WASM
        console.log('[SIGN_TX] Verifying wallet...');
        const verified = this.rustWasm.verify_wallet(walletJson, secret);
        if (!verified) {
            throw new Error('Invalid secret');
        }
        console.log('[SIGN_TX] ✓ Wallet verified');

        // Step 2: Calculate transaction hashes with Rust WASM
        console.log('[SIGN_TX] Calculating transaction hashes...');
        const txHashesStr = this.rustWasm.calculate_tx_hashes(txJson, secret);
        const txHashes = JSON.parse(txHashesStr);
        console.log('[SIGN_TX] ✓ Transaction hashes calculated');
        
        // Step 3: Generate proof with Go WASM
        console.log('[SIGN_TX] Generating ZK proof (this may take a while)...');
        const proof = await window.GoWasm.generateProof(
            walletObj.salt,
            walletObj.hash,
            txHashes.secret_hash,
            txHashes.tx_hash_x,
            txHashes.tx_hash_y,
            txHashes.tx_hash_z,
            txHashes.tx_hash_w
        );
        console.log('[SIGN_TX] ✓ Proof generated');
        console.log('[SIGN_TX] Proof length:', proof.length, 'chars =', (proof.length - 2) / 2, 'bytes');
        
        // Step 4: Generate VK with Go WASM
        console.log('[SIGN_TX] Generating verification key...');
        const vk = await window.GoWasm.generateVk(
            walletObj.salt,
            walletObj.hash
        );
        console.log('[SIGN_TX] ✓ VK generated');
        console.log('[SIGN_TX] VK length:', vk.length, 'chars =', (vk.length - 2) / 2, 'bytes');
        
        // Step 5: Encode final transaction with Rust WASM
        console.log('[SIGN_TX] Encoding final transaction...');
        const wptx = this.rustWasm.encode_wptx(vk, proof, txJson);
        console.log('[SIGN_TX] ✓ Transaction signed successfully');
        console.log('[SIGN_TX] Final wptx length:', wptx.length, 'chars =', (wptx.length - 2) / 2, 'bytes');
        
        return wptx;
    },

    async testHashBytes(secret) {
        await this.init();
        return this.rustWasm.test_hash_bytes(secret);
    }
};
