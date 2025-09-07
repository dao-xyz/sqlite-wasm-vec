import * as fs from 'fs';
import * as path from 'path';

export interface InitNativeOptions {
  database?: string;
  loadExtension?: string | false;
}
export interface InitNativeResult {
  db: any;
  Database: any;
  version: { libVersion: string; vecVersion?: string };
}

function detectLibc(): 'gnu' | 'musl' {
  try {
    if (process.platform !== 'linux') return 'gnu';
    // Use Node report if available
    const r: any = (process as any).report?.getReport?.();
    if (r?.header?.glibcVersionRuntime) return 'gnu';
  } catch {}
  return 'gnu';
}

function platformTriple(): string {
  const { platform, arch } = process;
  if (platform === 'darwin') return `darwin-${arch}`;
  if (platform === 'win32') return `win32-${arch}`;
  if (platform === 'linux') return `linux-${arch}-${detectLibc()}`;
  return `${platform}-${arch}`;
}

function libExt(): string {
  if (process.platform === 'darwin') return 'dylib';
  if (process.platform === 'win32') return 'dll';
  return 'so';
}

function findLocalPrebuilt(): string | undefined {
  const root = process.cwd();
  const outDir = path.join(root, 'dist', 'native');
  if (!fs.existsSync(outDir)) return undefined;
  const ext = libExt();
  const triple = platformTriple();
  const preferred = `sqlite-vec-${triple}.${ext}`;
  const entries: string[] = fs.readdirSync(outDir);
  const exact = entries.find((f: string) => f === preferred);
  if (exact) return path.join(outDir, exact);
  const any = entries.find((f: string) =>
    /sqlite-vec.*\.(so|dylib|dll)$/i.test(f),
  );
  return any ? path.join(outDir, any) : undefined;
}

export async function initNative(
  options: InitNativeOptions = {},
): Promise<InitNativeResult> {
  const { database = ':memory:', loadExtension } = options;
  const mod = await import('better-sqlite3');
  const Database: any = (mod as any).default || mod;
  const db: any = new Database(database);
  let extPath = loadExtension || findLocalPrebuilt();
  if (extPath) {
    try {
      if (process.env.SQLITE3_VEC_DEBUG === '1') {
        // eslint-disable-next-line no-console
        console.log('[sqlite3-vec] Loading native extension from', extPath);
      }
      if (typeof db.loadExtension === 'function') {
        db.loadExtension(extPath);
      } else if (typeof db.loadExtensionAsync === 'function') {
        await db.loadExtensionAsync(extPath);
      } else {
        throw new Error(
          'Extension loading not supported by this better-sqlite3 build',
        );
      }
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
