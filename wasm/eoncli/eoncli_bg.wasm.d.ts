/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const create_normal_account: (a: number, b: number) => [number, number, number, number];
export const create_zk_account: (a: number, b: number) => [number, number, number, number];
export const get_account_address: (a: number, b: number) => [number, number, number, number];
export const address_to_bech32: (a: number, b: number) => [number, number, number, number];
export const resolve_address: (a: number, b: number) => [number, number, number, number];
export const parse_out_amount: (a: number, b: number) => [number, number, number, number];
export const verify_account: (a: number, b: number, c: number, d: number) => [number, number, number];
export const sign_transaction: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
export const calculate_zk_proof_inputs: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
export const encode_zk_wptx: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
export const build_and_sign_transaction: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number, number, number];
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_export_2: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
