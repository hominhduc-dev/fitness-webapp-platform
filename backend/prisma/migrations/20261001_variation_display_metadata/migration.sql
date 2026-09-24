-- The slice of Variation.metadata the app reads at runtime.
--
-- `metadata` holds the raw import record: ~8 KB a variation, 94% of it the
-- `exerciseDataset` payload nothing reads after import. Every library load
-- and workout query still pulled all of it from the database just to find
-- the Cloudinary media and the curated display name, and database egress is
-- billed.
--
-- A stored generated column keeps exactly those parts, in the same shape as
-- `metadata`, so the existing readers work on it unchanged. Postgres
-- recomputes it on every write to `metadata`, so admin media uploads, dataset
-- syncs and seeds need no changes and it can never drift.

-- Generated columns need an IMMUTABLE expression and jsonb_build_object is
-- only STABLE (it accepts "any"). On jsonb input it is deterministic, so the
-- wrapper is honestly immutable.
CREATE FUNCTION "variation_display_metadata"(metadata JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT jsonb_strip_nulls(
    jsonb_build_object(
      'media', metadata -> 'media',
      'cdn', metadata -> 'cdn',
      'externalSource', jsonb_build_object('displayName', metadata #> '{externalSource,displayName}')
    )
  )
$$;

-- A pure helper, but nothing outside the table definition needs to call it.
DO $$
BEGIN
  REVOKE ALL ON FUNCTION "variation_display_metadata"(JSONB) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION "variation_display_metadata"(JSONB) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION "variation_display_metadata"(JSONB) FROM authenticated;
  END IF;
END $$;

ALTER TABLE "Variation"
  ADD COLUMN "displayMetadata" JSONB GENERATED ALWAYS AS ("variation_display_metadata"("metadata")) STORED;
