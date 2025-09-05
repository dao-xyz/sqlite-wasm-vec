#!/usr/bin/env node
/*
 * Lightweight postinstall: verify wasm payload exists and print guidance.
 * No network, no native builds — keeps installs safe and predictable.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const wasmDir = path.join(root, 'sqlite-wasm', 'jswasm');
const files = ['sqlite3.wasm', 'sqlite3.mjs'];

const ok = files.every((f) => fs.existsSync(path.join(wasmDir, f)));
if (!ok) {
  console.warn('[sqlite-vec-wasm] Missing wasm payload. Reinstall or run `npm run build`.');
} else {
  // Helpful hints for Node users; keep output short.
  const msg = [
    '[sqlite3-vec] Installed.',
    'Default unified API: import { createDatabase } from "@dao-xyz/sqlite3-vec".',
    'Browser wasm only: import default from "@dao-xyz/sqlite3-vec/wasm".',
    'Node native: import default (or { initNative }) from "@dao-xyz/sqlite3-vec/native".',
  ].join('\n');
  console.log(msg);

  // Attempt to ensure a native sqlite-vec extension is available for Node.
  // 1) Prefer a prebuilt binary download (default). Disable with SQLITE3_VEC_PREBUILT=0
  // 2) Fallback: optional local build if user opts in via SQLITE3_VEC_POSTINSTALL=1
  try {
    const outDir = path.join(root, 'dist', 'native');
    const hasNative = fs.existsSync(outDir) && fs.readdirSync(outDir).some(f => /sqlite-vec.*\.(so|dylib|dll)$/i.test(f));
    if (!hasNative && process.env.SQLITE3_VEC_PREBUILT !== '0') {
      const { spawnSync } = require('child_process');
      const res = spawnSync(process.execPath, ['scripts/fetch-prebuilt.cjs'], {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
      });
      if (res.status !== 0) {
        console.warn('[sqlite3-vec] Prebuilt download not available (optional).');
      }
    }

    const optIn = process.env.SQLITE3_VEC_POSTINSTALL === '1';
    if (!hasNative && optIn) {
      const vecDir = process.env.SQLITE_VEC_DIR;
      if (!vecDir || !fs.existsSync(vecDir)) {
        console.warn('[sqlite3-vec] Skipping native sqlite-vec build: set SQLITE_VEC_DIR to the sqlite-vec repo path.');
      } else {
        console.log('[sqlite3-vec] Building native sqlite-vec extension from', vecDir);
        const res = spawnSync('bash', ['scripts/build-sqlite-vec.sh'], {
          cwd: root,
          stdio: 'inherit',
          env: process.env,
        });
        if (res.status !== 0) {
          console.warn('[sqlite3-vec] Native sqlite-vec build failed (optional).');
        } else {
          console.log('[sqlite3-vec] Native sqlite-vec built successfully.');
        }
      }
    }
  } catch (e) {
    console.warn('[sqlite3-vec] Postinstall native build skipped:', e && e.message ? e.message : String(e));
  }
}
