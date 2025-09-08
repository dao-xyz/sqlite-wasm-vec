import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

test('consumer import by package name works', async () => {
  // Create temp project with node_modules alias to this repo
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlite3-vec-import-'));
  const nm = path.join(tmp, 'node_modules', '@dao-xyz');
  fs.mkdirSync(nm, { recursive: true });
  const linkTarget = process.cwd();
  const pkgPath = path.join(nm, 'sqlite3-vec');
  try {
    fs.symlinkSync(linkTarget, pkgPath, 'dir');
  } catch (e) {
    // Fallback: copy if symlink not permitted
    fs.cpSync(linkTarget, pkgPath, { recursive: true, dereference: true });
  }

  // Write an ESM script which imports the package by name
  const runner = path.join(tmp, 'runner.mjs');
  fs.writeFileSync(
    runner,
    `import { createDatabase, resolveNativeExtensionPath } from '@dao-xyz/sqlite3-vec';
     const db = await createDatabase({});
     await db.open();
     const s = await db.prepare('select sqlite_version() as v');
     const row = s.get?.([]);
     if (!row || !(row.v || row[0])) throw new Error('no sqlite_version');
     // Not asserting ext presence; just ensure the API is callable
     void resolveNativeExtensionPath();
     await db.close();
     console.log('ok');
    `,
  );

  const res = spawnSync(process.execPath, [runner], {
    cwd: tmp,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    console.error('[import-name] stderr:', res.stderr);
    console.error('[import-name] stdout:', res.stdout);
  }
  assert.equal(res.status, 0);
  assert.match(res.stdout || '', /ok/);
});
