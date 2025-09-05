import { test } from 'node:test';
import * as assert from 'node:assert/strict';
// Import the built unified Node entry to test Node usage without bundlers.
import { createDatabase } from '../dist/unified-node.js';
test('unified import and factory availability', async () => {
    assert.equal(typeof createDatabase, 'function');
});
test('unified createDatabase (native mode) basic usage', async () => {
    const db = await createDatabase({});
    await db.open();
    const s = await db.prepare('SELECT sqlite_version() as v');
    const row = s.get?.([]);
    assert.ok(row && (typeof row.v === 'string' || row[0]));
    await db.close();
});
