# @dao-xyz/sqlite3-vec

Unified SQLite + sqlite-vec (vec0) for both browser and Node.js.

- Browser uses the official SQLite Wasm build (with sqlite-vec) — no setup.
- Node uses better-sqlite3 (>=12) and auto-loads a prebuilt sqlite-vec extension
  when available.
- One import for both: `import { createDatabase } from '@dao-xyz/sqlite3-vec'`.

## Quick TypeScript Example (works in browser and Node)

```ts
// src/app.ts
import { createDatabase } from '@dao-xyz/sqlite3-vec';

// Pick options per environment (optional)
const isBrowser = typeof window !== 'undefined';
const options = isBrowser
  ? { directory: '/myapp' } // Browser (OPFS when available, otherwise in-memory)
  : {}; // Node (native via better-sqlite3)

const db = await createDatabase(options);
await db.open();

// Confirm sqlite-vec is available
const vStmt = await db.prepare('select vec_version() as v');
const vRow = vStmt.get?.({});
console.log('sqlite-vec', vRow?.v);

// Create a small vec0 table and query
await db.exec(
  'CREATE VIRTUAL TABLE IF NOT EXISTS v USING vec0(vector float[3])',
);
const toVec = () =>
  new Float32Array([Math.random(), Math.random(), Math.random()]);

const ins = await db.prepare('INSERT INTO v(rowid,vector) VALUES(?1,?2)');
for (let i = 1; i <= 3; i++) ins.run([i, toVec().buffer]);

const probe = toVec();
const q = await db.prepare(
  'SELECT rowid, vec_distance_l2(vector, ?1) AS d FROM v ORDER BY d LIMIT 2',
);
console.log('Top-2:', q.all([probe.buffer]));

await db.close();
```

Notes:

- In the browser, `directory` enables OPFS-backed storage when available (falls
  back to in-memory).
- In Node, no options are required. The package auto-loads a native sqlite-vec
  extension if present.

## Installation

```bash
npm install @dao-xyz/sqlite3-vec
# optional (for local E2E)
npx playwright install --with-deps chromium
```

## Scripts

- Build: `npm run build`
- Demos:
  - Browser: `npm start` → open `http://127.0.0.1:4321/demo/index.html`
  - Node (Wasm/in-memory): `npm run start:node`
  - Node (native): `npm run start:node:native`
- Tests:
  - Node: `npm run test:node`
  - Browser (Playwright): `npm run test:e2e`

### Project Structure

- `src/`: Source modules for unified and native Node entries.
- Root `unified.mjs`, `native.mjs`, `node.mjs`: thin wrappers re-exporting from
  `src/`.
- `index.mjs`: wasm ESM entry wiring upstream sqlite-wasm payload.
- `wasm.mjs`: local bridge used by demos/tests; mirrors published `/wasm`
  subpath.
- `sqlite-wasm/jswasm/`: upstream wasm payload files (.mjs/.wasm).

### TypeScript

- This package ships full `.d.ts` declarations for all entry points.
- Conditional exports map the right JS and `.d.ts` for your environment:
  - Root: browser → `dist/unified-browser.js`, node → `dist/unified-node.js`,
    types → `dist/unified.d.ts`.
  - Subpaths: `./unified`, `./native`, and `./wasm` each point to matching JS
    and `.d.ts`.
- You don’t need additional config; editors pick up types automatically.

### Common Pitfalls

- COOP/COEP headers: Browsers require `Cross-Origin-Opener-Policy: same-origin`
  and `Cross-Origin-Embedder-Policy: require-corp` to load Wasm with
  SharedArrayBuffer (used by OPFS SAH pool). Use the provided server
  (`npm run start:dev`) or configure your server accordingly.
- MIME types: Ensure `.mjs` serves as `application/javascript` and `.wasm` as
  `application/wasm`. The provided test server handles this.
- OPFS availability: Some browsers/environments (e.g., cross-origin iframes,
  insecure origins) block OPFS. The unified API falls back to in-memory when
  OPFS isn’t available.
- Workers: If the browser lacks module worker support, the demo loads a
  polyfill. In your app, check for module worker support if you rely on workers.
- Bundlers: With Vite, exclude this package from pre-bundling and set COOP/COEP
  headers (see section below). Other bundlers may need equivalent configuration.

## Quick Example (Browser, main thread)

Requires COOP/COEP headers when serving files.

```js
// main.js
import sqlite3InitModule from '@dao-xyz/sqlite3-vec/wasm';

const sqlite3 = await sqlite3InitModule({
  print: console.log,
  printErr: console.error,
});
const db = new sqlite3.oo1.DB('/vec.sqlite3', 'ct');

// Confirm sqlite-vec is present
const s = db.prepare('select vec_version() as v');
s.step();
console.log('sqlite-vec', s.get({}).v);
s.finalize();

// Create table and run a tiny vector query
db.exec('CREATE VIRTUAL TABLE v USING vec0(vector float[3])');
const toVec = () =>
  Uint8Array.from({ length: 3 }, () => Math.floor(Math.random() * 256));
const ins = db.prepare('INSERT INTO v(rowid,vector) VALUES(?1,?2)');
for (let i = 1; i <= 4; i++) ins.bind({ 1: i, 2: toVec().buffer }).stepReset();
ins.finalize();

const probe = toVec();
const q = db.prepare(
  'SELECT rowid, vec_distance_l2(vector, ?1) AS d FROM v ORDER BY d LIMIT 2',
);
q.bind({ 1: probe.buffer });
while (q.step()) console.log(q.get());
q.finalize();
db.close();
```

## Unified API (works in browser and Node)

Use a single factory that picks the right runtime:

```js
import { createDatabase } from '@dao-xyz/sqlite3-vec';

// Auto: browser -> wasm; Node -> better-sqlite3 if available, else wasm
const db = await createDatabase({ mode: 'auto', directory: '/my/app' });

await db.open();
await db.exec('CREATE VIRTUAL TABLE v USING vec0(vector float[3])');
const stmt = await db.prepare('INSERT INTO v(rowid,vector) VALUES(?1,?2)');
const toVec = () =>
  new Float32Array([Math.random(), Math.random(), Math.random()]);
for (let i = 1; i <= 3; i++) stmt.run([i, toVec().buffer]);

const probe = toVec();
const q = await db.prepare(
  'SELECT rowid, vec_distance_l2(vector, ?1) AS d FROM v ORDER BY d LIMIT 2',
);
console.log(q.all([probe.buffer]));
await db.close();
```

Options:

- `mode`: `'auto' | 'native' | 'wasm'` (default `'auto'`).
- `directory`: persistent location. In browser, uses OPFS when available;
  otherwise falls back to in-memory. In Node native, points to a file path; in
  Node wasm, ignored.
- `extensionPath` (Node native only): path to sqlite-vec loadable extension
  binary (optional).

## Contributing

See `DEVS.md` for detailed development, build, test, and release instructions.

### Run the demos

Serve from the repo root with the required COOP/COEP headers either using the
included tiny server or your own server:

```bash
# simple COOP/COEP server (recommended)
npm run start:dev
# then open http://127.0.0.1:4321/demo/index.html

# or use http-server (requires a build that your browser allows)
npm start
```

## Bug reports

> [!Warning]
>
> This project wraps the code of
> [SQLite Wasm](https://sqlite.org/wasm/doc/trunk/index.md) with _no_ changes,
> apart from added TypeScript types. Please do _not_ file issues or feature
> requests regarding the underlying SQLite Wasm code here. Instead, please
> follow the
> [SQLite bug filing instructions](https://www.sqlite.org/src/wiki?name=Bug+Reports).
> Filing TypeScript type related issues and feature requests is fine.

## Node.js support

> [!Warning]
>
> Node.js supports two modes:
>
> - Native via better-sqlite3 (recommended; supports persistence). Provide the
>   path to the sqlite-vec loadable extension when you have it.
> - Wasm (in-memory only; no persistence).

### Prebuilt binaries (recommended)

On install, the package attempts to download a prebuilt sqlite-vec loadable
extension for your platform and place it under `./dist/native/`. This mirrors
the approach used by better-sqlite3 and gives a "just works" experience on Node.

- Supported triples:
  - macOS: `darwin-x64`, `darwin-arm64`
  - Windows: `win32-x64`, `win32-arm64`
  - Linux glibc: `linux-x64-gnu`, `linux-arm64-gnu`
  - Linux musl (Alpine): `linux-x64-musl`, `linux-arm64-musl`,
    `linux-armv7-musl`

Controls:

- `SQLITE3_VEC_PREBUILT=0` — disable prebuilt download (e.g., offline CI).
- `SQLITE3_VEC_POSTINSTALL=1 SQLITE_VEC_DIR=../sqlite-vec` — fallback: build
  locally from sources during install.

At runtime, `initNative()` will auto-discover the downloaded binary if you don’t
pass `loadExtension` explicitly.

You can also resolve the detected path programmatically in Node:

```js
import { resolveNativeExtensionPath } from '@dao-xyz/sqlite3-vec';
console.log('Resolved sqlite-vec extension:', resolveNativeExtensionPath());
```

Debugging:

- Set `SQLITE3_VEC_DEBUG=1` to log which native extension path is used during
  `initNative()`.

Optional: automatic native build on install (opt-in)

```bash
# If you want the sqlite-vec native extension built automatically during npm install:
# 1) Ensure you have a local sqlite-vec checkout
# 2) Opt-in via env var and point to the repo
SQLITE3_VEC_POSTINSTALL=1 SQLITE_VEC_DIR=../sqlite-vec npm install

# Postinstall will attempt to run scripts/build-sqlite-vec.sh and place the
# resulting binary under ./dist/native/.
```

### Node demos

```bash
# Wasm (in-memory)
npm run start:node

# Native (better-sqlite3); uses $SQLITE_VEC_EXT if provided, otherwise tries ./dist/native
npm run start:node:native
```

### Node (wasm, in-memory)

```js
// node-wasm.mjs (Node ESM)
import sqlite3InitModule from '@dao-xyz/sqlite3-vec/wasm';

const sqlite3 = await sqlite3InitModule({
  print: console.log,
  printErr: console.error,
});

// In-memory DB only
const db = new sqlite3.oo1.DB();

// Confirm sqlite-vec is present
const s = db.prepare('select vec_version() as v');
s.step();
console.log('sqlite-vec', s.get({}).v);
s.finalize();

// Minimal vec demo
db.exec('CREATE VIRTUAL TABLE v USING vec0(vector float[3])');
const toVec = () =>
  Uint8Array.from({ length: 3 }, () => Math.floor(Math.random() * 256));
const ins = db.prepare('INSERT INTO v(rowid,vector) VALUES(?1,?2)');
for (let i = 1; i <= 3; i++) ins.bind({ 1: i, 2: toVec().buffer }).stepReset();
ins.finalize();

const probe = toVec();
const q = db.prepare(
  'SELECT rowid, vec_distance_l2(vector, ?1) AS d FROM v ORDER BY d LIMIT 2',
);
q.bind({ 1: probe.buffer });
while (q.step()) console.log(q.get());
q.finalize();
db.close();
```

## Installation

```bash
npm install @dao-xyz/sqlite3-vec
```

## Projects using this package

Once published to npm as `@dao-xyz/sqlite3-vec`, you can browse
[npm dependents](https://www.npmjs.com/browse/depended/@dao-xyz/sqlite3-vec) to
discover projects using it.

## License

Apache 2.0.

## Acknowledgements

This project is based on [SQLite Wasm](https://sqlite.org/wasm), which it
conveniently wraps as an ES Module and builds on top of. The upstream package is
published to npm as
[`@sqlite.org/sqlite-wasm`](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm).

[better-sqlite3](https://www.npmjs.com/package/better-sqlite3) is used for
native Node.js support.
