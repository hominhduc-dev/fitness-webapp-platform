ALTER TABLE "Variation"
ADD COLUMN "source" TEXT,
ADD COLUMN "sourceId" TEXT;

ALTER TABLE "Variation"
ADD CONSTRAINT "Variation_source_sourceId_pair_check"
CHECK (("source" IS NULL) = ("sourceId" IS NULL));

CREATE UNIQUE INDEX "Variation_source_sourceId_key"
ON "Variation"("source", "sourceId");
