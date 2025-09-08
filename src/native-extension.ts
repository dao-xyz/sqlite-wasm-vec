import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

function detectLibc(): 'gnu' | 'musl' {
  try {
    if (process.platform !== 'linux') return 'gnu';
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
  return process.platform === 'darwin'
    ? 'dylib'
    : process.platform === 'win32'
      ? 'dll'
      : 'so';
}

function packageRootDir(): string {
  // dist/native-extension.js -> package root
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..');
}

export function findLocalPrebuilt(): string | undefined {
  const outDir = path.join(packageRootDir(), 'dist', 'native');
  if (!fs.existsSync(outDir)) return undefined;
  const ext = libExt();
  const triple = platformTriple();
  const preferred = `sqlite-vec-${triple}.${ext}`;
  const entries: string[] = fs.readdirSync(outDir);
  const exact = entries.find((f: string) => f === preferred);
  if (exact) return path.join(outDir, exact);
  const any = entries.find((f: string) => /sqlite-vec.*\.(so|dylib|dll)$/i.test(f));
  return any ? path.join(outDir, any) : undefined;
}

export function resolveNativeExtensionPath(): string | undefined {
  return findLocalPrebuilt();
}

const ENTRY_POINTS = [
  'sqlite3_extension_init',
  'sqlite3_sqlitevec_init',
  'sqlite3_vec_init',
];

export async function loadVecExtension(db: any, extPath: string, debug = false): Promise<void> {
  const log = (...a: any[]) => debug && console.log('[sqlite3-vec]', ...a);
  const hasSync = typeof db?.loadExtension === 'function';
  const hasAsync = typeof db?.loadExtensionAsync === 'function';
  if (!hasSync && !hasAsync) {
    throw new Error('Extension loading not supported by this better-sqlite3 build');
  }
  log('Loading native extension from', extPath);
  const trySync = () => {
    let lastErr: any;
    for (const ep of ENTRY_POINTS) {
      try {
        db.loadExtension(extPath, ep);
        log('Loaded native extension with', ep);
        return true;
      } catch (e) {
        lastErr = e;
      }
    }
    try {
      db.loadExtension(extPath);
      log('Loaded native extension via filename-derived entry point');
      return true;
    } catch (e2) {
      throw lastErr ?? e2;
    }
  };
  const tryAsync = async () => {
    let lastErr: any;
    for (const ep of ENTRY_POINTS) {
      try {
        await db.loadExtensionAsync(extPath, ep);
        log('Loaded native extension with', ep);
        return true;
      } catch (e) {
        lastErr = e;
      }
    }
    try {
      await db.loadExtensionAsync(extPath);
      log('Loaded native extension via filename-derived entry point');
      return true;
    } catch (e2) {
      throw lastErr ?? e2;
    }
  };

  if (hasSync) {
    trySync();
  } else {
    await tryAsync();
  }
}
