#!/usr/bin/env bash
# The whole move in one go: stop the backend, copy data and avatars, check the
# counts, and start the backend on the other side. If anything fails before
# the backend is switched, it is started again on the side it came from, so
# the old side stays the live one.
#
#   ./cutover.sh cloud vps
#   ./cutover.sh vps cloud
. "$(dirname "$0")/lib.sh"

SRC=${1:-}
DST=${2:-}
check_side "$SRC"
check_side "$DST"
[ "$(backend_side)" = "$SRC" ] || die "the backend is on '$(backend_side)', not '$SRC'"

cd "$(dirname "$0")"
stage=before
restore_backend() {
  case "$stage" in
    before)
      echo "!! stopped before switching; starting the backend again on $SRC" >&2
      docker start "$BACKEND_CONTAINER" >/dev/null
      ;;
    switching)
      echo "!! switching failed; putting the backend back on $SRC" >&2
      ./switch-backend.sh "$SRC"
      ;;
  esac
}
trap restore_backend EXIT

log "stopping the backend $(date +%T)"
docker stop "$BACKEND_CONTAINER" >/dev/null
./sync-db.sh "$SRC" "$DST" --apply
./verify.sh "$SRC" "$DST"
./copy-avatars.sh "$SRC" "$DST" --apply
stage=switching
./switch-backend.sh "$DST"
stage=done
log "backend is on $DST $(date +%T); now point Vercel at $DST and redeploy"
