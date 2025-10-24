let wasmModule = null;
let wasmInstance = null;

async function initWasm() {
    if (wasmModule) return;
    
    const response = await fetch('./wasm/rust/eon_wallet_wasm_bg.wasm');
    const wasmBytes = await response.arrayBuffer();
    
    const imports = {
        './eon_wallet_wasm_bg.js': {
            __wbindgen_string_new: (ptr, len) => {
                const mem = new Uint8Array(wasmInstance.exports.memory.buffer);
                const bytes = mem.slice(ptr, ptr + len);
                return new TextDecoder().decode(bytes);
            },
            __wbg_log_1c6e2c1f42e49439: (ptr, len) => {
                const mem = new Uint8Array(wasmInstance.exports.memory.buffer);
                const bytes = mem.slice(ptr, ptr + len);
                const str = new TextDecoder().decode(bytes);
                console.log(str);
            },
            __wbindgen_throw: (ptr, len) => {
                const mem = new Uint8Array(wasmInstance.exports.memory.buffer);
                const bytes = mem.slice(ptr, ptr + len);
                const str = new TextDecoder().decode(bytes);
                throw new Error(str);
            }
        }
    };
    
    const result = await WebAssembly.instantiate(wasmBytes, imports);
    wasmModule = result.module;
    wasmInstance = result.instance;
}

function callWasmFunction(funcName, ...args) {
    const fn = wasmInstance.exports[funcName];
    if (!fn) {
        throw new Error(`Function ${funcName} not found in WASM module`);
    }
    return fn(...args);
}

function wasmStringToJS(ptr, len) {
    const mem = new Uint8Array(wasmInstance.exports.memory.buffer);
    const bytes = mem.slice(ptr, ptr + len);
    return new TextDecoder().decode(bytes);
}

function jsStringToWasm(str) {
    const bytes = new TextEncoder().encode(str);
    const ptr = wasmInstance.exports.__wbindgen_malloc(bytes.length);
    const mem = new Uint8Array(wasmInstance.exports.memory.buffer);
    mem.set(bytes, ptr);
    return { ptr, len: bytes.length };
}

self.onmessage = async (e) => {
    const { id, operation, data } = e.data;
    try {
        await initWasm();
        let result;
        
        switch (operation) {
            case 'create_wallet': {
                const secret = jsStringToWasm(data.secret);
                const retPtr = callWasmFunction('create_wallet', secret.ptr, secret.len);
                const retStr = wasmStringToJS(retPtr, 1000); // Adjust length as needed
                result = JSON.parse(retStr);
                break;
            }
            case 'import_wallet': {
                const json = jsStringToWasm(data.wallet_json);
                const retPtr = callWasmFunction('import_wallet', json.ptr, json.len);
                const retStr = wasmStringToJS(retPtr, 1000);
                result = retStr;
                break;
            }
            case 'verify_wallet': {
                const json = jsStringToWasm(data.wallet_json);
                const secret = jsStringToWasm(data.secret);
                result = callWasmFunction('verify_wallet', json.ptr, json.len, secret.ptr, secret.len);
                break;
            }
            case 'calculate_tx_hashes': {
                const txJson = jsStringToWasm(data.tx_json);
                const secret = jsStringToWasm(data.secret);
                const retPtr = callWasmFunction('calculate_tx_hashes', txJson.ptr, txJson.len, secret.ptr, secret.len);
                const retStr = wasmStringToJS(retPtr, 1000);
                result = JSON.parse(retStr);
                break;
            }
            case 'encode_wptx': {
                const vk = jsStringToWasm(data.vk);
                const proof = jsStringToWasm(data.proof);
                const txJson = jsStringToWasm(data.tx_json);
                const retPtr = callWasmFunction('encode_wptx', vk.ptr, vk.len, proof.ptr, proof.len, txJson.ptr, txJson.len);
                const retStr = wasmStringToJS(retPtr, 10000);
                result = retStr;
                break;
            }
            case 'test_hash_bytes': {
                const secret = jsStringToWasm(data.secret);
                const retPtr = callWasmFunction('test_hash_bytes', secret.ptr, secret.len);
                const retStr = wasmStringToJS(retPtr, 100);
                result = retStr;
                break;
            }
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
        
        self.postMessage({ id, result });
    } catch (error) {
        self.postMessage({ id, error: error.message });
    }
};
