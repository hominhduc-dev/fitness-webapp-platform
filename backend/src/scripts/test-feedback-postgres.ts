/** PostgreSQL smoke/concurrency check. Uses UUID-scoped fixtures only.
 * Run from backend: npx tsx src/scripts/test-feedback-postgres.ts
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import dotenv from "dotenv"
import type { SerializedProfile } from "../services/auth.service"

dotenv.config({ quiet: true })
process.env.NODE_ENV = "test"
process.env.PRISMA_SLOW_QUERY_MS = "0"

async function main() {
  const { prisma } = await import("../lib/prisma.js")
  assert(prisma, "Prisma database must be configured")
  const { createFeedback, getFeedback, listFeedback, updateFeedback } = await import("../services/feedback.service.js")
  const ids = [randomUUID(), randomUUID(), randomUUID()]
  const profiles = ids.map((id, index) => ({ id, role: index === 2 ? "admin" : "trainee" }) as SerializedProfile)
  try {
    await prisma.user.createMany({ data: ids.map((id, index) => ({ id, name: "Feedback test fixture", email: `feedback-${id}@example.invalid`, role: index === 2 ? "admin" : "trainee" })) })
    const screenshot = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1kAAAAASUVORK5CYII="
    const created = await createFeedback(profiles[0], { category: "bug", message: "Feedback PostgreSQL integration fixture", pagePath: "/profile", screenshot }, "test-browser")
    assert.equal(created.status, "new")
    assert(!("screenshot" in created))
    const own = await listFeedback(profiles[0], { page: 1, limit: 20 }, true)
    assert.equal(own.total, 1)
    assert(!("screenshot" in own.items[0]))
    assert.equal((await listFeedback(profiles[1], { page: 1, limit: 20 }, true)).total, 0)
    await assert.rejects(getFeedback(profiles[1], created.id), (error: unknown) => (error as { status: number }).status === 404)
    await assert.rejects(listFeedback(profiles[0], { page: 1, limit: 20 }), (error: unknown) => (error as { status: number }).status === 403)
    await assert.rejects(updateFeedback(profiles[0], created.id, { status: "resolved", expectedUpdatedAt: created.updatedAt }), (error: unknown) => (error as { status: number }).status === 403)
    assert.equal((await getFeedback(profiles[0], created.id)).screenshot, screenshot)
    const attempts = await Promise.allSettled([
      updateFeedback(profiles[2], created.id, { status: "in_progress", expectedUpdatedAt: created.updatedAt }),
      updateFeedback(profiles[2], created.id, { status: "resolved", expectedUpdatedAt: created.updatedAt }),
    ])
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1)
    const conflict = attempts.find((result) => result.status === "rejected") as PromiseRejectedResult
    assert.equal(conflict.reason.status, 409)
    const latest = await getFeedback(profiles[2], created.id)
    assert.equal(latest.reporter?.id, ids[0])
    const resolved = await updateFeedback(profiles[2], created.id, { status: "resolved", expectedUpdatedAt: latest.updatedAt })
    assert.equal(resolved.status, "resolved")
    console.log("PASS: create, private detail, own pagination, role guards, screenshot exclusion, concurrent status conflict, resolve")
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
    assert.equal(await prisma.userFeedback.count({ where: { userId: { in: ids } } }), 0)
    await prisma.$disconnect()
    console.log("Fixture cleanup: 0 remaining")
  }
}
main().catch(() => { console.error("Feedback PostgreSQL check failed"); process.exitCode = 1 })
