#!/bin/sh
# Runs Playwright inside the Linux image CI uses (.github/workflows/ci.yml), so Linux screenshot
# baselines made here match CI exactly. Needs Docker. Extra args go to `playwright test`:
#   bun run test:e2e:linux                       # check against the Linux baselines
#   bun run test:e2e:linux --update-snapshots    # rewrite them after an intentional UI change
set -eu

PLAYWRIGHT_VERSION=$(node -p "require('@playwright/test/package.json').version")
BUN_VERSION=$(bun --version)

# linux/amd64 because CI runners are x86; on Apple silicon Docker emulates it. node_modules gets its
# own volume so the container's Linux binaries never mix with the host's.
exec docker run --rm --platform linux/amd64 --ipc=host \
	-v "$PWD":/work -v /work/node_modules -w /work \
	-e HUSKY=0 \
	"mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble" \
	sh -c "npm install --global --silent bun@${BUN_VERSION} && bun install --frozen-lockfile && bunx playwright test $*"
