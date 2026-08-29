#!/usr/bin/env bash
#
# Build every image from source and run the full end-to-end suite, then tear the environment
# down. Exits with the test runner's status, so it drops straight into CI.
#
#   ./test/e2e/run.sh
#
set -euo pipefail

cd "$(dirname "$0")"

# --- pick a working Docker CLI ----------------------------------------------------------------
# Normally `docker compose` on PATH. On WSL with Docker Desktop, though, the daemon is only
# reachable from a distro that has WSL Integration switched on (Settings -> Resources -> WSL
# Integration); without it there is no /var/run/docker.sock and the Linux CLI has nothing to talk
# to, even though Docker Desktop is running happily. The Windows CLI can still drive it — it just
# needs Windows paths, which `wslpath -w` provides. Falling back keeps the suite runnable instead
# of failing with a daemon error that looks like Docker is down.
if docker info >/dev/null 2>&1; then
    compose() { docker compose -f docker-compose.yml "$@"; }
elif command -v wslpath >/dev/null 2>&1 \
    && command -v docker.exe >/dev/null 2>&1 \
    && docker.exe info >/dev/null 2>&1; then
    echo "note: no Docker socket in this WSL distro; driving Docker Desktop via docker.exe." >&2
    echo "      (enable Settings -> Resources -> WSL Integration for a native socket)" >&2
    COMPOSE_FILE_WIN="$(wslpath -w "$PWD/docker-compose.yml")"
    compose() { docker.exe compose -f "$COMPOSE_FILE_WIN" "$@"; }
else
    echo "error: cannot reach a Docker daemon. Is Docker running?" >&2
    exit 1
fi

# Playwright writes traces/screenshots/report into these; create them up front so the bind
# mounts don't get root-owned directories conjured by the daemon.
mkdir -p report test-results

teardown() { compose down -v --remove-orphans >/dev/null 2>&1 || true; }

# Start clean — a mongo volume left behind by an aborted run would carry its users and notes
# into this one — and always clean up, including on Ctrl-C.
teardown
trap teardown EXIT

status=0
compose up --build --force-recreate --remove-orphans --exit-code-from e2e || status=$?

if [ "$status" -eq 0 ]; then
    echo "e2e: passed"
else
    echo "e2e: failed (exit $status) — HTML report: test/e2e/report/index.html"
fi

exit "$status"
