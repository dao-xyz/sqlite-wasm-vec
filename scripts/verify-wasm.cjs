#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dir = path.join(root, 'sqlite-wasm', 'jswasm');
const required = [
  'sqlite3.wasm',
  'sqlite3.mjs',
  'sqlite3-bundler-friendly.mjs',
  'sqlite3-worker1-promiser.mjs',
];

const missing = required.filter((f) => !fs.existsSync(path.join(dir, f)));
if (missing.length) {
  console.error('[verify-wasm] Missing required payload files in', dir);
  for (const f of missing) console.error(' -', f);
  console.error('\nFix: run `npm run build` (or ensure prebuilts are checked in).');
  process.exit(1);
} else {
  console.log('[verify-wasm] Payload OK in', dir);
}

