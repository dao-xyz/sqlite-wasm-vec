import sqlite3InitModule from '../index.mjs';

const post = (cssClass, ...args) =>
  postMessage({ type: 'log', payload: { cssClass, args } });

const randVec = () =>
  Uint8Array.from({ length: 3 }, (_) => Math.random() * 256);

const run = (sqlite3) => {
  const db = new sqlite3.oo1.DB();

  const ver = db.exec('select vec_version() as v').get().v;

  post('', 'SQLite', sqlite3.version.libVersion, '| sqlite-vec', ver);

  db.exec('CREATE VIRTUAL TABLE v USING vec0(vector float[3])');

  const ins = db.prepare('INSERT INTO v(rowid,vector) VALUES(?1,?2)');
  for (let i = 1; i <= 4; ++i) {
    ins.bind({ 1: i, 2: randVec().buffer }).stepReset();
  }
  ins.finalize();

  const probe = randVec();
  post('', 'Probe', [...probe]);

  db.exec({
    sql: `
      SELECT rowid, vec_distance_cosine(vector, ?1) AS score
        FROM v
    ORDER BY score LIMIT 2`,
    bind: [probe.buffer],
    callback: (r) => post('', r),
  });

  db.close();
};

sqlite3InitModule({ print: post, printErr: (...a) => post('error', ...a) })
  .then(run)
  .catch((e) => post('error', e.message));
