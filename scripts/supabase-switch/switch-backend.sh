#!/usr/bin/env bash
# Point the production backend at one Supabase and restart it.
#
# A server-only docker-compose.override.yml loads `supabase.env` after the
# backend's own env file and joins the self-hosted stack's network
# (docs/supabase-switch.md). This script only swaps that one file, so the rest
# of the backend's configuration stays where it is.
#
#   ./switch-backend.sh vps
#   ./switch-backend.sh cloud
. "$(dirname "$0")/lib.sh"

BACKEND_DIR="${BACKEND_DIR:-/home/yeahbuddy/htdocs/backend.hominhduc.me}"
SIDE=${1:-}
check_side "$SIDE"

profile="$SWITCH_DIR/$SIDE.env"
[ -r "$profile" ] || die "missing $profile (run capture-env.sh first)"
[ -w "$BACKEND_DIR" ] || die "cannot write to $BACKEND_DIR"
grep -q 'supabase.env' "$BACKEND_DIR/docker-compose.override.yml" 2>/dev/null ||
  die "$BACKEND_DIR/docker-compose.override.yml does not load supabase.env yet (see docs/supabase-switch.md)"

install -m 600 "$profile" "$BACKEND_DIR/supabase.env"
# CI deploys run `docker compose` as the directory's owner, which must still
# read the profile and the override this user created.
deploy_user=$(stat -c %U "$BACKEND_DIR")
setfacl -m "u:$deploy_user:r,m::r" "$BACKEND_DIR/supabase.env" "$BACKEND_DIR/docker-compose.override.yml"
(cd "$BACKEND_DIR" && docker compose up -d --force-recreate)

log "waiting for the backend"
for _ in $(seq 1 30); do
  if health=$(docker exec "$BACKEND_CONTAINER" wget -qO- http://localhost:4000/api/health 2>/dev/null); then
    printf '%s\n' "$health" | grep -q '"connected":true' || die "backend is up but cannot reach its database: $health"
    [ "$(backend_side)" = "$SIDE" ] || die "backend came up on '$(backend_side)', expected '$SIDE'"
    log "backend is on $SIDE and its database is reachable"
    exit 0
  fi
  sleep 2
done
die "backend did not become healthy; check: docker logs $BACKEND_CONTAINER"
