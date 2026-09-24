// `npm run dev:backend`: starts the backend, first opening the SSH tunnel to
// the self-hosted database when backend/.env asks for one.
//
// backend/.env opts in with DEV_DB_SSH_TUNNEL=<user@host> while DATABASE_URL
// points at 127.0.0.1:<port> (scripts/supabase-switch/local-env.sh vps sets
// both). The tunnel forwards that port to DEV_DB_SSH_REMOTE on the host
// (default 127.0.0.1:5432, the Supabase pooler) and closes with the backend.
// An already-open tunnel on the port is reused and left alone.
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function readEnv(file) {
  const env = {}
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2")
  }
  return env
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port })
    socket.setTimeout(1000)
    socket.once("connect", () => (socket.destroy(), resolve(true)))
    socket.once("error", () => resolve(false))
    socket.once("timeout", () => (socket.destroy(), resolve(false)))
  })
}

async function waitForPort(port, tunnel, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (tunnel.exitCode !== null) throw new Error(`ssh exited with code ${tunnel.exitCode}`)
    if (await portOpen(port)) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`tunnel port ${port} did not open within ${timeoutMs / 1000}s`)
}

async function openTunnel(env) {
  const target = env.DEV_DB_SSH_TUNNEL
  if (!target) return null

  let url
  try {
    url = new URL(env.DATABASE_URL ?? "")
  } catch {
    return null
  }
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) return null

  const port = Number(url.port || 5432)
  if (await portOpen(port)) {
    console.log(`[dev-backend] reusing the tunnel already open on :${port}`)
    return null
  }

  const remote = env.DEV_DB_SSH_REMOTE || "127.0.0.1:5432"
  console.log(`[dev-backend] opening SSH tunnel :${port} -> ${target} ${remote}`)
  const tunnel = spawn(
    "ssh",
    ["-N", "-o", "ExitOnForwardFailure=yes", "-o", "ServerAliveInterval=30", "-L", `${port}:${remote}`, target],
    { stdio: "inherit" },
  )
  await waitForPort(port, tunnel)
  console.log("[dev-backend] tunnel ready")
  return tunnel
}

const env = readEnv(path.join(root, "backend", ".env"))
let tunnel = null
try {
  tunnel = await openTunnel(env)
} catch (error) {
  console.error(`[dev-backend] ${error.message}. Is the VPS reachable over SSH with your key?`)
  process.exit(1)
}

const backend = spawn("npm", ["--prefix", "backend", "run", "dev"], { cwd: root, stdio: "inherit", shell: true })

function stop(code) {
  tunnel?.kill()
  process.exit(code ?? 0)
}

backend.on("exit", (code) => stop(code))
tunnel?.on("exit", (code) => {
  console.error(`[dev-backend] SSH tunnel closed (code ${code}); stopping the backend`)
  backend.kill()
  stop(1)
})
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    backend.kill(signal)
    stop(0)
  })
}
