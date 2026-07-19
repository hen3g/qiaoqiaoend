import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(import.meta.url);

const wasmPkgDir = dirname(require.resolve("@cap.js/wasm/package.json"));
const src = join(wasmPkgDir, "browser", "cap_wasm_bg.wasm");
const destDir = join(root, "public", "cap");
const dest = join(destDir, "cap_wasm_bg.wasm");

if (!existsSync(src)) {
  console.error(`[copy-cap-assets] missing wasm at ${src}`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-cap-assets] copied ${src} -> ${dest}`);
