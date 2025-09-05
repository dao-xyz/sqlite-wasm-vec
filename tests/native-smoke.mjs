// Native smoke test: runs only if better-sqlite3 is available.
// If SQLITE_VEC_EXT is provided, attempts to load and call vec_version().
(async () => {
  try {
    const mod = await import('better-sqlite3');
    const { default: initNative } = await import('../dist/native.js');
    const ext = process.env.SQLITE_VEC_EXT;
    const { db, version } = await initNative({ database: ':memory:', loadExtension: ext });
    if (!version.libVersion) throw new Error('No sqlite version');
    if (ext) {
      const v = db.prepare('select vec_version() as v').get().v;
      if (!v) throw new Error('vec_version() not available after loading extension');
    }
    db.close();
    console.log('[native-smoke] ok', version);
  } catch (e) {
    if (/Cannot find module 'better-sqlite3'/.test(String(e)) || /ERR_MODULE_NOT_FOUND/.test(String(e))) {
      console.log('[native-smoke] skipped: better-sqlite3 not installed');
      return;
    }
    console.error('[native-smoke] failed:', e && e.message ? e.message : String(e));
    process.exit(1);
  }
})();
