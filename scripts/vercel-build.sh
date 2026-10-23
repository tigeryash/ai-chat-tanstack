#!/bin/sh
# Vercel's build command (vercel.json). Production builds push the Convex backend to the production
# deployment and build the app against it, so production Convex always matches `main`. Every other
# build (preview, development, local) runs the plain Vite build and never touches Convex.
#
# `convex deploy` reads CONVEX_DEPLOY_KEY (set in Vercel, Production scope only) and passes the
# deployment URL to the Vite build as VITE_CONVEX_URL. VITE_CONVEX_SITE_URL still comes from Vercel's
# env, and the server reads both from Vercel's env at runtime, so keep them pointing at the same
# deployment as the key.
#
#   sh scripts/vercel-build.sh             # build
#   sh scripts/vercel-build.sh --dry-run   # print the command it would run, run nothing
set -eu

VITE_BUILD="node --max-old-space-size=8192 ./node_modules/vite/bin/vite.js build"

dry_run=false
if [ "${1:-}" = "--dry-run" ]; then
	dry_run=true
fi

# Prints the command with args that contain spaces quoted, then runs it unless this is a dry run.
run() {
	for arg in "$@"; do
		case "$arg" in
		*" "*) printf "'%s' " "$arg" ;;
		*) printf "%s " "$arg" ;;
		esac
	done
	printf "\n"
	if [ "$dry_run" = false ]; then
		exec "$@"
	fi
}

fail() {
	echo "vercel-build: $1" >&2
	exit 1
}

if [ "${VERCEL_ENV:-}" = "production" ]; then
	# Never print the key itself. A dev or preview key would point the production site at the wrong
	# deployment, so stop before `convex deploy` runs (the CLI tells key kinds apart by this prefix).
	case "${CONVEX_DEPLOY_KEY:-}" in
	"") fail "VERCEL_ENV is production but CONVEX_DEPLOY_KEY is not set. Add the production deploy key in Vercel (Production scope only)." ;;
	dev:* | preview:*) fail "CONVEX_DEPLOY_KEY is a dev or preview key. Use the production deployment's deploy key." ;;
	esac
	echo "vercel-build: VERCEL_ENV=production, deploying Convex and building the app against it"
	run npx convex deploy --cmd "$VITE_BUILD" --cmd-url-env-var-name VITE_CONVEX_URL
else
	echo "vercel-build: VERCEL_ENV=${VERCEL_ENV:-unset}, building the app only (Convex is not deployed)"
	# Word splitting is intended: VITE_BUILD is a plain command line with no quoted args.
	# shellcheck disable=SC2086
	run $VITE_BUILD
fi
