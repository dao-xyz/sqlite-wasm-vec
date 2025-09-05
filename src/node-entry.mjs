// Node entry: expose both native (better-sqlite3) and wasm initializers.
// Default export is the wasm initializer for safer out-of-the-box usage.

/**
 * Initialize a better-sqlite3 Database, optionally loading sqlite-vec.
 * @param {Object} [options]
 * @param {string} [options.database] Path to database file. Defaults to ':memory:'.
 * @param {string|false} [options.loadExtension] Path to sqlite-vec loadable extension (.so/.dylib/.dll).
 *        If falsy/omitted, no extension is loaded.
 * @returns {Promise<{ db: any, Database: any, version: { libVersion: string, vecVersion?: string } }>} 
 */
export async function initNative(options = {}) {
  const { database = ':memory:', loadExtension } = options;
  const mod = await import('better-sqlite3');
  const Database = mod.default || mod;
  const db = new Database(database);
  if (loadExtension) {
    try {
      if (typeof db.loadExtension === 'function') {
        db.loadExtension(loadExtension);
      } else if (typeof db.loadExtensionAsync === 'function') {
        await db.loadExtensionAsync(loadExtension);
      } else {
        throw new Error('Extension loading not supported by this better-sqlite3 build');
      }
    } catch (e) {
      const err = new Error(`Failed to load sqlite-vec extension from: ${loadExtension}\n${e?.message || e}`);
      err.cause = e;
      throw err;
    }
  }
  const libVersion = String(db.prepare('select sqlite_version() as v').get().v);
  let vecVersion;
  try {
    vecVersion = db.prepare('select vec_version() as v').get().v;
  } catch {}
  return { db, Database, version: { libVersion, vecVersion } };
}

/**
 * Initialize the wasm build for Node (in-memory only).
 * @param {Object} [options] Passed to the wasm initializer
 * @returns {Promise<any>} sqlite3 wasm module
 */
export async function initWasmNode(options = {}) {
  const init = (await import('../sqlite-wasm/jswasm/sqlite3-node.mjs')).default;
  return init(options);
}

// Default to wasm initializer to ensure out-of-the-box functionality without native deps
export default initWasmNode;

