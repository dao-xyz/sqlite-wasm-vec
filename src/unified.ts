// Common types only. Implementations live in unified-browser.ts and unified-node.ts.
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

export default {} as any;
