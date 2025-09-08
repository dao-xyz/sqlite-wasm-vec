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
      loadVecExtension(db, extPath, process.env.SQLITE3_VEC_DEBUG === '1');
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
  const normVals = (values?: any[] | undefined): any[] | undefined =>
    values ? values.map((x) => toBuffer(x)) : values;

  const wrapStmt = (stmt: any): Statement => {
    let bound: any[] | undefined = undefined;
    return {
      bind(values: any[]) {
        bound = values;
        return this;
      },
      finalize() {},
      get(values?: any[]) {
        return stmt.get(normVals(values ?? bound));
      },
      run(values: any[]) {
        stmt.run(normVals(values ?? bound));
        bound = undefined;
      },
      async reset() {
        return this;
      },
      all(values: any[]) {
        return stmt.all(normVals(values ?? bound));
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
      return open().exec(sql);
    },
    async prepare(sql: string, id?: string) {
      open();
      if (id != null && statements.has(id)) {
        const prev = statements.get(id)!;
        await (prev.reset?.() as any);
        return prev;
      }
      const stmt = open().prepare(sql);
      const wrapped = wrapStmt(stmt);
      if (id != null) statements.set(id, wrapped);
      return wrapped;
    },
    status: () => (db ? 'open' : 'closed'),
    statements,
  } as Database;
}

export default { createDatabase } as any;
