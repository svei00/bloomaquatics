#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Bloom Aquatics · deploy-if-green
#
#  Runs on the DietPi every couple of minutes via systemd timer.
#  Does nothing until origin/main has moved AND that commit's
#  "build" GitHub Actions check finished green. Then, and only
#  then: git pull, npm ci, npm run build, pm2 restart.
#
#  Deliberately does NOT touch: bloom.db, uploads/, backups/,
#  node_modules/ wholesale, or anything with git clean / reset
#  --hard. A `git pull` on a clean checkout is the only mutation.
# ─────────────────────────────────────────────────────────────
# ── Pin the Node version instead of trusting whatever's on PATH ──
# The system-wide `node` on this Pi gets bumped for other apps living on
# the same host (see happyface, which needs >=22.5.0) and better-sqlite3's
# native build breaks on Node versions newer than what build-check.yml
# tests against. Use the same major version as CI via nvm, so a system
# Node upgrade for another project can't silently break this deploy again.
# nvm's own script isn't written for `set -euo pipefail`, so this has to
# run before strict mode is turned on below.
export NVM_DIR="/root/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_FILE="/tmp/bloomaquatics-deploy.lock"
LOG_FILE="$REPO_DIR/deploy.log"
PM2_APP="bloomaquatics"
BRANCH="main"
CHECK_NAME="build"          # must match the job id in .github/workflows/build-check.yml

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ── Prevent overlapping runs if a deploy is still mid-build ──
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0   # another run is in progress; try again next tick, silently
fi

cd "$REPO_DIR"

# ── Figure out the repo slug from the git remote (no hardcoding) ──
REMOTE_URL="$(git config --get remote.origin.url)"
SLUG="$(echo "$REMOTE_URL" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"

git fetch origin "$BRANCH" --quiet

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  exit 0   # already up to date, nothing to do
fi

log "New commit on origin/$BRANCH: $REMOTE_SHA (current: $LOCAL_SHA)"

# ── Ask GitHub whether that commit's build actually passed ──
# Checks API, unauthenticated read — fine on a public repo (60 req/hr cap,
# a 2-minute poll uses ~30/hr). We match on the job id from build-check.yml
# and require both status=completed and conclusion=success.
API_URL="https://api.github.com/repos/${SLUG}/commits/${REMOTE_SHA}/check-runs"

RESPONSE="$(curl -sf --max-time 15 \
  -H "Accept: application/vnd.github+json" \
  "$API_URL" || true)"

if [ -z "$RESPONSE" ]; then
  log "Could not reach GitHub Checks API — will retry next tick."
  exit 0
fi

CONCLUSION="$(echo "$RESPONSE" | node -e '
  let data = "";
  process.stdin.on("data", (chunk) => { data += chunk; });
  process.stdin.on("end", () => {
    const run = JSON.parse(data).check_runs.find((r) => r.name === process.argv[1]);
    process.stdout.write(run ? run.conclusion || "" : "");
  });
' "$CHECK_NAME")"

if [ "$CONCLUSION" != "success" ]; then
  log "Commit $REMOTE_SHA build check is '${CONCLUSION:-not finished yet}' — waiting."
  exit 0
fi

log "Build check green for $REMOTE_SHA. Deploying..."

# ── The actual deploy: same three steps as the manual README flow ──
git pull --ff-only origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
npm ci 2>&1 | tee -a "$LOG_FILE"
npm run build 2>&1 | tee -a "$LOG_FILE"
# --update-env: pm2 caches the env (incl. PATH) from whenever the process
# last started with a fresh one, and a plain restart reuses that stale
# cache. Without this, pm2 can keep launching the app against a different
# node than the one that just built its native modules — better-sqlite3's
# native binary is ABI-locked to the node version it was built against.
pm2 restart "$PM2_APP" --update-env 2>&1 | tee -a "$LOG_FILE"

log "Deployed $REMOTE_SHA successfully."
