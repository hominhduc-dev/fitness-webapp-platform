#!/usr/bin/env bash
# Point the local dev env files (.env.local, backend/.env) at one Supabase.
# Run on your own machine (Git Bash), not on the VPS.
#
#   scripts/supabase-switch/local-env.sh vps     # self-hosted: keys pulled from the VPS
#   scripts/supabase-switch/local-env.sh cloud   # restore the saved Cloud copies
#
# The first `vps` run saves the current files (the Cloud ones) to $SAVE_DIR.
# Secrets are written straight into the files and never printed.
#
# With `vps`, the backend reaches the database through an SSH tunnel to the VPS.
# `npm run dev:backend` opens it automatically (scripts/dev-backend.mjs reads
# DEV_DB_SSH_TUNNEL); by hand it is:
#   ssh -N -L 55432:127.0.0.1:5432 duc@187.77.133.167
set -euo pipefail

VPS=${VPS:-duc@187.77.133.167}
VPS_URL=${VPS_URL:-https://supabase.hominhduc.cloud}
TUNNEL_PORT=${TUNNEL_PORT:-55432}
SAVE_DIR=${SAVE_DIR:-$HOME/.config/yeahbuddy/local-cloud}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
FRONTEND_ENV="$ROOT/.env.local"
BACKEND_ENV="$ROOT/backend/.env"

die() {
  echo "error: $*" >&2
  exit 1
}

case "${1:-}" in
  cloud)
    [ -f "$SAVE_DIR/.env.local" ] && [ -f "$SAVE_DIR/backend.env" ] || die "no saved Cloud copies in $SAVE_DIR"
    cp "$SAVE_DIR/.env.local" "$FRONTEND_ENV"
    cp "$SAVE_DIR/backend.env" "$BACKEND_ENV"
    echo "local env restored from $SAVE_DIR (Supabase Cloud)"
    ;;
  vps)
    mkdir -p "$SAVE_DIR"
    # Keep the first copy: that is the Cloud one to go back to.
    [ -f "$SAVE_DIR/.env.local" ] || cp "$FRONTEND_ENV" "$SAVE_DIR/.env.local"
    [ -f "$SAVE_DIR/backend.env" ] || cp "$BACKEND_ENV" "$SAVE_DIR/backend.env"

    # shellcheck disable=SC2016 # expanded on the VPS
    ssh -o BatchMode=yes "$VPS" 'cd ~/supabase; for k in ANON_KEY SERVICE_ROLE_KEY POSTGRES_PASSWORD POOLER_TENANT_ID; do
        printf "%s=%s\n" "$k" "$(sed -n "s/^$k=//p" .env | tail -1 | tr -d "\"\r")"; done' |
      FRONTEND_ENV="$FRONTEND_ENV" BACKEND_ENV="$BACKEND_ENV" VPS="$VPS" VPS_URL="$VPS_URL" TUNNEL_PORT="$TUNNEL_PORT" \
        python -c '
import io, os, re, sys, urllib.parse

src = dict(line.split("=", 1) for line in sys.stdin.read().splitlines() if "=" in line)
for key in ("ANON_KEY", "SERVICE_ROLE_KEY", "POSTGRES_PASSWORD", "POOLER_TENANT_ID"):
    if not src.get(key):
        sys.exit(f"missing {key} from the VPS")

url = os.environ["VPS_URL"]
db = "postgresql://postgres.{}:{}@127.0.0.1:{}/postgres".format(
    src["POOLER_TENANT_ID"], urllib.parse.quote(src["POSTGRES_PASSWORD"], safe=""), os.environ["TUNNEL_PORT"])

def update(path, values):
    text = io.open(path, encoding="utf-8").read()
    for key, value in values.items():
        pattern = re.compile(rf"^{re.escape(key)}=.*$", re.M)
        line = f"{key}={value}"
        text = pattern.sub(lambda _: line, text) if pattern.search(text) else text.rstrip("\n") + "\n" + line + "\n"
    io.open(path, "w", encoding="utf-8", newline="").write(text)
    names = ", ".join(values)
    print(f"{path}: set {names}")

update(os.environ["FRONTEND_ENV"], {
    "NEXT_PUBLIC_SUPABASE_URL": url,
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": src["ANON_KEY"],
})
update(os.environ["BACKEND_ENV"], {
    "DATABASE_URL": db + "?connection_limit=5",
    "DIRECT_URL": db,
    "SUPABASE_URL": url,
    "SUPABASE_ANON_KEY": src["ANON_KEY"],
    "SUPABASE_SERVICE_ROLE_KEY": src["SERVICE_ROLE_KEY"],
    "DEV_DB_SSH_TUNNEL": os.environ["VPS"],
})
'
    echo "local env now points at $VPS_URL; npm run dev:backend opens the SSH tunnel itself"
    ;;
  *) die "usage: $0 <vps|cloud>" ;;
esac
