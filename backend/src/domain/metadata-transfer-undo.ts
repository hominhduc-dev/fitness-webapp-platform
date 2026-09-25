/**
 * Undoing a metadata transfer puts back the target's metadata from before the
 * transfer, which the transfer's audit entry keeps as `previousMetadata`.
 *
 * It is only safe while that transfer is still the newest thing that wrote the
 * variation's metadata: after a media upload, an edit or another transfer, the
 * snapshot would silently discard that later work. These are the audit actions
 * that write a variation's metadata.
 */
export const METADATA_WRITING_ACTIONS = [
  "exercise.metadata_transferred",
  "exercise.metadata_transfer_undone",
  "exercise.media_updated",
  "exercise.media_removed",
  "exercise.updated",
] as const

export const METADATA_TRANSFER_ACTION = "exercise.metadata_transferred"

export type MetadataAuditEntry = {
  action: string
  createdAt: Date
  entityId: string | null
  id: string
  metadata: unknown
}

/** A transfer made before snapshots were kept cannot be undone. */
export function hasPreviousMetadata(metadata: unknown): metadata is { previousMetadata: unknown } {
  return typeof metadata === "object" && metadata !== null && !Array.isArray(metadata) && "previousMetadata" in metadata
}

/**
 * For each variation, the transfer that can still be undone, if any: its
 * newest metadata-writing entry must be a transfer that kept a snapshot.
 */
export function undoableTransfers(entries: readonly MetadataAuditEntry[]): Map<string, string> {
  const newestByVariation = new Map<string, MetadataAuditEntry>()
  for (const entry of entries) {
    if (!entry.entityId) continue
    const current = newestByVariation.get(entry.entityId)
    if (!current || entry.createdAt > current.createdAt) newestByVariation.set(entry.entityId, entry)
  }

  const undoable = new Map<string, string>()
  for (const [variationId, entry] of newestByVariation) {
    if (entry.action === METADATA_TRANSFER_ACTION && hasPreviousMetadata(entry.metadata)) undoable.set(variationId, entry.id)
  }
  return undoable
}
