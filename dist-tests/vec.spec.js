import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { createDatabase, resolveNativeExtensionPath } from '../dist/unified-node.js';
test('vec extension provides vec_version() when present', async () => {
    const extPath = resolveNativeExtensionPath();
    if (!extPath) {
        // No prebuilt/native extension present in this environment; skip.
        return;
    }
    const db = await createDatabase({});
    await db.open();
    const stmt = await db.prepare('select vec_version() as v');
    const row = stmt.get?.([]);
    assert.ok(row && typeof (row.v ?? row[0]) === 'string');
    await db.close();
});
