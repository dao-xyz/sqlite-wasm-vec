import sqlite3InitModule from '../index.mjs';

const out = document.querySelector('.main-thread');

const log = (...a) => out.append(Object.assign(document.createElement('div'), {
  textContent: a.join(' ')
}));
const logErr = (...a) => log('[ERR]', ...a);

const randomVec = (dim = 3) =>
  Uint8Array.from({ length: dim }, () => Math.floor(Math.random() * 256));

const start = (sqlite3) => {
    log('Spawning main thread…');
     const db = new sqlite3.oo1.DB('/mydb.sqlite3-vec', 'ct');
     const verStatement = db.prepare('select vec_version() as v')
  console.log("STEP!")
  verStatement.step()
    const ver = verStatement.get({}).v;
  log('SQLite', sqlite3.version.libVersion,
      '| sqlite-vec', ver);


  /* ---- VECTOR PART ---- */
  db.exec(`CREATE VIRTUAL TABLE v USING vec0(vector float[3])`);

  const insert = db.prepare('INSERT INTO v(rowid,vector) VALUES(?,?)');
  for (let id = 1; id <= 5; ++id) {
    insert.bind({
      1: id,
      2: randomVec().buffer                 // auto-binds as blob
    }).stepReset();
  }
  insert.finalize();

  const query = db.prepare(`
    SELECT rowid,
           vec_distance_l2(vector, ?1) AS d
      FROM v
     ORDER BY d LIMIT 3
  `);

  const probe = randomVec();
  log('Probe =', [...probe]);

  query.bind({1: probe.buffer});
  while (query.step()) log('→', query.get());
  query.finalize();
  /* ---- /VECTOR PART ---- */

  db.close();
};

log('Loading SQLite…');
sqlite3InitModule({ print: log, printErr: logErr })
  .then(start)
  .catch(e => logErr(e));
