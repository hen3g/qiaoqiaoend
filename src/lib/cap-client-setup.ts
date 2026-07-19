/**
 * Cap widget defaults to loading WASM from cdn.jsdelivr.net, which is often
 * blocked or hangs in China and can leave Mobile Safari stuck on "验证中…".
 * Point at same-origin assets before `cap-widget` initializes.
 */
export function ensureCapClientAssets() {
  if (typeof window === "undefined") return;

  window.CAP_CUSTOM_WASM_URL = "/cap/cap_wasm_bg.wasm";
}