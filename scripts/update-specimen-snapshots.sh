#!/usr/bin/env bash
# Regenerates the specimen baselines in e2e/visual/__screenshots__ inside the
# Playwright image CI uses, so they match what CI renders (#64). Run from the
# repository root after an intended visual change, then review the PNG diff
# before committing it:
#
#   bash scripts/update-specimen-snapshots.sh
#
# The working tree is copied into the container without node_modules: a
# Windows or macOS install has the wrong native binaries for Linux.
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v$(node -p "require('./package.json').devDependencies['@playwright/test']")-noble"
SOURCE="$(pwd -W 2>/dev/null || pwd)"

MSYS_NO_PATHCONV=1 docker run --rm -v "$SOURCE:/src" -w /work "$IMAGE" bash -c '
  set -euo pipefail
  tar -C /src --exclude=./node_modules --exclude="./dist*" --exclude=./test-results -cf - . | tar -xf -
  npm install --global --silent "pnpm@$(node -p "require(\"./package.json\").packageManager.split(\"@\")[1]")"
  pnpm install --frozen-lockfile --silent
  pnpm exec playwright test --config playwright.visual.config.ts --update-snapshots=all
  rm -rf /src/e2e/visual/__screenshots__
  cp -r e2e/visual/__screenshots__ /src/e2e/visual/__screenshots__
'
echo "Baselines written to e2e/visual/__screenshots__; review the diff before committing."
