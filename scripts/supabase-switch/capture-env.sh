#!/usr/bin/env bash
# Save the settings that differ between Supabase Cloud and the self-hosted
# stack as two small profiles in $SWITCH_DIR (mode 600):
#   cloud.env - the backend's current values
#   vps.env   - the same keys pointed at the self-hosted stack
# switch-backend.sh layers one of them over the backend's own .env.
#
# Run once while the backend still points at Supabase Cloud. Only variable
# names are printed.
#
#   ./capture-env.sh [--force]
. "$(dirname "$0")/lib.sh"

KEYS='DATABASE_URL|DIRECT_URL|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY'

[ "$(backend_side)" = "cloud" ] || die "the backend is not on Supabase Cloud; cloud.env would capture the wrong values"
if [ -e "$CLOUD_ENV" ] && [ "${1:-}" != "--force" ]; then
  die "$CLOUD_ENV already exists (pass --force to overwrite)"
fi

umask 077
mkdir -p "$SWITCH_DIR"

# Single quotes keep Docker Compose from interpolating `$` inside values.
quote_env() {
  while IFS= read -r line; do
    key=${line%%=*}
    value=${line#*=}
    case "$value" in *"'"*) die "$key contains a single quote; quote it by hand" ;; esac
    printf "%s='%s'\n" "$key" "$value"
  done
}

docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$BACKEND_CONTAINER" |
  grep -E "^($KEYS)=" | quote_env >"$CLOUD_ENV"
[ "$(grep -cE "^($KEYS)=" "$CLOUD_ENV")" -eq 5 ] || die "the backend is missing some of: ${KEYS//|/ }"

vps_url=$(prisma_url vps)
vps_anon=$(env_value "$SUPABASE_DIR/.env" ANON_KEY)
vps_service=$(env_value "$SUPABASE_DIR/.env" SERVICE_ROLE_KEY)
[ -n "$vps_anon" ] && [ -n "$vps_service" ] || die "ANON_KEY / SERVICE_ROLE_KEY missing from $SUPABASE_DIR/.env"

# One backend instance talks to the self-hosted db directly over the shared
# docker network; it does not need the pooler.
printf '%s\n' \
  "DATABASE_URL=$vps_url?connection_limit=10" \
  "DIRECT_URL=$vps_url" \
  "SUPABASE_URL=$VPS_PUBLIC_URL" \
  "SUPABASE_ANON_KEY=$vps_anon" \
  "SUPABASE_SERVICE_ROLE_KEY=$vps_service" | quote_env >"$SWITCH_DIR/vps.env"

log "wrote $CLOUD_ENV and $SWITCH_DIR/vps.env: ${KEYS//|/ }"
