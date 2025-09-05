#!/usr/bin/env bash
set -euo pipefail

# Build sqlite-vec loadable extension and copy into dist/native
# Usage: SQLITE_VEC_DIR=../sqlite-vec ./scripts/build-sqlite-vec.sh

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT_DIR/dist/native"
SQLITE_VEC_DIR="${SQLITE_VEC_DIR:-}"

if [[ -z "$SQLITE_VEC_DIR" ]]; then
  echo "[build-sqlite-vec] Please set SQLITE_VEC_DIR to the sqlite-vec repo path" >&2
  exit 1
fi

if [[ ! -d "$SQLITE_VEC_DIR" ]]; then
  echo "[build-sqlite-vec] Not a directory: $SQLITE_VEC_DIR" >&2
  exit 1
fi

echo "[build-sqlite-vec] Using sqlite-vec repo: $SQLITE_VEC_DIR"

pushd "$SQLITE_VEC_DIR" >/dev/null
  if [[ -x ./scripts/vendor.sh ]]; then
    ./scripts/vendor.sh
  fi
  make loadable
popd >/dev/null

mkdir -p "$OUT_DIR"

# Try common artifact names
ARTIFACT=""
for f in sqlite-vec.*.so sqlite-vec.*.dylib sqlite-vec.*.dll sqlite-vec.so sqlite-vec.dylib sqlite-vec.dll; do
  if [[ -f "$SQLITE_VEC_DIR/$f" ]]; then
    ARTIFACT="$SQLITE_VEC_DIR/$f"
    break
  fi
done

if [[ -z "$ARTIFACT" ]]; then
  echo "[build-sqlite-vec] Could not locate built extension under $SQLITE_VEC_DIR" >&2
  exit 1
fi

cp "$ARTIFACT" "$OUT_DIR/"
echo "[build-sqlite-vec] Copied $(basename "$ARTIFACT") to $OUT_DIR"

