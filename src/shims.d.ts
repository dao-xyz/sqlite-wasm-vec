declare module 'better-sqlite3';
declare module '../sqlite-wasm/jswasm/sqlite3-node.mjs';
declare module './node-entry';
declare module '../index.mjs' {
  const init: any;
  export default init;
  export const sqlite3Worker1Promiser: any;
}
