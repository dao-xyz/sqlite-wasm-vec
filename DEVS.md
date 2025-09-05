## Build 

This repo supports two build modes:

- If you have `../sqlite` prepared with `sqlite-vec` (as described above), the
  build will compile and copy the wasm payload from that repo.
- If not, the build will reuse the prebuilt payload already present in
  `sqlite-wasm/jswasm`.

```bash
npm run build
```

If building from `../sqlite` fails (e.g., in sandboxed environments), the
script falls back to the prebuilt payload when available.


## Run Playwright tests

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



## CI Workflows

- E2E: `.github/workflows/e2e.yml` (build + Playwright + Node tests)
- Prebuilt: `.github/workflows/prebuilt.yml` (build native sqlite-vec for matrix and upload release assets)

### Releasing with Prebuilt Assets

Two easy ways:

1) GitHub UI
- Update `package.json` version (e.g., `3.51.0-build1`) and push to `main`.
- Create a GitHub Release with tag `v3.51.0-build1`.
- The `prebuilt` workflow runs on release and uploads platform binaries.

2) One-click from Actions (recommended)
- Go to Actions → "create-release" → Run workflow.
- Optionally enter a version (defaults to `package.json`).
- The workflow creates a tag and a GitHub Release; the `prebuilt` workflow then builds and uploads assets.

Tip: After assets are uploaded, publish to npm (locally) or add an auto-publish workflow using your `NPM_TOKEN` if you want to automate that as well.

### Release Checklist

1) Bump version in `package.json` (use SQLite version + build suffix, e.g. `3.51.0-build1`).
2) Commit and push to `main`.
3) Ensure CI (E2E + Node tests) is green (see Actions → e2e).
4) Create a release with tag `v<version>`:
   - Either via Actions → "create-release" → Run workflow (recommended), or
   - Manually create a GitHub Release with the tag.
5) Wait for the "prebuilt" workflow to finish and upload all platform binaries.
6) Publish to npm:
   - Locally: `npm publish --access public`
   - Or set up an auto-publish workflow with `NPM_TOKEN` after the prebuilt job completes.

Troubleshooting:
- If prebuilt artifacts are missing for a platform, re-run the matrix job for that OS/arch.
- If Playwright E2E flakes, re-run that job; it pulls a fresh Chromium in CI.

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
