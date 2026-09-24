#!/usr/bin/env bash
# Run a Prisma migrate command against one side, using the deployed backend
# image so the migrations are exactly the ones production runs.
#
#   ./migrate.sh vps            # prisma migrate status
#   ./migrate.sh vps deploy     # prisma migrate deploy
#   ./migrate.sh vps resolve --applied <migration>
. "$(dirname "$0")/lib.sh"

SIDE=${1:-}
COMMAND=${2:-status}
check_side "$SIDE"
case "$COMMAND" in status | deploy | resolve) ;; *) die "unknown command '$COMMAND' (status, deploy or resolve)" ;; esac
shift $(($# < 2 ? $# : 2))

network=()
[ "$SIDE" = "vps" ] && network=(--network "$SUPABASE_NETWORK")

url=$(prisma_url "$SIDE")
DATABASE_URL="$url" DIRECT_URL="$url" docker run --rm "${network[@]}" \
  -e DATABASE_URL -e DIRECT_URL --entrypoint node_modules/.bin/prisma \
  "$BACKEND_IMAGE" migrate "$COMMAND" "$@"
