# @dao-xyz/sqlite3-vec

Unified SQLite + sqlite-vec (vec0) for both browser and Node.js.

- Browser uses the official SQLite Wasm build (with sqlite-vec) — no setup.
- Node uses better-sqlite3 (>=12) and auto-loads a prebuilt sqlite-vec extension when available.
- One import for both: `import { createDatabase } from '@dao-xyz/sqlite3-vec'`.

## Quick TypeScript Example (works in browser and Node)

```ts
// src/app.ts
import { createDatabase } from '@dao-xyz/sqlite3-vec';

// Pick options per environment (optional)
const isBrowser = typeof window !== 'undefined';
const options = isBrowser
  ? { directory: '/myapp' } // Browser (OPFS when available, otherwise in-memory)
  : {};                     // Node (native via better-sqlite3)

const db = await createDatabase(options);
await db.open();

// Confirm sqlite-vec is available
const vStmt = await db.prepare('select vec_version() as v');
const vRow = vStmt.get?.({});
console.log('sqlite-vec', vRow?.v);

// Create a small vec0 table and query
await db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS v USING vec0(vector float[3])');
const toVec = () => new Float32Array([Math.random(), Math.random(), Math.random()]);

const ins = await db.prepare('INSERT INTO v(rowid,vector) VALUES(?1,?2)');
for (let i = 1; i <= 3; i++) ins.run([i, toVec().buffer]);

const probe = toVec();
const q = await db.prepare('SELECT rowid, vec_distance_l2(vector, ?1) AS d FROM v ORDER BY d LIMIT 2');
console.log('Top-2:', q.all([probe.buffer]));

await db.close();
```

Notes:
- In the browser, `directory` enables OPFS-backed storage when available (falls back to in-memory).
- In Node, no options are required. The package auto-loads a native sqlite-vec extension if present.

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
- Root `unified.mjs`, `native.mjs`, `node.mjs`: thin wrappers re-exporting from `src/`.
- `index.mjs`: wasm ESM entry wiring upstream sqlite-wasm payload.
- `wasm.mjs`: local bridge used by demos/tests; mirrors published `/wasm` subpath.
- `sqlite-wasm/jswasm/`: upstream wasm payload files (.mjs/.wasm).

### TypeScript

- This package ships full `.d.ts` declarations for all entry points.
- Conditional exports map the right JS and `.d.ts` for your environment:
  - Root: browser → `dist/unified-browser.js`, node → `dist/unified-node.js`, types → `dist/unified.d.ts`.
  - Subpaths: `./unified`, `./native`, and `./wasm` each point to matching JS and `.d.ts`.
- You don’t need additional config; editors pick up types automatically.

### Common Pitfalls

- COOP/COEP headers: Browsers require `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to load Wasm with SharedArrayBuffer (used by OPFS SAH pool). Use the provided server (`npm run start:dev`) or configure your server accordingly.
- MIME types: Ensure `.mjs` serves as `application/javascript` and `.wasm` as `application/wasm`. The provided test server handles this.
- OPFS availability: Some browsers/environments (e.g., cross-origin iframes, insecure origins) block OPFS. The unified API falls back to in-memory when OPFS isn’t available.
- Workers: If the browser lacks module worker support, the demo loads a polyfill. In your app, check for module worker support if you rely on workers.
- Bundlers: With Vite, exclude this package from pre-bundling and set COOP/COEP headers (see section below). Other bundlers may need equivalent configuration.

## Quick Example (Browser, main thread)

Requires COOP/COEP headers when serving files.

```js
// main.js
import sqlite3InitModule from '@dao-xyz/sqlite3-vec/wasm';

const sqlite3 = await sqlite3InitModule({ print: console.log, printErr: console.error });
const db = new sqlite3.oo1.DB('/vec.sqlite3', 'ct');

// Confirm sqlite-vec is present
const s = db.prepare('select vec_version() as v');
s.step();
console.log('sqlite-vec', s.get({}).v);
s.finalize();

// Create table and run a tiny vector query
db.exec('CREATE VIRTUAL TABLE v USING vec0(vector float[3])');
const toVec = () => Uint8Array.from({length:3}, () => Math.floor(Math.random()*256));
const ins = db.prepare('INSERT INTO v(rowid,vector) VALUES(?1,?2)');
for (let i=1;i<=4;i++) ins.bind({1:i,2:toVec().buffer}).stepReset();
ins.finalize();

const probe = toVec();
const q = db.prepare('SELECT rowid, vec_distance_l2(vector, ?1) AS d FROM v ORDER BY d LIMIT 2');
q.bind({1: probe.buffer});
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
const toVec = () => new Float32Array([Math.random(), Math.random(), Math.random()]);
for (let i=1;i<=3;i++) stmt.run([i, toVec().buffer]);

const probe = toVec();
const q = await db.prepare('SELECT rowid, vec_distance_l2(vector, ?1) AS d FROM v ORDER BY d LIMIT 2');
console.log(q.all([probe.buffer]));
await db.close();
```

Options:
- `mode`: `'auto' | 'native' | 'wasm'` (default `'auto'`).
- `directory`: persistent location. In browser, uses OPFS when available; otherwise falls back to in-memory. In Node native, points to a file path; in Node wasm, ignored.
- `extensionPath` (Node native only): path to sqlite-vec loadable extension binary (optional).

## Prebuilt Binaries (Native Node)

On install, a prebuilt sqlite-vec loadable extension is downloaded for your
platform and placed under `./dist/native/` (with SHA256 verification when
available). This mirrors better-sqlite3’s approach so native just works.

- Triples: darwin-x64/arm64, win32-x64/arm64, linux-x64/arm64-gnu, linux-x64/arm64/armv7-musl
- Disable download: `SQLITE3_VEC_PREBUILT=0`
- Fallback build from source during install:
  `SQLITE3_VEC_POSTINSTALL=1 SQLITE_VEC_DIR=../sqlite-vec`

Runtime auto-discovery:

```js
import { resolveNativeExtensionPath } from '@dao-xyz/sqlite3-vec';
console.log('Resolved sqlite-vec ext:', resolveNativeExtensionPath());
```

Debug native load:

```bash
SQLITE3_VEC_DEBUG=1 node your-script.mjs
```

Wrapped worker variant (OPFS support; also needs COOP/COEP):

```js
import { sqlite3Worker1Promiser } from '@dao-xyz/sqlite3-vec/wasm';

const promiser = await new Promise((resolve) => {
  const p = sqlite3Worker1Promiser({ onready: () => resolve(p) });
});

const { version } = (await promiser('config-get', {})).result;
console.log('SQLite', version.libVersion, '| sqlite-vec', version.vecVersion);
```

## Info for building 

### install dependencies
```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh      # puts emcc etc. on your PATH (this line might be wrong)

brew install wabt
```

### Repos
git clone https://github.com/dao-xyz/sqlite-wasm-vec

git clone https://github.com/sqlite/sqlite 

git clone https://github.com/asg017/sqlite-vec 

In the directory where git clones ended up, run the following commands:

### Build sqlite-vec

cd sqlite-vec

./scripts/vendor.sh       
make loadable             # or: make amalgamation

### Build sqlite3

```bash
cp ./sqlite-vec/sqlite-vec.{c,h}  ./sqlite/ext/wasm/

### Create `sqlite3_wasm_extra_init.c`

```c
/* sqlite/ext/wasm/sqlite3_wasm_extra_init.c */
#define SQLITE_VEC_STATIC     1
#define SQLITE_VEC_OMIT_FS    1

/* pull the extension’s implementation into this TU */
#include "sqlite-vec.c"

/* normal headers come after: the extension has already
   pulled in its own "sqlite-vec.h" */
#include "sqlite3.h"

/* auto-register vec0 & friends at start-up */
int sqlite3_wasm_extra_init(const char *unused){
  return sqlite3_auto_extension((void(*)(void))sqlite3_vec_init);
}
```

### Build this project

This repo now supports two build modes:

- If you have `../sqlite` prepared with `sqlite-vec` (as described above), the
  build will compile and copy the wasm payload from that repo.
- If not, the build will reuse the prebuilt payload already present in
  `sqlite-wasm/jswasm`.

```bash
npm run build
```

If building from `../sqlite` fails (e.g., in sandboxed environments), the
script falls back to the prebuilt payload when available.

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

### Run Playwright tests

The Playwright test verifies that the module imports in a browser and that
`sqlite-vec` is usable (calls `vec_version()`, creates a `vec0` table, and runs
vector queries):

```bash
npm i -D @playwright/test
npx playwright install --with-deps chromium
npm run test:e2e
```

Note: In restricted environments where binding to a local port is not allowed,
you may need to run the tests locally or in CI with network permissions.


SQLite Wasm conveniently wrapped as an ES Module.


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
> - Native via better-sqlite3 (recommended; supports persistence). Provide the path to the sqlite-vec loadable extension when you have it.
> - Wasm (in-memory only; no persistence).

### Node (native via better-sqlite3 + sqlite-vec)

```js
// node-native.mjs
import initNative from '@dao-xyz/sqlite3-vec/native';

// Path to your sqlite-vec loadable extension (platform-specific .so/.dylib/.dll)
const vecPath = process.env.SQLITE_VEC_EXT; // or hardcode a path

const { db, version } = await initNative({
  database: 'my.db',
  loadExtension: vecPath,
});

console.log('SQLite', version.libVersion, '| sqlite-vec', version.vecVersion);
console.log(db.prepare('select 1 as x').get());
db.close();
```

To build sqlite-vec as a loadable extension, follow the sqlite-vec docs and use
its "make loadable" target, then provide the resulting binary path to
`loadExtension`.

Helper script:

```bash
# Build sqlite-vec loadable extension and copy it into ./dist/native
SQLITE_VEC_DIR=../sqlite-vec npm run build:native-ext

# Then point initNative to the copied binary
node -e "(async () => {
  const initNative = (await import('@dao-xyz/sqlite3-vec/native')).default;
  const { db, version } = await initNative({ database: 'my.db', loadExtension: './dist/native/sqlite-vec.dylib' });
  console.log(version);
  db.close();
})()"
```

### Prebuilt binaries (recommended)

On install, the package attempts to download a prebuilt sqlite-vec loadable
extension for your platform and place it under `./dist/native/`. This mirrors
the approach used by better-sqlite3 and gives a "just works" experience on
Node.

- Supported triples:
  - macOS: `darwin-x64`, `darwin-arm64`
  - Windows: `win32-x64`, `win32-arm64`
  - Linux glibc: `linux-x64-gnu`, `linux-arm64-gnu`
  - Linux musl (Alpine): `linux-x64-musl`, `linux-arm64-musl`, `linux-armv7-musl`

Controls:
- `SQLITE3_VEC_PREBUILT=0` — disable prebuilt download (e.g., offline CI).
- `SQLITE3_VEC_POSTINSTALL=1 SQLITE_VEC_DIR=../sqlite-vec` — fallback: build
  locally from sources during install.

At runtime, `initNative()` will auto-discover the downloaded binary if you
don’t pass `loadExtension` explicitly.

You can also resolve the detected path programmatically in Node:

```js
import { resolveNativeExtensionPath } from '@dao-xyz/sqlite3-vec';
console.log('Resolved sqlite-vec extension:', resolveNativeExtensionPath());
```

Debugging:
- Set `SQLITE3_VEC_DEBUG=1` to log which native extension path is used during `initNative()`.

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

const sqlite3 = await sqlite3InitModule({ print: console.log, printErr: console.error });

// In-memory DB only
const db = new sqlite3.oo1.DB();

// Confirm sqlite-vec is present
const s = db.prepare('select vec_version() as v');
s.step();
console.log('sqlite-vec', s.get({}).v);
s.finalize();

// Minimal vec demo
db.exec('CREATE VIRTUAL TABLE v USING vec0(vector float[3])');
const toVec = () => Uint8Array.from({ length: 3 }, () => Math.floor(Math.random()*256));
const ins = db.prepare('INSERT INTO v(rowid,vector) VALUES(?1,?2)');
for (let i=1; i<=3; i++) ins.bind({1:i,2:toVec().buffer}).stepReset();
ins.finalize();

const probe = toVec();
const q = db.prepare('SELECT rowid, vec_distance_l2(vector, ?1) AS d FROM v ORDER BY d LIMIT 2');
q.bind({1: probe.buffer});
while (q.step()) console.log(q.get());
q.finalize();
db.close();
```

## Installation

```bash
npm install @dao-xyz/sqlite3-vec
```

## Usage

There are three ways to use SQLite Wasm:

- [in the main thread with a wrapped worker](#in-a-wrapped-worker-with-opfs-if-available)
  (🏆 preferred option)
- [in a worker](#in-a-worker-with-opfs-if-available)
- [in the main thread](#in-the-main-thread-without-opfs)

Only the worker versions allow you to use the origin private file system (OPFS)
storage back-end.

### In a wrapped worker (with OPFS if available):

> [!Warning]
>
> For this to work, you need to set the following headers on your server:
>
> `Cross-Origin-Opener-Policy: same-origin`
>
> `Cross-Origin-Embedder-Policy: require-corp`

```js
import { sqlite3Worker1Promiser } from '@dao-xyz/sqlite3-vec/wasm';

const log = console.log;
const error = console.error;

const initializeSQLite = async () => {
  try {
    log('Loading and initializing SQLite3 module...');

    const promiser = await new Promise((resolve) => {
      const _promiser = sqlite3Worker1Promiser({
        onready: () => resolve(_promiser),
      });
    });

    log('Done initializing. Running demo...');

    const configResponse = await promiser('config-get', {});
    log('Running SQLite3 version', configResponse.result.version.libVersion);

    const openResponse = await promiser('open', {
      filename: 'file:mydb.sqlite3?vfs=opfs',
    });
    const { dbId } = openResponse;
    log(
      'OPFS is available, created persisted database at',
      openResponse.result.filename.replace(/^file:(.*?)\?vfs=opfs$/, '$1'),
    );
    // Your SQLite code here.
  } catch (err) {
    if (!(err instanceof Error)) {
      err = new Error(err.result.message);
    }
    error(err.name, err.message);
  }
};

initializeSQLite();
```

The `promiser` object above implements the
[Worker1 API](https://sqlite.org/wasm/doc/trunk/api-worker1.md#worker1-methods).

### In a worker (with OPFS if available):

> [!Warning]
>
> For this to work, you need to set the following headers on your server:
>
> `Cross-Origin-Opener-Policy: same-origin`
>
> `Cross-Origin-Embedder-Policy: require-corp`

```js
// In `main.js`.
const worker = new Worker('worker.js', { type: 'module' });
```

```js
// In `worker.js`.
import sqlite3InitModule from '@dao-xyz/sqlite3-vec/wasm';

const log = console.log;
const error = console.error;

const start = (sqlite3) => {
  log('Running SQLite3 version', sqlite3.version.libVersion);
  const db =
    'opfs' in sqlite3
      ? new sqlite3.oo1.OpfsDb('/mydb.sqlite3')
      : new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');
  log(
    'opfs' in sqlite3
      ? `OPFS is available, created persisted database at ${db.filename}`
      : `OPFS is not available, created transient database ${db.filename}`,
  );
  // Your SQLite code here.
};

const initializeSQLite = async () => {
  try {
    log('Loading and initializing SQLite3 module...');
    const sqlite3 = await sqlite3InitModule({ print: log, printErr: error });
    log('Done initializing. Running demo...');
    start(sqlite3);
  } catch (err) {
    error('Initialization error:', err.name, err.message);
  }
};

initializeSQLite();
```

The `db` object above implements the
[Object Oriented API #1](https://sqlite.org/wasm/doc/trunk/api-oo1.md).

### In the main thread (without OPFS):

```js
import sqlite3InitModule from '@dao-xyz/sqlite3-vec/wasm';

const log = console.log;
const error = console.error;

const start = (sqlite3) => {
  log('Running SQLite3 version', sqlite3.version.libVersion);
  const db = new sqlite3.oo1.DB('/mydb.sqlite3', 'ct');
  // Your SQLite code here.
};

const initializeSQLite = async () => {
  try {
    log('Loading and initializing SQLite3 module...');
    const sqlite3 = await sqlite3InitModule({
      print: log,
      printErr: error,
    });
    log('Done initializing. Running demo...');
    start(sqlite3);
  } catch (err) {
    error('Initialization error:', err.name, err.message);
  }
};

initializeSQLite();
```

The `db` object above implements the
[Object Oriented API #1](https://sqlite.org/wasm/doc/trunk/api-oo1.md).

## Usage with vite

If you are using [vite](https://vitejs.dev/), you need to add the following
config option in `vite.config.js`:

```js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@dao-xyz/sqlite3-vec'],
  },
});
```

Check out a
[sample project](https://stackblitz.com/edit/vitejs-vite-ttrbwh?file=main.js)
that shows this in action.

## Demo

See the [demo](https://github.com/sqlite/sqlite-wasm/tree/main/demo) folder for
examples of how to use this in the main thread and in a worker. (Note that the
worker variant requires special HTTP headers, so it can't be hosted on GitHub
Pages.) An example that shows how to use this with vite is available on
[StackBlitz](https://stackblitz.com/edit/vitejs-vite-ttrbwh?file=main.js).

## Projects using this package

Once published to npm as `@dao-xyz/sqlite3-vec`, you can browse
[npm dependents](https://www.npmjs.com/browse/depended/@dao-xyz/sqlite3-vec)
to discover projects using it.

## Deploying a new version

(These steps can only be executed by maintainers.)

1. Update the version number in `package.json` reflecting the current
   [SQLite version number](https://sqlite.org/download.html) and add a build
   identifier suffix like `-build1`. The complete version number should read
   something like `3.41.2-build1`.
1. Run `npm run build` to build the ES Module. This downloads the latest SQLite
   Wasm binary and builds the ES Module.
1. Run `npm run deploy` to commit the changes, push to GitHub, and publish the
   new version to npm.

## License

Apache 2.0.

## Acknowledgements

This project is based on [SQLite Wasm](https://sqlite.org/wasm), which it
conveniently wraps as an ES Module and builds on top of. The upstream
package is published to npm as
[`@sqlite.org/sqlite-wasm`](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm).
