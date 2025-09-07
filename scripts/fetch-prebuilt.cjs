#!/usr/bin/env node
/* Download a prebuilt sqlite-vec loadable extension for the current platform.
 * Looks for a GitHub Release matching the package version and an asset named:
 *   sqlite-vec-<platform>.<ext>
 * where <platform> is one of:
 *   - darwin-arm64, darwin-x64
 *   - linux-x64-gnu, linux-x64-musl, linux-arm64-gnu, linux-arm64-musl
 *   - win32-x64, win32-arm64
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pkg = require(path.join(root, 'package.json'));

function detectLibc() {
  try {
    if (process.platform !== 'linux') return 'gnu';
    // Node 12+ has process.report
    const r = process.report?.getReport?.();
    if (r?.header?.glibcVersionRuntime) return 'gnu';
    // Fallback: check for musl in ldd version output
    const { spawnSync } = require('child_process');
    const out = spawnSync('ldd', ['--version'], { encoding: 'utf8' });
    if (/musl/i.test(out.stdout) || /musl/i.test(out.stderr)) return 'musl';
  } catch {}
  return 'gnu';
}

function platformTriple() {
  const { platform, arch } = process;
  if (platform === 'darwin') return `darwin-${arch}`;
  if (platform === 'win32') return `win32-${arch}`;
  if (platform === 'linux') return `linux-${arch}-${detectLibc()}`;
  return `${platform}-${arch}`;
}

function fileExt() {
  if (process.platform === 'darwin') return 'dylib';
  if (process.platform === 'win32') return 'dll';
  return 'so';
}

function repoFromPackage() {
  const url = (pkg.repository && pkg.repository.url) || '';
  const m = url.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/i);
  if (!m) return process.env.SQLITE3_VEC_REPO || 'dao-xyz/sqlite-wasm-vec';
  return `${m[1]}/${m[2]}`;
}

async function download(url, dest) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        // redirect
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
    });
    req.on('error', reject);
  });
}

async function main() {
  const triple = platformTriple();
  const ext = fileExt();
  const verWithV = pkg.version.startsWith('v') ? pkg.version : `v${pkg.version}`;
  const verNoV = verWithV.replace(/^v/, '');
  const resolved = repoFromPackage();
  const candidates = Array.from(
    new Set([
      process.env.SQLITE3_VEC_REPO,
      resolved,
      'dao-xyz/sqlite3-vec', // new canonical repo name
      'dao-xyz/sqlite-wasm-vec', // legacy fallback
    ].filter(Boolean)),
  );
  const asset = `sqlite-vec-${triple}.${ext}`;
  const dest = path.join(root, 'dist', 'native', asset);
  const sumDest = `${dest}.sha256`;

  console.log(`[sqlite3-vec] Fetching prebuilt: ${asset}`);
  console.log(`[sqlite3-vec] Version: ${version}`);
  let lastErr;
  for (const repo of candidates) {
    console.log(`[sqlite3-vec] Trying repo: ${repo}`);
    for (const tag of [verWithV, verNoV]) {
      const base = `https://github.com/${repo}/releases/download/${tag}`;
      const url = `${base}/${asset}`;
      const sumUrl = `${base}/${asset}.sha256`;
      console.log(`[sqlite3-vec] Trying tag: ${tag}`);
      try {
        await download(url, dest);
      console.log('[sqlite3-vec] Downloaded:', dest);
      try {
        await download(sumUrl, sumDest);
        const data = fs.readFileSync(dest);
        const sumLine = fs.readFileSync(sumDest, 'utf8').trim();
        const expected = (sumLine.split(/\s+/)[0] || '').toLowerCase();
        const crypto = require('crypto');
        const actual = crypto.createHash('sha256').update(data).digest('hex');
        if (expected && expected !== actual) throw new Error('Checksum mismatch');
        console.log('[sqlite3-vec] Checksum OK');
      } catch (e) {
        console.warn('[sqlite3-vec] Checksum not verified:', e?.message || String(e));
      }
      process.exit(0);
      } catch (e) {
        lastErr = e;
        console.warn(`[sqlite3-vec] Download failed from ${repo} tag ${tag}:`, e?.message || String(e));
      }
    }
  }
  console.warn('[sqlite3-vec] All download attempts failed. Tried repos:', candidates.join(', '));
  console.warn('[sqlite3-vec] You can override repo via SQLITE3_VEC_REPO=owner/repo');
  process.exit(1);
}

main();
