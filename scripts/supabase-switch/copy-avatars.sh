#!/usr/bin/env bash
# Copy avatar files between the two Supabase Storage APIs and point each
# user's avatar URL at the copy. Run after sync-db.sh, since it reads and
# updates the destination database. An avatar that cannot be downloaded (for
# example while Cloud Storage is restricted) keeps its old URL, which works
# again once that side is back.
#
#   ./copy-avatars.sh cloud vps            # count what would be copied
#   ./copy-avatars.sh cloud vps --apply
. "$(dirname "$0")/lib.sh"

SRC=${1:-}
DST=${2:-}
check_side "$SRC"
check_side "$DST"
[ "$SRC" != "$DST" ] || die "source and destination are the same"
APPLY=$([ "${3:-}" = "--apply" ] && echo 1 || echo 0)

storage_url() {
  if [ "$1" = "vps" ]; then echo "$VPS_PUBLIC_URL"; else env_value "$CLOUD_ENV" SUPABASE_URL; fi
}
storage_key() {
  if [ "$1" = "vps" ]; then env_value "$SUPABASE_DIR/.env" SERVICE_ROLE_KEY; else env_value "$CLOUD_ENV" SUPABASE_SERVICE_ROLE_KEY; fi
}

network=()
[ "$DST" = "vps" ] && network=(--network "$SUPABASE_NETWORK")

SRC_URL=$(storage_url "$SRC") SRC_KEY=$(storage_key "$SRC") \
  DST_URL=$(storage_url "$DST") DST_KEY=$(storage_key "$DST") \
  DATABASE_URL=$(prisma_url "$DST") APPLY=$APPLY \
  docker run --rm -i "${network[@]}" \
  -e SRC_URL -e SRC_KEY -e DST_URL -e DST_KEY -e DATABASE_URL -e APPLY \
  --entrypoint node "$BACKEND_IMAGE" - <<'JS'
const { PrismaClient } = require("@prisma/client")
const { createClient } = require("@supabase/supabase-js")

const BUCKET = "avatars"
const PREFIX = `/storage/v1/object/public/${BUCKET}/`
const options = { auth: { persistSession: false, autoRefreshToken: false } }
const source = createClient(process.env.SRC_URL, process.env.SRC_KEY, options)
const destination = createClient(process.env.DST_URL, process.env.DST_KEY, options)
const prisma = new PrismaClient()
const apply = process.env.APPLY === "1"

async function main() {
  const sourcePrefix = new URL(process.env.SRC_URL).origin + PREFIX
  const users = await prisma.user.findMany({
    where: { avatar: { startsWith: sourcePrefix } },
    select: { id: true, avatar: true },
  })
  console.log(`${users.length} avatars stored on ${new URL(sourcePrefix).host}`)

  if (apply && users.length > 0) {
    const { error } = await destination.storage.createBucket(BUCKET, { public: true })
    if (error && !/exist/i.test(error.message)) throw error
  }

  let copied = 0
  let skipped = 0
  for (const user of users) {
    const path = decodeURIComponent(user.avatar.slice(sourcePrefix.length).split("?")[0])
    const download = await source.storage.from(BUCKET).download(path)
    if (download.error) {
      // An earlier copy may already be there; then only the URL needs moving.
      const existing = await destination.storage.from(BUCKET).exists(path)
      if (!existing.data) {
        skipped++
        console.log(`skip ${path}: ${download.error.message || "download failed"}`)
        continue
      }
      console.log(`${path}: source unavailable, destination already has it`)
    } else if (apply) {
      const upload = await destination.storage.from(BUCKET).upload(path, download.data, {
        cacheControl: "31536000",
        contentType: download.data.type || undefined,
        upsert: true,
      })
      if (upload.error) {
        skipped++
        console.log(`skip ${path}: ${upload.error.message}`)
        continue
      }
    }
    if (!apply) {
      copied++
      continue
    }
    const { data } = destination.storage.from(BUCKET).getPublicUrl(path)
    await prisma.user.update({ where: { id: user.id }, data: { avatar: data.publicUrl } })
    copied++
  }
  console.log(`${apply ? "copied" : "can copy"}: ${copied}, skipped: ${skipped}`)
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
JS
