/* tslint:disable */
/* eslint-disable */
export function test_hash_bytes(secret: string): string;
export function create_wallet(secret: string): string;
export function import_wallet(wallet_json: string): string;
export function verify_wallet(wallet_json: string, secret: string): boolean;
export function calculate_tx_hashes(tx_json: string, secret: string): string;
export function encode_wptx(vk_hex: string, proof_hex: string, tx_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly test_hash_bytes: (a: number, b: number) => [number, number];
  readonly create_wallet: (a: number, b: number) => [number, number, number, number];
  readonly import_wallet: (a: number, b: number) => [number, number, number, number];
  readonly verify_wallet: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly calculate_tx_hashes: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly encode_wptx: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
