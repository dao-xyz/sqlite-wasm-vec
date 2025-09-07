import { sqlite3Worker1Promiser } from '../index.mjs';

const out = document.querySelector('.worker-promiser');
const log = (...a) =>
  out.append(
    Object.assign(document.createElement('div'), { textContent: a.join(' ') }),
  );

const randVec = () =>
  Uint8Array.from({ length: 4 }, (_) => Math.random() * 256);

(async () => {
  log('Spawning worker…');
  const promiser = await new Promise((res) => {
    const p = sqlite3Worker1Promiser({ onready: () => res(p) });
  });

  const { version } = (await promiser('config-get', {})).result;
  log(
    'SQLite',
    version.libVersion,
    '| sqlite-vec',
    version.vecVersion /* added by vec0 */,
  );

  /* open OPFS DB so the table persists between reloads */
  const { dbId } = await promiser('open', {
    filename: 'file:vec-demo.sqlite3?vfs=opfs',
  });

  await promiser('exec', {
    dbId,
    sql: 'CREATE VIRTUAL TABLE IF NOT EXISTS v USING vec0(vector float[4])',
  });

  /* insert 3 random vectors if table empty */
  const rows = (
    await promiser('exec', {
      dbId,
      sql: 'SELECT count(*) AS n FROM v',
    })
  ).result.rows[0].n;
  if (!+rows) {
    const stmt = await promiser('prepare', {
      dbId,
      sql: 'INSERT INTO v(rowid,vector) VALUES(?1,?2)',
    });
    for (let i = 1; i <= 3; ++i)
      await promiser('bind', { stmt, bind: [i, randVec().buffer] }),
        await promiser('step', { stmt }),
        await promiser('reset', { stmt });
    await promiser('finalize', { stmt });
  }

  const probe = randVec();
  log('Probe', [...probe]);

  await promiser('exec', {
    dbId,
    sql: `SELECT rowid,
                vec_dot(vector, ?1) AS sim
           FROM v
       ORDER BY sim DESC`,
    bind: [probe.buffer],
    callback: ({ row }) => row && log(JSON.stringify(row)),
  });

  await promiser('close', { dbId });
})();
