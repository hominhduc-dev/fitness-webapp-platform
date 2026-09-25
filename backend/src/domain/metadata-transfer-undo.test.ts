import { describe, expect, it } from "vitest"

import { hasPreviousMetadata, undoableTransfers, type MetadataAuditEntry } from "./metadata-transfer-undo"

const at = (minute: number) => new Date(Date.UTC(2026, 8, 25, 10, minute))
const entry = (overrides: Partial<MetadataAuditEntry> & Pick<MetadataAuditEntry, "id">): MetadataAuditEntry => ({
  action: "exercise.metadata_transferred",
  createdAt: at(0),
  entityId: "variation-a",
  metadata: { previousMetadata: { cdn: { source: "yeahbuddy" } } },
  ...overrides,
})

describe("undoableTransfers", () => {
  it("offers the newest transfer of a variation", () => {
    const result = undoableTransfers([entry({ id: "t1", createdAt: at(1) }), entry({ id: "t2", createdAt: at(5) })])

    expect(result.get("variation-a")).toBe("t2")
  })

  it("withdraws it once a later edit wrote the metadata", () => {
    const result = undoableTransfers([
      entry({ id: "t1", createdAt: at(1) }),
      entry({ id: "m1", action: "exercise.media_updated", createdAt: at(2), metadata: {} }),
    ])

    expect(result.has("variation-a")).toBe(false)
  })

  it("withdraws it after it has been undone", () => {
    const result = undoableTransfers([
      entry({ id: "t1", createdAt: at(1) }),
      entry({ id: "u1", action: "exercise.metadata_transfer_undone", createdAt: at(2), metadata: { transferId: "t1" } }),
    ])

    expect(result.has("variation-a")).toBe(false)
  })

  it("skips transfers made before snapshots were kept", () => {
    const result = undoableTransfers([entry({ id: "old", metadata: { sourceVariationId: "b" } })])

    expect(result.size).toBe(0)
  })

  it("keeps variations apart", () => {
    const result = undoableTransfers([
      entry({ id: "t1", entityId: "variation-a" }),
      entry({ id: "m1", action: "exercise.media_removed", entityId: "variation-b", metadata: {} }),
    ])

    expect([...result]).toEqual([["variation-a", "t1"]])
  })
})

describe("hasPreviousMetadata", () => {
  it("counts a null snapshot — the target had no metadata — as a snapshot", () => {
    expect(hasPreviousMetadata({ previousMetadata: null })).toBe(true)
    expect(hasPreviousMetadata({ sourceVariationId: "b" })).toBe(false)
    expect(hasPreviousMetadata(null)).toBe(false)
  })
})
