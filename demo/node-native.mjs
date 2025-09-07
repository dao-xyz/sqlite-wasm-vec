// Node native demo using better-sqlite3; optionally loads sqlite-vec extension
import initNative from '../dist/native.js';
import fs from 'node:fs';
import path from 'node:path';

const extFromEnv = process.env.SQLITE_VEC_EXT;
const localDist = path.join(process.cwd(), 'dist', 'native');
const pickLocalExt = () => {
  if (!fs.existsSync(localDist)) return undefined;
  for (const f of fs.readdirSync(localDist)) {
    if (/sqlite-vec.*\.(dylib|so|dll)$/i.test(f))
      return path.join(localDist, f);
  }
  return undefined;
};

const loadExtension = extFromEnv || pickLocalExt();

const { db, version } = await initNative({
  database: 'demo-native.db',
  loadExtension,
});

console.log(
  'SQLite',
  version.libVersion,
  '| sqlite-vec',
  version.vecVersion || '(not loaded)',
);
db.exec('CREATE TABLE IF NOT EXISTS t (a,b)');
db.prepare('INSERT INTO t(a,b) VALUES (?,?)').run(1, 2);
console.log('Row:', db.prepare('SELECT a,b FROM t LIMIT 1').get());
try {
  const v = db.prepare('select vec_version() as v').get().v;
  console.log('sqlite-vec version:', v);
} catch {
  console.log('sqlite-vec not available (no extension loaded)');
}
db.close();
