import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  createDatabase,
  resolveNativeExtensionPath,
} from '../dist/unified-node.js';

test('vec0 create/insert/query works (native ext present)', async () => {
  const extPath = resolveNativeExtensionPath();
  if (!extPath) return; // skip if no native ext available

  const db = await createDatabase({});
  await db.open();
  await db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS v USING vec0(vector float[3])');

  const toVec = () => new Float32Array([Math.random(), Math.random(), Math.random()]);
  const ins = await db.prepare('INSERT INTO v(rowid,vector) VALUES(?, ?)');
  for (let i = 1; i <= 4; i++) {
    const vec = toVec();
    if (process.env.SQLITE3_VEC_DEBUG === '1') {
      console.log('[test][insert]', { rowid: i, vector: `Float32Array(${vec.length})` });
    }
    // Use BigInt for rowid to ensure SQLITE_INTEGER binding across environments
    ins.run([BigInt(i), vec.buffer]);
  }

  const probe = toVec();
  const q = await db.prepare(
    'SELECT rowid, vec_distance_l2(vector, ?) AS d FROM v ORDER BY d LIMIT 2',
  );
  const rows = q.all([probe.buffer]);
  if (process.env.SQLITE3_VEC_DEBUG === '1') {
    console.log('[test][query]', { probe: `Float32Array(${probe.length})`, rows });
  }
  assert.ok(Array.isArray(rows) && rows.length === 2);
  assert.ok(typeof rows[0].d === 'number');
  await db.close();
});
