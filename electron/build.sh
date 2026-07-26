#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)
VERSION=$(tr -d '\r\n' < "$ROOT_DIR/VERSION")
ELECTRON_VERSION=${VERSION#v}

cd "$ROOT_DIR"
bash bin/validate-release-metadata.sh "$VERSION"

echo "Building New API Electron App..."

echo "Step 1: Building frontend..."
cd web
bun install --frozen-lockfile
cd default
DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION="$VERSION" bun run build
cd ../classic
VITE_REACT_APP_VERSION="$VERSION" bun run build

echo "Step 2: Building Go backend..."
cd "$ROOT_DIR"

GO_LDFLAGS="-s -w -X github.com/QuantumNous/new-api/common.Version=$VERSION"

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Building for macOS..."
    CGO_ENABLED=1 go build -trimpath -ldflags="$GO_LDFLAGS" -o new-api
    cd electron
    npm ci
    npm run build:mac -- --config.extraMetadata.version="$ELECTRON_VERSION"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Building for Linux..."
    CGO_ENABLED=1 go build -trimpath -ldflags="$GO_LDFLAGS" -o new-api
    cd electron
    npm ci
    npm run build:linux -- --config.extraMetadata.version="$ELECTRON_VERSION"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    echo "Building for Windows..."
    CGO_ENABLED=1 go build -trimpath -ldflags="$GO_LDFLAGS" -o new-api.exe
    cd electron
    npm ci
    npm run build:win -- --config.extraMetadata.version="$ELECTRON_VERSION"
else
    echo "Unknown OS, building for current platform..."
    CGO_ENABLED=1 go build -trimpath -ldflags="$GO_LDFLAGS" -o new-api
    cd electron
    npm ci
    npm run build -- --config.extraMetadata.version="$ELECTRON_VERSION"
fi

echo "Build complete! Check electron/dist/ for output."
