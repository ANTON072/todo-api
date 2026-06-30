#!/usr/bin/env bash
set -euo pipefail

OUT=dist-lambda

rm -rf "$OUT"

npx esbuild src/lambda.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --outfile="$OUT/lambda.js" \
  --external:@aws-sdk/client-secrets-manager

echo "✓ Lambda bundle: $OUT/lambda.js"
