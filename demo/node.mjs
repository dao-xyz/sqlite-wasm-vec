// Node native demo using unified Node API
import {
  createDatabase,
  resolveNativeExtensionPath,
} from '../dist/unified-node.js';

console.log('Starting Node demo (native)...');
const db = await createDatabase({ database: 'demo-native.db' });
await db.open();
console.log(
  'Resolved native extension:',
  resolveNativeExtensionPath() || '(none)',
);

try {
  await db.exec('CREATE TABLE IF NOT EXISTS t(a,b)');
  for (let i = 20; i <= 25; ++i) {
    const ins = await db.prepare('INSERT INTO t(a,b) VALUES (?1,?2)');
    ins.run([i, i * 2]);
  }
  const sel = await db.prepare('SELECT a FROM t ORDER BY a LIMIT 3');
  console.log('Rows:', sel.all([]));
} finally {
  await db.close();
}
