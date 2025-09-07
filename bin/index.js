#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Resolve dirname for ES modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Paths
const sqliteRepoDir = path.resolve(__dirname, '../../sqlite');
const srcDir = path.resolve(sqliteRepoDir, 'ext/wasm/jswasm');
const destDir = path.resolve(process.cwd(), 'sqlite-wasm/jswasm');

// Helper to check if jswasm payload looks valid
const hasValidPayload = (dir) =>
  fs.existsSync(path.join(dir, 'sqlite3.wasm')) &&
  fs.existsSync(path.join(dir, 'sqlite3.mjs'));

// If the external sqlite repo is present, try to build and copy from there.
if (fs.existsSync(sqliteRepoDir)) {
  console.log('Found ../sqlite repo. Building wasm payload with sqlite-vec…');
  try {
    execSync(
      `set -e
       cd ../sqlite
       ./configure --enable-all
       make sqlite3.c
       cd ext/wasm
       make -j8 \
          EXTRA_SRC="sqlite-vec.c" \
          EXTRA_CFLAGS="-DSQLITE_VEC_STATIC -DSQLITE_VEC_OMIT_FS"`,
      { stdio: 'inherit' },
    );
  } catch (e) {
    console.warn(
      'Build from ../sqlite failed or is not permitted in this environment.\n',
      String(e && e.message ? e.message : e),
    );
    if (hasValidPayload(destDir)) {
      console.log(
        'Falling back to existing prebuilt payload at',
        destDir,
        '✅',
      );
      process.exit(0);
    }
    console.error('No prebuilt payload to fall back to.');
    process.exit(1);
  }

  if (!fs.existsSync(srcDir)) {
    console.error('Build succeeded but jswasm directory is missing:', srcDir);
    process.exit(1);
  }

  console.log('Copying jswasm payload from', srcDir, 'to', destDir);
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.cpSync(srcDir, destDir, {
    recursive: true,
    filter: (src) => {
      if (fs.lstatSync(src).isDirectory()) return true; // keep dirs
      return /\.(mjs|js|wasm)$/.test(src); // copy only needed files
    },
  });
  console.log('Built and copied jswasm payload ✅');
} else {
  // No external repo. If a payload already exists in this package, keep it.
  if (hasValidPayload(destDir)) {
    console.log(
      'No ../sqlite repo. Using existing prebuilt payload at',
      destDir,
      '✅',
    );
  } else {
    console.error(
      'No ../sqlite repo found and no prebuilt payload present at',
      destDir,
      '\nPlease either: \n' +
        '  - Clone and prepare ../sqlite with sqlite-vec, then run `npm run build`, or\n' +
        '  - Add a prebuilt jswasm payload to sqlite-wasm/jswasm.',
    );
    process.exit(1);
  }
}
