/* tslint:disable */
/* eslint-disable */
export function create_normal_account(_secret: string): string;
export function create_zk_account(secret: string): string;
export function get_account_address(account_json: string): string;
export function address_to_bech32(address_hex: string): string;
export function resolve_address(address: string): string;
export function parse_out_amount(out_hex: string): string;
export function verify_account(account_json: string, secret: string): boolean;
export function sign_transaction(account_json: string, secret: string, tx_hex: string): string;
export function calculate_zk_proof_inputs(_account_json: string, _secret: string, _tx_json: string): string;
export function encode_zk_wptx(_vk_hex: string, _proof_hex: string, _tx_json: string): string;
/**
 * Build and sign a transaction from a list of UTXOs and return the wptx hex.
 *
 * * `utxos_json` — JSON array `[{"id":"0x...","out":"0x..."}, ...]`
 * * `to_address` — 0x... or eon1... bech32
 * * `amount`, `fee` — decimal strings
 */
export function build_and_sign_transaction(account_json: string, secret: string, utxos_json: string, to_address: string, amount: string, fee: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly create_normal_account: (a: number, b: number) => [number, number, number, number];
  readonly create_zk_account: (a: number, b: number) => [number, number, number, number];
  readonly get_account_address: (a: number, b: number) => [number, number, number, number];
  readonly address_to_bech32: (a: number, b: number) => [number, number, number, number];
  readonly resolve_address: (a: number, b: number) => [number, number, number, number];
  readonly parse_out_amount: (a: number, b: number) => [number, number, number, number];
  readonly verify_account: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly sign_transaction: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly calculate_zk_proof_inputs: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly encode_zk_wptx: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly build_and_sign_transaction: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number, number, number];
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
