#!/usr/bin/env bash
# Copy the app's data from one Supabase database to the other:
#   - every table in `public` (including _prisma_migrations)
#   - auth.users and auth.identities, so accounts, ids and passwords carry over
#
# Both sides must be on the same Prisma migration (see migrate.sh). Each table
# copies only the columns both sides have, minus generated ones, so small
# version differences between Cloud and self-hosted Auth do not matter; a
# destination column that is required but missing on the source fails loudly.
#
# Everything runs in one transaction on the destination, which is emptied
# first, then row counts are checked against the source. Without --apply the
# transaction is rolled back: a full rehearsal that changes nothing.
#
#   ./sync-db.sh cloud vps            # rehearsal
#   ./sync-db.sh cloud vps --apply    # for real (backend must be stopped)
. "$(dirname "$0")/lib.sh"

SRC=${1:-}
DST=${2:-}
MODE=${3:-}
check_side "$SRC"
check_side "$DST"
[ "$SRC" != "$DST" ] || die "source and destination are the same"
[ -z "$MODE" ] || [ "$MODE" = "--apply" ] || die "unknown option '$MODE'"

if [ "$MODE" = "--apply" ] && backend_running; then
  die "stop the backend first so nothing is written while copying"
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
umask 077

log "versions"
for side in "$SRC" "$DST"; do
  printf '%-6s %s\n' "$side" "$(psql_on "$side" -Atc 'show server_version')"
done

log "migrations"
latest_migration() {
  psql_on "$1" -Atc "select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by migration_name desc limit 1"
}
src_migration=$(latest_migration "$SRC")
dst_migration=$(latest_migration "$DST")
printf '%-6s %s\n%-6s %s\n' "$SRC" "$src_migration" "$DST" "$dst_migration"
[ "$src_migration" = "$dst_migration" ] || die "migrations differ; run ./migrate.sh $([ "$src_migration" \> "$dst_migration" ] && echo "$DST" || echo "$SRC") first"

# schema|table|column for every copyable column, in column order.
COLUMNS_SQL="
select c.table_schema || '|' || c.table_name || '|' || c.column_name
from information_schema.columns c
join information_schema.tables t using (table_schema, table_name)
where t.table_type = 'BASE TABLE'
  and c.is_generated = 'NEVER'
  and (c.table_schema = 'public'
       or (c.table_schema = 'auth' and c.table_name in ('users', 'identities')))
order by c.table_schema, c.table_name, c.ordinal_position"
psql_on "$SRC" -Atc "$COLUMNS_SQL" >"$WORK/src.columns"
psql_on "$DST" -Atc "$COLUMNS_SQL" >"$WORK/dst.columns"

cut -d'|' -f1,2 "$WORK/src.columns" | uniq >"$WORK/src.tables"
cut -d'|' -f1,2 "$WORK/dst.columns" | uniq >"$WORK/dst.tables"
missing=$(comm -3 <(sort "$WORK/src.tables") <(sort "$WORK/dst.tables") || true)
[ -z "$missing" ] || die "the two sides have different tables:
$missing"

quote_ident() {
  printf '"%s"' "${1//\"/\"\"}"
}

# Tables are emptied together up front; auth.users cascades to Auth's own
# session tables, which hold nothing useful across a switch anyway.
truncate_list=$(while IFS='|' read -r schema table; do
  printf '%s.%s, ' "$(quote_ident "$schema")" "$(quote_ident "$table")"
done <"$WORK/src.tables")

BUNDLE="$WORK/bundle.sql"
{
  echo "begin;"
  echo "set local session_replication_role = replica;"
  echo "truncate ${truncate_list%, } cascade;"
} >"$BUNDLE"
: >"$WORK/counts"

log "copying from $SRC"
while IFS='|' read -r schema table; do
  # Source column order, kept only where the destination has the column too.
  cols=$(grep -F "$schema|$table|" "$WORK/src.columns" | cut -d'|' -f3 |
    grep -Fxf <(grep -F "$schema|$table|" "$WORK/dst.columns" | cut -d'|' -f3) |
    while IFS= read -r col; do printf '%s,' "$(quote_ident "$col")"; done)
  cols=${cols%,}
  qualified="$(quote_ident "$schema").$(quote_ident "$table")"

  psql_on "$SRC" -c "copy (select $cols from $qualified) to stdout" >"$WORK/data"
  # Text-format COPY escapes newlines, so each line is one row.
  rows=$(wc -l <"$WORK/data")
  printf '%s|%s\n' "$qualified" "$rows" >>"$WORK/counts"
  printf '%8s  %s\n' "$rows" "$qualified" >&2

  {
    echo "copy $qualified ($cols) from stdin;"
    cat "$WORK/data"
    echo '\.'
  } >>"$BUNDLE"
done <"$WORK/src.tables"
[ "$(wc -l <"$WORK/counts")" -eq "$(wc -l <"$WORK/src.tables")" ] || die "copied $(wc -l <"$WORK/counts") of $(wc -l <"$WORK/src.tables") tables"

{
  # Serial columns continue after the copied rows.
  cat <<'SQL'
do $$
declare r record;
begin
  for r in
    select s.oid::regclass as seq, a.attrelid::regclass as tbl, a.attname as col
    from pg_class s
    join pg_namespace n on n.oid = s.relnamespace and n.nspname = 'public'
    join pg_depend d on d.objid = s.oid and d.deptype in ('a', 'i')
    join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
    where s.relkind = 'S'
  loop
    execute format('select setval(%L, coalesce((select max(%I) from %s), 0) + 1, false)', r.seq, r.col, r.tbl);
  end loop;
end $$;
SQL
  # Every table must hold exactly what the source had.
  echo 'do $$ begin'
  while IFS='|' read -r qualified rows; do
    echo "  if (select count(*) from $qualified) <> $rows then raise exception 'row count mismatch in %', '$qualified'; end if;"
  done <"$WORK/counts"
  echo 'end $$;'
  if [ "$MODE" = "--apply" ]; then echo "commit;"; else echo "rollback;"; fi
} >>"$BUNDLE"

if [ "$MODE" = "--apply" ]; then
  mkdir -p "$BACKUP_DIR"
  backup="$BACKUP_DIR/$DST-before-sync-$(date +%Y%m%d-%H%M%S).dump"
  log "backing up $DST to $backup"
  pg_dump_on "$DST" -Fc --schema=public >"$backup"
  pg_dump_on "$DST" -Fc --data-only -t auth.users -t auth.identities >"${backup%.dump}.auth.dump"
fi

log "loading into $DST ($([ "$MODE" = "--apply" ] && echo "apply" || echo "rehearsal, rolled back"))"
psql_stdin "$DST" <"$BUNDLE" >/dev/null
total=$(awk -F'|' '{ s += $2 } END { print s }' "$WORK/counts")
log "ok: $(wc -l <"$WORK/counts") tables, $total rows$([ "$MODE" = "--apply" ] && echo ", committed" || echo "; nothing was changed")"
