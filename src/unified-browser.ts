// Browser-only unified entry which never references better-sqlite3.
// Implements the wasm path inline to keep bundlers happy.

export type Status = 'open' | 'closed';

export interface Statement {
  bind(values: any[]): Promise<Statement> | Statement;
  finalize(): Promise<void> | void;
  get(values?: any[]): any | undefined;
  run(values: any[]): void;
  reset(): Promise<Statement> | Statement;
  all(values: any[]): any[];
  step(): boolean;
}

export interface Database {
  open(): Promise<any> | any;
  close(): Promise<void> | void;
  drop(): Promise<void> | void;
  exec(sql: string): any;
  prepare(sql: string, id?: string): Promise<Statement> | Statement;
  status(): Status;
  statements: Map<string, Statement>;
}

export interface CreateOptions {
  directory?: string;
  logger?: { print?: (...a: any[]) => void; printErr?: (...a: any[]) => void };
}

import sqlite3InitModule from '../index.mjs';

export async function createDatabase(options: CreateOptions = {}): Promise<Database> {
  const { directory, logger } = options;
  const { print = () => {}, printErr = () => {} } = logger || {};
  const sqlite3: any = await sqlite3InitModule({ print, printErr });

  let sqliteDb: any;
  let poolUtil: any;
  let dbFileName: string | undefined;
  const statements = new Map<string, Statement>();

  const open = async () => {
    if (sqliteDb) return sqliteDb;
    if (directory) {
      const dir = directory.replace(/^\./, '');
      dbFileName = `${dir}/db.sqlite`;
      try {
        poolUtil = poolUtil || (await sqlite3.installOpfsSAHPoolVfs({ directory: `${dir}/opfs-pool` }));
        sqliteDb = new poolUtil.OpfsSAHPoolDb(dbFileName);
      } catch {
        sqliteDb = new sqlite3.oo1.DB(':memory:');
      }
    } else {
      sqliteDb = new sqlite3.oo1.DB(':memory:');
    }
    try { sqliteDb.exec('PRAGMA journal_mode = WAL'); } catch {}
    try { sqliteDb.exec('PRAGMA foreign_keys = on'); } catch {}
    return sqliteDb;
  };

  const close = async () => {
    for (const s of statements.values()) await (s.finalize?.() as any);
    statements.clear();
    await sqliteDb?.close?.();
    sqliteDb = undefined;
  };

  const drop = async () => {
    if (poolUtil && dbFileName) try { await poolUtil.unlink(dbFileName); } catch {}
    await close();
  };

  const wrapStmt = (stmt: any): Statement => ({
    async bind(values: any[]) { await stmt.bind(values); return this; },
    async finalize() { const rc = await stmt.finalize(); if (rc && rc > 0) throw new Error('Error finalizing statement'); },
    get(values?: any[]) { if (values?.length) stmt.bind(values); const ok = stmt.step(); if (!ok) { stmt.reset(); return undefined; } const r = stmt.get({}); stmt.reset(); return r; },
    run(values: any[]) { if (values?.length) stmt.bind(values); stmt.stepReset(); },
    async reset() { try { await stmt.reset(); } catch { /* ignore */ } return this; },
    all(values: any[]) { if (values?.length) stmt.bind(values); const out: any[] = []; while (stmt.step()) out.push(stmt.get({})); stmt.reset(); return out; },
    step() { return stmt.step(); },
  });

  return {
    open,
    close,
    drop,
    exec(sql: string) { return sqliteDb.exec(sql); },
    async prepare(sql: string, id?: string) {
      await open();
      if (id != null && statements.has(id)) {
        const prev = statements.get(id)!; await (prev.reset?.() as any); return prev;
      }
      const stmt = sqliteDb.prepare(sql);
      const wrapped = wrapStmt(stmt);
      if (id != null) statements.set(id, wrapped);
      return wrapped;
    },
    status: () => (sqliteDb?.isOpen?.() ? 'open' : 'closed'),
    statements,
  } as Database;
}

export default { createDatabase };
