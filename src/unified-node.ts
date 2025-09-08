// Node-only unified entry which uses better-sqlite3 and auto-loads the sqlite-vec extension.
import type { Database, Statement } from './unified';
import * as fs from 'fs';
import { resolveNativeExtensionPath as resolveExtPath, loadVecExtension } from './native-extension.js';

// platform resolution and prebuilt discovery live in native-extension.ts

export interface CreateOptionsNode {
  database?: string;
  loadExtension?: string | false;
}

/** Returns the resolved path to a local prebuilt sqlite-vec extension, if any. */
export function resolveNativeExtensionPath(): string | undefined {
  return resolveExtPath();
}

import Better from 'better-sqlite3';

export async function createDatabase(
  options: CreateOptionsNode = {},
): Promise<Database> {
  const { database = ':memory:', loadExtension } = options;
  const BetterAny: any = Better as any;
  let db: any;
  const statements = new Map<string, Statement>();
  const dbFileName = database;
  const DEBUG = process.env.SQLITE3_VEC_DEBUG === '1';
  const dlog = (...args: any[]) => {
    if (DEBUG) console.log('[sqlite3-vec][node]', ...args);
  };

  const open = () => {
    if (db && db.open) return db;
    db = new BetterAny(dbFileName, { fileMustExist: false, readonly: false });
    try {
      db.pragma('journal_mode = WAL');
    } catch {}
    try {
      db.pragma('foreign_keys = on');
    } catch {}
    const extPath = loadExtension || resolveNativeExtensionPath();
    if (extPath) {
      dlog('loading vec extension from', extPath);
      loadVecExtension(db, extPath, DEBUG);
    }
    return db;
  };

  const finalizeAll = () => {
    statements.clear();
  };
  const close = () => {
    finalizeAll();
    if (db) {
      db.close();
      db = undefined;
    }
  };
  const drop = () => {
    try {
      if (db && dbFileName !== ':memory:') {
        try {
          fs.rmSync(dbFileName as string);
        } catch {}
      }
    } finally {
      close();
    }
  };

  const toBuffer = (v: any): any => {
    if (!v) return v;
    // Convert ArrayBuffer/TypedArray/DataView to Node Buffer for better-sqlite3 BLOB binding
    if (typeof ArrayBuffer !== 'undefined') {
      if (v instanceof ArrayBuffer) return Buffer.from(new Uint8Array(v));
      if (ArrayBuffer.isView?.(v)) {
        const u8 = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
        return Buffer.from(u8);
      }
    }
    return v;
  };
  const summarize = (v: any): any => {
    if (v == null) return v;
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'string') return `string(len=${v.length})`;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(v)) return `Buffer(${v.byteLength})`;
    if (v instanceof ArrayBuffer) return `ArrayBuffer(${v.byteLength})`;
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView?.(v)) {
      const ctor = (v as any).constructor?.name || 'TypedArray';
      const len = (v as any).length ?? (v.byteLength ?? '?');
      return `${ctor}(${len})`;
    }
    if (typeof v === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(v)) out[k] = summarize((v as any)[k]);
      return out;
    }
    return typeof v;
  };
  const normVals = (values?: any[] | undefined): any[] | undefined =>
    values ? values.map((x) => toBuffer(x)) : values;
  const normObj = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    const out: any = Array.isArray(obj) ? [] : {};
    if (Array.isArray(obj)) return normVals(obj);
    for (const k of Object.keys(obj)) out[k] = toBuffer(obj[k]);
    return out;
  };
  const toNumericParamObj = (arr: any[]): Record<string, any> => {
    const o: Record<string, any> = {};
    for (let i = 0; i < arr.length; i++) o[String(i + 1)] = arr[i];
    return normObj(o);
  };

  type Method = 'run' | 'get' | 'all';
  type ParamStyle = 'positional' | 'named' | 'none';
  type PositionalKind = 'numeric' | 'anonymous' | undefined;
  interface SqlMeta {
    style: ParamStyle;
    positionalKind?: PositionalKind;
    paramCount: number;
  }

  const analyzeSql = (sql: string): SqlMeta => {
    // Very lightweight analysis; sufficient for our test/usage.
    const namedRe = /[:@$][A-Za-z_][A-Za-z0-9_]*/g;
    const numericRe = /\?(\d+)/g;
    const anonRe = /\?(?!\d)/g;
    const hasNamed = namedRe.test(sql);
    if (hasNamed) return { style: 'named', paramCount: 0 };
    let maxIndex = 0;
    let m: RegExpExecArray | null;
    numericRe.lastIndex = 0;
    while ((m = numericRe.exec(sql))) {
      const idx = parseInt(m[1]!, 10);
      if (idx > maxIndex) maxIndex = idx;
    }
    if (maxIndex > 0) return { style: 'positional', positionalKind: 'numeric', paramCount: maxIndex };
    // Count anonymous ? occurrences
    const qs = sql.match(anonRe)?.length ?? 0;
    if (qs > 0) return { style: 'positional', positionalKind: 'anonymous', paramCount: qs };
    return { style: 'none', paramCount: 0 };
  };

  const mapParams = (v: any): any | undefined => {
    if (v == null) return undefined;
    if (Array.isArray(v)) return toNumericParamObj(normVals(v) ?? []);
    return normObj(v);
  };
  const callWithParams = (stmt: any, method: Method, v: any, meta: SqlMeta) => {
    const params = mapParams(v);
    if (DEBUG) dlog(`stmt.${method}()`, { params: summarize(params), meta });
    // Prefer varargs for positional placeholders to avoid CI differences.
    if (Array.isArray(v) && meta.style === 'positional') {
      const a = normVals(v) ?? [];
      const toUse = meta.paramCount > 0 && a.length > meta.paramCount ? a.slice(0, meta.paramCount) : a;
      if (a.length > toUse.length && DEBUG) dlog('slicing extra params for positional binding', { have: a.length, use: toUse.length });
      return stmt[method](...toUse);
    }
    // Fallback: deterministic bind-first with (possibly named) object.
    if (params === undefined) return stmt[method]();
    stmt.bind(params);
    return stmt[method]();
  };

  const wrapStmt = (stmt: any, meta: SqlMeta): Statement => {
    let bound: any[] | undefined = undefined;
  return {
      bind(values: any[]) {
  bound = values;
        return this;
      },
      finalize() {},
      get(values?: any[]) {
    const v = (values ?? bound) as any;
    return callWithParams(stmt, 'get', v, meta);
      },
      run(values: any[]) {
    const v = (values ?? bound) as any;
    callWithParams(stmt, 'run', v, meta);
        bound = undefined;
      },
      async reset() {
        return this;
      },
      all(values: any[]) {
    const v = (values ?? bound) as any;
    return callWithParams(stmt, 'all', v, meta);
      },
      step() {
        return false;
      },
    };
  };

  return {
    open,
    close,
    drop,
    exec(sql: string) {
  if (DEBUG) dlog('exec', sql);
  return open().exec(sql);
    },
    async prepare(sql: string, id?: string) {
      open();
  if (DEBUG) dlog('prepare', { id, sql });
      if (id != null && statements.has(id)) {
        const prev = statements.get(id)!;
        await (prev.reset?.() as any);
        return prev;
      }
  const meta = analyzeSql(sql);
  const stmt = open().prepare(sql);
  const wrapped = wrapStmt(stmt, meta);
      if (id != null) statements.set(id, wrapped);
      return wrapped;
    },
    status: () => (db ? 'open' : 'closed'),
    statements,
  } as Database;
}

export default { createDatabase } as any;
