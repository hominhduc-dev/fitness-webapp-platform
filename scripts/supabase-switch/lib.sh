# Shared helpers for moving the app between Supabase Cloud and the
# self-hosted Supabase on the VPS. Sourced by the other scripts here.
#
# Run on the VPS as a user in the docker group. The Postgres client tools come
# from the self-hosted db container, so the host needs nothing installed.
# Connection strings and keys are read from files and handed to containers
# through the environment, never on a command line, so they stay out of `ps`
# and out of the terminal.

set -euo pipefail

SUPABASE_DIR="${SUPABASE_DIR:-$HOME/supabase}"
SWITCH_DIR="${SWITCH_DIR:-$HOME/.config/yeahbuddy}"
CLOUD_ENV="$SWITCH_DIR/cloud.env"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
BACKEND_CONTAINER="${BACKEND_CONTAINER:-yeahbuddy-backend}"
BACKEND_IMAGE="${BACKEND_IMAGE:-yeahbuddy-backend:latest}"
SUPABASE_NETWORK="${SUPABASE_NETWORK:-supabase_default}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
VPS_PUBLIC_URL="${VPS_PUBLIC_URL:-https://supabase.hominhduc.cloud}"

die() {
  echo "error: $*" >&2
  exit 1
}

log() {
  echo "== $*" >&2
}

# A value from a KEY=value file, without echoing it.
env_value() {
  local file=$1 key=$2
  [ -r "$file" ] || die "cannot read $file"
  sed -n "s/^${key}=//p" "$file" | tail -n 1 | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'
}

# libpq rejects Prisma's own URL parameters, so they are dropped.
strip_prisma_params() {
  sed -E ':a; s/([?&])(pgbouncer|connection_limit|pool_timeout|schema|statement_cache_size)=[^&]*&?/\1/; ta; s/[?&]$//'
}

# The connection for one side, as seen from inside the db container.
#   vps   - the self-hosted database over its local socket
#   cloud - Supabase Cloud's direct (session) URL saved in $CLOUD_ENV
conninfo() {
  case "$1" in
    vps) echo "dbname=postgres user=postgres" ;;
    cloud)
      local url
      url=$(env_value "$CLOUD_ENV" DIRECT_URL)
      [ -n "$url" ] || die "DIRECT_URL is missing from $CLOUD_ENV (run capture-env.sh first)"
      printf '%s\n' "$url" | strip_prisma_params
      ;;
    *) die "unknown side '$1' (expected cloud or vps)" ;;
  esac
}

# The Prisma URL for one side, as seen from a container on $SUPABASE_NETWORK.
prisma_url() {
  case "$1" in
    vps)
      local password
      password=$(env_value "$SUPABASE_DIR/.env" POSTGRES_PASSWORD)
      [ -n "$password" ] || die "POSTGRES_PASSWORD is missing from $SUPABASE_DIR/.env"
      printf 'postgresql://postgres:%s@%s:5432/postgres' "$(urlencode "$password")" "$DB_CONTAINER"
      ;;
    cloud) env_value "$CLOUD_ENV" DIRECT_URL ;;
    *) die "unknown side '$1' (expected cloud or vps)" ;;
  esac
}

urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""), end="")' "$1"
}

check_side() {
  case "$1" in
    cloud | vps) ;;
    *) die "unknown side '$1' (expected cloud or vps)" ;;
  esac
}

# psql / pg_dump against a side. Extra arguments go to the tool. Only
# psql_stdin attaches stdin: with `docker exec -i` a command would otherwise
# swallow whatever the caller is reading, such as a loop's input or the rest
# of a script piped into bash.
psql_on() {
  local side=$1
  shift
  PGCONN="$(conninfo "$side")" docker exec -e PGCONN "$DB_CONTAINER" \
    sh -c 'exec psql "$PGCONN" -X -q -v ON_ERROR_STOP=1 "$@"' psql "$@"
}

psql_stdin() {
  local side=$1
  shift
  PGCONN="$(conninfo "$side")" docker exec -i -e PGCONN "$DB_CONTAINER" \
    sh -c 'exec psql "$PGCONN" -X -q -v ON_ERROR_STOP=1 "$@"' psql "$@"
}

pg_dump_on() {
  local side=$1
  shift
  PGCONN="$(conninfo "$side")" docker exec -e PGCONN "$DB_CONTAINER" \
    sh -c 'exec pg_dump "$PGCONN" "$@"' pg_dump "$@"
}

backend_running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$BACKEND_CONTAINER" 2>/dev/null || echo false)" = "true" ]
}

# Which Supabase the running backend talks to, judged by its SUPABASE_URL.
backend_side() {
  local url
  url=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$BACKEND_CONTAINER" | sed -n 's/^SUPABASE_URL=//p')
  case "$url" in
    "$VPS_PUBLIC_URL"*) echo vps ;;
    *supabase.co*) echo cloud ;;
    *) echo unknown ;;
  esac
}
