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
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCK_FILE="/tmp/bloomaquatics-deploy.lock"
LOG_FILE="$REPO_DIR/deploy.log"
PM2_APP="bloom-aquatics"
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

CONCLUSION="$(echo "$RESPONSE" | grep -o "\"name\":\"${CHECK_NAME}\"[^}]*\"conclusion\":\"[a-z_]*\"" \
  | grep -o '"conclusion":"[a-z_]*"' | head -1 | cut -d'"' -f4 || true)"

if [ "$CONCLUSION" != "success" ]; then
  log "Commit $REMOTE_SHA build check is '${CONCLUSION:-not finished yet}' — waiting."
  exit 0
fi

log "Build check green for $REMOTE_SHA. Deploying..."

# ── The actual deploy: same three steps as the manual README flow ──
git pull --ff-only origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
npm ci 2>&1 | tee -a "$LOG_FILE"
npm run build 2>&1 | tee -a "$LOG_FILE"
pm2 restart "$PM2_APP" 2>&1 | tee -a "$LOG_FILE"

log "Deployed $REMOTE_SHA successfully."
