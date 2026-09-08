import { lookup } from "node:dns/promises"
import { createConnection } from "node:net"

import { PrismaClient } from "@prisma/client"

import { env } from "../config/env"

/**
 * Connection doctor for the Supabase Postgres URLs.
 *
 * A Prisma P1001 ("Can't reach database server") collapses several very different
 * causes into one message: a paused project, a firewall dropping the Postgres port,
 * an IPv6-only host on an IPv4-only network, or a typo in the hostname. This walks
 * the connection layer by layer — parse, DNS, TCP, then an actual query — and
 * reports which layer broke, so the fix is not a guess.
 *
 * Run with: npm --prefix backend run db:doctor
 */

const TCP_TIMEOUT_MS = 8_000
const QUERY_TIMEOUT_MS = 15_000

type Layer = "ok" | "fail"

function maskUrl(raw: string) {
  try {
    const url = new URL(raw)
    if (url.password) {
      url.password = "***"
    }
    return url.toString()
  } catch {
    return "<unparseable connection string>"
  }
}

function tcpProbe(host: string, port: number) {
  return new Promise<{ status: Layer; detail: string }>((resolve) => {
    const socket = createConnection({ host, port })
    const settle = (status: Layer, detail: string) => {
      socket.destroy()
      resolve({ status, detail })
    }

    socket.setTimeout(TCP_TIMEOUT_MS)
    socket.once("connect", () => settle("ok", `connected to ${host}:${port}`))
    socket.once("timeout", () => settle("fail", `no response within ${TCP_TIMEOUT_MS} ms`))
    socket.once("error", (error: NodeJS.ErrnoException) =>
      settle("fail", `${error.code ?? "error"} — ${error.message}`),
    )
  })
}

async function dnsProbe(host: string) {
  try {
    const records = await lookup(host, { all: true })
    const v4 = records.filter((record) => record.family === 4).map((record) => record.address)
    const v6 = records.filter((record) => record.family === 6).map((record) => record.address)
    return { status: "ok" as Layer, v4, v6 }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown"
    return { status: "fail" as Layer, code, v4: [] as string[], v6: [] as string[] }
  }
}

async function queryProbe(connectionString: string) {
  const client = new PrismaClient({
    datasources: { db: { url: connectionString } },
    log: [],
  })

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`query did not return within ${QUERY_TIMEOUT_MS} ms`)), QUERY_TIMEOUT_MS).unref()
  })

  try {
    await Promise.race([client.$queryRaw`SELECT 1`, timeout])
    return { status: "ok" as Layer, detail: "SELECT 1 succeeded" }
  } catch (error) {
    return { status: "fail" as Layer, detail: error instanceof Error ? error.message : String(error) }
  } finally {
    await client.$disconnect().catch(() => undefined)
  }
}

function diagnose(input: {
  dns: Awaited<ReturnType<typeof dnsProbe>>
  host: string
  port: number
  query: { status: Layer; detail: string } | null
  tcp: { status: Layer; detail: string }
}) {
  const { dns, host, port, query, tcp } = input

  if (dns.status === "fail") {
    return `DNS cannot resolve ${host}. Check the hostname for a typo, then flush the resolver cache (ipconfig /flushdns).`
  }

  if (tcp.status === "fail") {
    if (dns.v4.length === 0 && dns.v6.length > 0) {
      return [
        `${host} publishes only IPv6 addresses and the TCP connection failed.`,
        "On an IPv4-only network this host is unreachable no matter what the credentials are.",
        "Use the Shared Pooler hostname (aws-N-<region>.pooler.supabase.com), which serves IPv4,",
        "or enable the IPv4 add-on for the project.",
      ].join(" ")
    }

    return [
      `The host resolves but nothing accepts a connection on port ${port}.`,
      "Two causes account for almost all of these: the Supabase project is paused",
      "(check the dashboard for a Restore project button), or the local network blocks",
      `the port. To tell them apart, try the other pooler port — 5432 (session mode) and`,
      "6543 (transaction mode) — since a firewall usually blocks one and not both.",
    ].join(" ")
  }

  if (query && query.status === "fail") {
    const detail = query.detail.toLowerCase()

    if (detail.includes("password authentication failed") || detail.includes("p1000")) {
      return [
        "The port is open and the server answered, so the network is fine — the credentials are not.",
        "Confirm the user is postgres.<project-ref> (the pooler requires the ref suffix) and that",
        "any special character in the password is percent-encoded.",
      ].join(" ")
    }

    if (detail.includes("prepared statement") && detail.includes("already exists")) {
      return "Transaction-mode pooling without pgbouncer=true. Append ?pgbouncer=true to the port 6543 URL."
    }

    if (detail.includes("does not exist")) {
      return "Connected, but the database or role named in the URL does not exist. The pooler expects database `postgres`."
    }

    return "TCP is open but the Postgres handshake failed. The message above is the server's own words — start there."
  }

  return "All layers healthy."
}

async function checkTarget(label: string, connectionString: string) {
  console.log(`\n=== ${label} ===`)
  console.log(`url        ${maskUrl(connectionString)}`)

  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    console.log("parse      FAIL — not a valid connection string")
    return false
  }

  const host = url.hostname
  const port = Number(url.port || 5432)

  console.log(`host       ${host}`)
  console.log(`port       ${port}${port === 6543 ? " (transaction mode)" : port === 5432 ? " (session mode)" : ""}`)
  console.log(`user       ${decodeURIComponent(url.username)}`)
  console.log(`database   ${url.pathname.replace(/^\//, "") || "(none)"}`)

  const dns = await dnsProbe(host)
  console.log(
    dns.status === "ok"
      ? `dns        OK — IPv4: ${dns.v4.join(", ") || "none"} | IPv6: ${dns.v6.join(", ") || "none"}`
      : `dns        FAIL — ${dns.code}`,
  )

  const tcp = dns.status === "ok" ? await tcpProbe(host, port) : { detail: "skipped", status: "fail" as Layer }
  console.log(`tcp        ${tcp.status === "ok" ? "OK" : "FAIL"} — ${tcp.detail}`)

  const query = tcp.status === "ok" ? await queryProbe(connectionString) : null
  if (query) {
    console.log(`query      ${query.status === "ok" ? "OK" : "FAIL"} — ${query.detail}`)
  } else {
    console.log("query      skipped (no TCP connection)")
  }

  console.log(`\n→ ${diagnose({ dns, host, port, query, tcp })}`)

  return dns.status === "ok" && tcp.status === "ok" && query?.status === "ok"
}

async function main() {
  const targets: Array<[string, string | undefined]> = [
    ["DATABASE_URL", env.databaseUrl],
    ["DIRECT_URL", env.directUrl],
  ]

  const configured = targets.filter((entry): entry is [string, string] => Boolean(entry[1]))

  if (configured.length === 0) {
    console.log("Neither DATABASE_URL nor DIRECT_URL is set. Create backend/.env from backend/.env.example first.")
    process.exitCode = 1
    return
  }

  const results: boolean[] = []
  for (const [label, connectionString] of configured) {
    results.push(await checkTarget(label, connectionString))
  }

  const healthy = results.every(Boolean)
  console.log(`\n${healthy ? "All configured connections are healthy." : "At least one connection is broken — see above."}`)
  process.exitCode = healthy ? 0 : 1
}

main().catch((error) => {
  console.error("db-doctor crashed:", error)
  process.exitCode = 1
})
