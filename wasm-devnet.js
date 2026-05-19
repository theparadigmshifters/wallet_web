const WasmWallet = {
    rustWasm: null,
    initPromise: null,

    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            console.log('Initializing eoncli WASM...');
            const wasmModule = await import('./wasm/eoncli-devnet/eoncli.js');
            await wasmModule.default();
            this.rustWasm = wasmModule;
            console.log('✓ eoncli WASM ready');
        })();

        return this.initPromise;
    },

    async createWallet(secret) {
        await this.init();
        const result = this.rustWasm.create_normal_account(secret);
        return JSON.parse(result);
    },

    async createZkWallet(secret) {
        await this.init();
        const result = this.rustWasm.create_zk_account(secret);
        return JSON.parse(result);
    },

    async importWallet(walletData) {
        await this.init();
        // Import just parses and validates the wallet JSON
        const walletJson = typeof walletData === 'string' ? walletData : JSON.stringify(walletData);
        const walletObj = JSON.parse(walletJson);
        // Validate required fields
        if (!walletObj.address || !walletObj.account_type) {
            throw new Error('Invalid wallet data: missing address or account_type');
        }
        return walletObj;
    },

    async verifyWallet(wallet, secret) {
        await this.init();
        const walletJson = typeof wallet === 'string' ? wallet : JSON.stringify(wallet);
        return this.rustWasm.verify_account(walletJson, secret);
    },

    async addressToBech32(addressHex) {
        await this.init();
        return this.rustWasm.address_to_bech32(addressHex);
    },

    async buildAndSignTransaction(wallet, secret, utxos, toAddress, amount, fee) {
        await this.init();

        const walletJson = typeof wallet === 'string' ? wallet : JSON.stringify(wallet);
        const utxosJson = typeof utxos === 'string' ? utxos : JSON.stringify(utxos);

        console.log('[SIGN_TX] Building and signing transaction...');
        const wptx = this.rustWasm.build_and_sign_transaction(
            walletJson, secret, utxosJson, toAddress, amount, fee
        );
        console.log('[SIGN_TX] ✓ Transaction signed successfully');
        return wptx;
    }
};
