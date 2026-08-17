// Shared shape for the generated path data in this directory.
// Upstream splits each muscle into up to three groups: `common` for parts drawn
// once (abs, neck), `left`/`right` for the mirrored pairs. We render all three
// with the same fill, but the split is kept so a future per-side feature — the
// left/right imbalance view — does not need the assets regenerated.

export type BodyPart<Slug extends string = string> = {
  path: {
    common?: readonly string[]
    left?: readonly string[]
    right?: readonly string[]
  }
  slug: Slug
}
