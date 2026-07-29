#!/usr/bin/env bash
# Copyright (C) 2026 JistAI contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

set -euo pipefail

MODE=${1:---check}
case "$MODE" in
  --check | --write) ;;
  *)
    echo "usage: bash bin/license-audit/run.sh [--check|--write]" >&2
    exit 2
    ;;
esac

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd -- "$SCRIPT_DIR/../.." && pwd)

for command in git tar go bun node npm; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "license audit requires $command" >&2
    exit 1
  }
done

[[ "$(go env GOVERSION)" == "go1.26.5" ]] || {
  echo "license audit requires Go 1.26.5" >&2
  exit 1
}
[[ "$(bun --version)" == "1.3.11" ]] || {
  echo "license audit requires Bun 1.3.11" >&2
  exit 1
}
[[ "$(node --version)" == "v24.18.0" ]] || {
  echo "license audit requires Node.js 24.18.0" >&2
  exit 1
}
[[ "$(npm --version)" == "11.16.0" ]] || {
  echo "license audit requires npm 11.16.0" >&2
  exit 1
}

if ! git --no-optional-locks -C "$ROOT_DIR" diff --quiet --ignore-submodules -- ||
  ! git --no-optional-locks -C "$ROOT_DIR" diff --cached --quiet --ignore-submodules --; then
  echo "license audit requires a clean tracked worktree and index" >&2
  exit 1
fi

WORK_DIR=$(mktemp -d)
cleanup() {
  rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

SOURCE_DIR="$WORK_DIR/source"
OUTPUT_DIR="$WORK_DIR/output"
ARCHIVE="$WORK_DIR/source.tar"
mkdir -p "$SOURCE_DIR" "$OUTPUT_DIR" "$WORK_DIR/go-build"
: >"$WORK_DIR/empty-npmrc"

git --no-optional-locks \
  -c core.autocrlf=false \
  -c core.eol=lf \
  -C "$ROOT_DIR" \
  archive --format=tar --output="$ARCHIVE" HEAD
tar -xf "$ARCHIVE" -C "$SOURCE_DIR"

export GOCACHE="$WORK_DIR/go-build"
export GOFLAGS=-mod=readonly
export GOTELEMETRY=off
export BUN_INSTALL_REGISTRY=https://registry.npmjs.org
export NPM_CONFIG_USERCONFIG="$WORK_DIR/empty-npmrc"
export NPM_CONFIG_REGISTRY=https://registry.npmjs.org
unset ELECTRON_MIRROR ELECTRON_CUSTOM_DIR NODE_AUTH_TOKEN NPM_TOKEN

node "$SOURCE_DIR/bin/license-audit/scan-node.test.cjs"

(
  cd "$SOURCE_DIR/web"
  bun install --frozen-lockfile --ignore-scripts
)
(
  cd "$SOURCE_DIR/electron"
  npm ci --ignore-scripts --no-audit --no-fund
  node node_modules/electron/install.js
)

(
  cd "$SOURCE_DIR"
  go run ./bin/license-audit/scan-go.go -output "$OUTPUT_DIR/go-1.json"
)
node "$SOURCE_DIR/bin/license-audit/scan-node.cjs" \
  --manifest "$SOURCE_DIR/web/default/package.json" \
  --output "$OUTPUT_DIR/default-1.json" \
  --area web/default \
  --root-groups dependencies,optionalDependencies \
  --bun-lock "$SOURCE_DIR/web/bun.lock" \
  --json5-root "$SOURCE_DIR/web/node_modules"
node "$SOURCE_DIR/bin/license-audit/scan-node.cjs" \
  --manifest "$SOURCE_DIR/web/classic/package.json" \
  --output "$OUTPUT_DIR/classic-1.json" \
  --area web/classic \
  --root-groups dependencies,optionalDependencies \
  --bun-lock "$SOURCE_DIR/web/bun.lock" \
  --json5-root "$SOURCE_DIR/web/node_modules"
node "$SOURCE_DIR/bin/license-audit/scan-node.cjs" \
  --manifest "$SOURCE_DIR/electron/package.json" \
  --output "$OUTPUT_DIR/electron-1.json" \
  --area electron/build \
  --root-groups devDependencies \
  --package-lock "$SOURCE_DIR/electron/package-lock.json"
node "$SOURCE_DIR/bin/license-audit/scan-vendored-sources.cjs" \
  --root "$SOURCE_DIR" \
  --manifest "$SOURCE_DIR/VENDORED-SOURCES.json" \
  --output "$OUTPUT_DIR/vendored-1.json"
node "$SOURCE_DIR/bin/license-audit/build-overrides.cjs" \
  --go "$OUTPUT_DIR/go-1.json" \
  --default "$OUTPUT_DIR/default-1.json" \
  --classic "$OUTPUT_DIR/classic-1.json" \
  --electron "$OUTPUT_DIR/electron-1.json" \
  --base "$SOURCE_DIR/bin/license-audit/base-overrides.json" \
  --output "$OUTPUT_DIR/license-overrides.complete-1.json"
node "$SOURCE_DIR/bin/license-audit/generate-third-party.cjs" \
  --go "$OUTPUT_DIR/go-1.json" \
  --default "$OUTPUT_DIR/default-1.json" \
  --classic "$OUTPUT_DIR/classic-1.json" \
  --electron "$OUTPUT_DIR/electron-1.json" \
  --vendored "$OUTPUT_DIR/vendored-1.json" \
  --vendored-scanner "$SOURCE_DIR/bin/license-audit/scan-vendored-sources.cjs" \
  --overrides "$OUTPUT_DIR/license-overrides.complete-1.json" \
  --output "$OUTPUT_DIR/THIRD-PARTY-LICENSES.candidate.md" \
  --report "$OUTPUT_DIR/license-report.json" \
  --requirements "$OUTPUT_DIR/license-override-requirements.json"
node "$SOURCE_DIR/bin/license-audit/scan-vendored-sources.cjs" \
  --root "$SOURCE_DIR" \
  --manifest "$SOURCE_DIR/VENDORED-SOURCES.json" \
  --bundle "$OUTPUT_DIR/THIRD-PARTY-LICENSES.candidate.md"

if [[ "$MODE" == "--check" ]]; then
  cmp "$OUTPUT_DIR/THIRD-PARTY-LICENSES.candidate.md" "$SOURCE_DIR/THIRD-PARTY-LICENSES.md"
  node "$SOURCE_DIR/bin/license-audit/license-lock.cjs" check \
    --root "$SOURCE_DIR" \
    --lock "$SOURCE_DIR/third_party/license-audit-lock.json" \
    --report "$OUTPUT_DIR/license-report.json"
  echo "Third-party license bundle matches the exact Git HEAD."
else
  cp "$OUTPUT_DIR/THIRD-PARTY-LICENSES.candidate.md" "$ROOT_DIR/THIRD-PARTY-LICENSES.md"
  node "$SOURCE_DIR/bin/license-audit/license-lock.cjs" write \
    --root "$SOURCE_DIR" \
    --bundle "$OUTPUT_DIR/THIRD-PARTY-LICENSES.candidate.md" \
    --report "$OUTPUT_DIR/license-report.json" \
    --output "$ROOT_DIR/third_party/license-audit-lock.json"
  echo "Updated THIRD-PARTY-LICENSES.md and third_party/license-audit-lock.json from exact Git HEAD."
fi
