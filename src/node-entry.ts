import * as fs from 'fs';
import { resolveNativeExtensionPath as resolveExtPath, loadVecExtension } from './native-extension.js';

export interface InitNativeOptions {
  database?: string;
  loadExtension?: string | false;
}
export interface InitNativeResult {
  db: any;
  Database: any;
  version: { libVersion: string; vecVersion?: string };
}

export async function initNative(
  options: InitNativeOptions = {},
): Promise<InitNativeResult> {
  const { database = ':memory:', loadExtension } = options;
  const mod = await import('better-sqlite3');
  const Database: any = (mod as any).default || mod;
  const db: any = new Database(database);
  let extPath = loadExtension || resolveExtPath();
  if (extPath) {
    try {
      await loadVecExtension(db, extPath, process.env.SQLITE3_VEC_DEBUG === '1');
    } catch (e: any) {
      const err = new Error(
        `Failed to load sqlite-vec extension from: ${extPath}\n${e?.message || e}`,
      );
      (err as any).cause = e;
      throw err;
    }
  }
  const libVersion = String(db.prepare('select sqlite_version() as v').get().v);
  let vecVersion: string | undefined;
  try {
    vecVersion = db.prepare('select vec_version() as v').get().v;
  } catch {}
  return { db, Database, version: { libVersion, vecVersion } };
}

export async function initWasmNode(options: any = {}): Promise<any> {
  // Fallback to the browser-style initializer in Node. This provides in-memory usage.
  const init: any = (await import('../index.mjs')).default;
  return init(options);
}

export default initWasmNode;
