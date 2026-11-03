import type { PrismaClient } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ remove: vi.fn(), warn: vi.fn() }))
vi.mock("../config/env", () => ({ env: { cloudinaryCloudName: "our-cloud", cloudinaryApiKey: "key", cloudinaryApiSecret: "secret" } }))
vi.mock("./exercise-media-upload", () => ({ removeStorageObjects: mocks.remove, cloudinarySignature: () => "signature" }))
vi.mock("./logger", () => ({ logger: { warn: mocks.warn } }))

import { cleanupUnreferencedExerciseMedia, exerciseMediaAssets, serializeExerciseMediaMutation, snapshotExerciseMedia } from "./exercise-media-cleanup"

const storage = { storage: { bucket: "exercise-media", animationPath: "dataset/a.mp4", thumbnailPath: "dataset/a.jpg" } }
function database(live: { id: string; metadata: unknown }[] = [], audits: unknown[] = []) {
  return {
    variation: { findMany: vi.fn().mockResolvedValue(live) },
    adminAuditLog: { findMany: vi.fn().mockResolvedValue(audits) },
  }
}
const asDb = (db: ReturnType<typeof database>) => db as unknown as PrismaClient

describe("unreferenced exercise media cleanup", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.remove.mockResolvedValue(undefined); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true })) })

  it("keeps A's assets when metadata was copied to B before deleting A", async () => {
    const db = database([{ id: "B", metadata: storage }])
    await cleanupUnreferencedExerciseMedia(asDb(db), [storage])
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("deletes files after the last reference disappears, deduplicating bulk candidates", async () => {
    await cleanupUnreferencedExerciseMedia(asDb(database()), [storage, storage])
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("exercise-media", ["dataset/a.mp4", "dataset/a.jpg"])
  })

  it("protects inactive fallback blocks and legacy URL references individually", async () => {
    const db = database([{ id: "B", metadata: { media: { animationUrl: "https://host/storage/v1/object/public/exercise-media/dataset/a.mp4" }, storage: { thumbnailPath: "dataset/a.jpg" } } }])
    await cleanupUnreferencedExerciseMedia(asDb(db), [storage])
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it("preserves an unchanged animation when only the thumbnail is replaced", async () => {
    const db = database([{ id: "A", metadata: { media: { animationPath: "dataset/a.mp4", thumbnailPath: "admin/new.jpg" } } }])
    await cleanupUnreferencedExerciseMedia(asDb(db), [storage])
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("exercise-media", ["dataset/a.jpg"])
  })

  it("keeps backups of still-undoable transfers on a live variation", async () => {
    const db = database([{ id: "B", metadata: {} }], [{ id: "transfer", entityId: "B", action: "exercise.metadata_transferred", createdAt: new Date(), metadata: { previousMetadata: storage } }])
    await cleanupUnreferencedExerciseMedia(asDb(db), [storage])
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it("does not retain backups superseded by another metadata write", async () => {
    const db = database([{ id: "B", metadata: {} }], [
      { id: "transfer", entityId: "B", action: "exercise.metadata_transferred", createdAt: new Date(1), metadata: { previousMetadata: storage } },
      { id: "edit", entityId: "B", action: "exercise.updated", createdAt: new Date(2), metadata: {} },
    ])
    await cleanupUnreferencedExerciseMedia(asDb(db), [storage])
    expect(mocks.remove).toHaveBeenCalledOnce()
  })

  it("retains files if the reference query fails, without failing a committed delete", async () => {
    const db = database()
    db.variation.findMany.mockRejectedValue(new Error("offline"))
    await expect(cleanupUnreferencedExerciseMedia(asDb(db), [storage])).resolves.toBeUndefined()
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.warn).toHaveBeenCalledOnce()
  })

  it("logs storage failure without failing a committed delete", async () => {
    mocks.remove.mockRejectedValue(new Error("storage offline"))
    await expect(cleanupUnreferencedExerciseMedia(asDb(database()), [storage])).resolves.toBeUndefined()
    expect(mocks.warn).toHaveBeenCalledOnce()
  })

  it("deletes only the configured cloud and correct resource type", async () => {
    const metadata = { cdn: { animationPublicId: "exercise/animation", animationResourceType: "video", thumbnailPublicId: "exercise/thumbnail" }, media: { animationPublicId: "foreign/file", animationCloudName: "other-cloud" } }
    await cleanupUnreferencedExerciseMedia(asDb(database()), [metadata])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenCalledWith("https://api.cloudinary.com/v1_1/our-cloud/video/destroy", expect.objectContaining({ method: "POST" }))
    expect(fetch).toHaveBeenCalledWith("https://api.cloudinary.com/v1_1/our-cloud/image/destroy", expect.objectContaining({ method: "POST" }))
  })

  it("keeps a Cloudinary asset referenced by a transformed URL on B", async () => {
    await cleanupUnreferencedExerciseMedia(asDb(database([{ id: "B", metadata: { media: { animationUrl: "https://res.cloudinary.com/our-cloud/video/upload/q_auto/v123/exercise/animation.mp4" } } }])), [{ cdn: { animationPublicId: "exercise/animation" } }])
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects foreign buckets, traversal paths and non-upload Cloudinary deliveries", () => {
    expect(exerciseMediaAssets({ media: { bucket: "avatars", animationPath: "person.mp4" }, storage: { animationPath: "../a.mp4" }, cdn: { deliveryType: "fetch", animationPublicId: "foreign" } })).toEqual([])
  })

  it("does not delete either slot when the custom block resolves to a foreign cloud", () => {
    expect(exerciseMediaAssets({ media: { animationCloudName: "foreign", animationPublicId: "a", thumbnailPublicId: "local-name-collision" } })).toEqual([])
  })

  it("snapshots full metadata explicitly before deleting rows", async () => {
    const db = database([{ id: "A", metadata: storage }])
    expect(await snapshotExerciseMedia(asDb(db), ["A"])).toEqual([storage])
    expect(db.variation.findMany).toHaveBeenCalledWith({ where: { id: { in: ["A"] } }, select: { metadata: true } })
  })

  it("includes backup-only assets when deleting the last variation able to restore them", async () => {
    const db = database([{ id: "B", metadata: {} }], [{ id: "transfer", entityId: "B", action: "exercise.metadata_transferred", createdAt: new Date(), metadata: { previousMetadata: storage } }])
    const snapshot = await snapshotExerciseMedia(asDb(db), ["B"])
    expect(snapshot).toEqual([{}, storage])
    db.variation.findMany.mockResolvedValue([])
    db.adminAuditLog.findMany.mockResolvedValue([])
    await cleanupUnreferencedExerciseMedia(asDb(db), snapshot)
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("exercise-media", ["dataset/a.mp4", "dataset/a.jpg"])
  })

  it("does not query or delete anything for exercises without managed media", async () => {
    const db = database()
    await cleanupUnreferencedExerciseMedia(asDb(db), [{ externalSource: { animationUrl: "https://external/video.mp4" } }])
    expect(db.variation.findMany).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it("serializes the initial transfer read/write before deletion and cleanup", async () => {
    let finishTransfer!: () => void
    const transferPending = new Promise<void>((resolve) => { finishTransfer = resolve })
    const events: string[] = []
    const transfer = serializeExerciseMediaMutation(async () => { events.push("read A"); await transferPending; events.push("write B") })
    const deletion = serializeExerciseMediaMutation(async () => { events.push("delete A"); events.push("check B") })
    const first = transfer()
    await Promise.resolve()
    const second = deletion()
    await Promise.resolve()
    expect(events).toEqual(["read A"])
    finishTransfer()
    await Promise.all([first, second])
    expect(events).toEqual(["read A", "write B", "delete A", "check B"])
  })

  it("releases serialization after a failed mutation", async () => {
    const fail = serializeExerciseMediaMutation(async () => { throw new Error("rejected") })
    const next = serializeExerciseMediaMutation(async () => "ok")
    await expect(fail()).rejects.toThrow("rejected")
    await expect(next()).resolves.toBe("ok")
  })
})
