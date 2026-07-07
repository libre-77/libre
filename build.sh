#!/usr/bin/env bash
# Build libre into a single self-contained web/dist/index.html.
# Usage: ./build.sh [--terser]   (from anywhere; resolves its own directory)
#   --terser   run terser as an extra minification pass over the bundled JS
#              (smaller output; requires the terser devDependency)
set -euo pipefail

# Parse args.
USE_TERSER=0
for arg in "$@"; do
  case "$arg" in
    --terser) USE_TERSER=1 ;;
    -h|--help)
      echo "Usage: ./build.sh [--terser]"
      echo "  --terser   extra terser minification pass over the bundled JS"
      exit 0
      ;;
    *) echo "error: unknown argument: $arg" >&2; exit 1 ;;
  esac
done

# Resolve the repo root (directory of this script) so it runs from anywhere.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB="$ROOT/web"

command -v node >/dev/null 2>&1 || { echo "error: node is required" >&2; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "error: npm is required" >&2; exit 1; }

cd "$WEB"

# Install build tooling only when missing (esbuild + nostr-tools; dev-only).
if [ ! -d node_modules ]; then
  echo "==> installing build dependencies"
  npm install
fi

echo "==> bundling nostr-tools -> vendor/nostr-tools.js"
npm run build:vendor

echo "==> building single-file dist/index.html"
TERSER="$USE_TERSER" npm run build

echo ""
echo "Done. Ship this one file:"
echo "  $WEB/dist/index.html"
echo ""
echo "Serve it locally (must be http, not file://):"
echo "  python3 -m http.server 8099 --directory \"$WEB/dist\" --bind 127.0.0.1"
echo "Then open:  http://127.0.0.1:8099"
