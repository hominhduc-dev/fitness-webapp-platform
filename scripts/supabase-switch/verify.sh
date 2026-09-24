#!/usr/bin/env bash
# Row counts per table and the latest migration, side by side.
#
#   ./verify.sh cloud vps
#   ./verify.sh vps
. "$(dirname "$0")/lib.sh"

[ $# -ge 1 ] || die "usage: $0 <cloud|vps> [cloud|vps]"

COUNTS_SQL="
select table_schema || '.' || table_name || '|' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
from information_schema.tables
where table_type = 'BASE TABLE'
  and (table_schema = 'public' or (table_schema = 'auth' and table_name in ('users', 'identities')))
union all
select 'latest migration|' || max(migration_name) from _prisma_migrations where finished_at is not null
order by 1"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
for side in "$@"; do
  check_side "$side"
  psql_on "$side" -Atc "$COUNTS_SQL" >"$WORK/$side"
done

if [ $# -eq 1 ]; then
  column -t -s'|' "$WORK/$1"
  exit 0
fi

# Rows that differ are marked with "!".
export LC_ALL=C
join -t'|' -a1 -a2 -e'-' -o 0,1.2,2.2 <(sort "$WORK/$1") <(sort "$WORK/$2") |
  awk -F'|' -v a="$1" -v b="$2" 'BEGIN { print "table|" a "|" b "|" } { print $0 "|" ($2 == $3 ? "" : "!") }' |
  column -t -s'|'
