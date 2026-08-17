import { MuscleProfileSource, MuscleProfileStatus, MuscleTargetRole } from "@prisma/client"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { buildMuscleTargetRows } from "../domain/muscle-profile"
import { parseMuscleClassification, shouldAutoApprove } from "../domain/muscle-profile-classifier"
import { prisma } from "../lib/prisma"

function readArg(name: string) {
  const flag = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(flag))?.slice(flag.length)
}

async function main() {
  if (!prisma) throw new Error("DATABASE_URL is required.")
  if (!process.argv.includes("--apply")) throw new Error("Pass --apply explicitly after reviewing the dry-run report and taking a backup.")
  const reportPath = path.resolve(process.cwd(), readArg("report") ?? "../outputs/muscle-profile-dry-run.json")
  const report = JSON.parse(await readFile(reportPath, "utf8")) as { results?: unknown[] }
  const parsed = (report.results ?? []).map(parseMuscleClassification)
  const byId = new Map(parsed.map((classification) => [classification.variationId, classification]))
  if (byId.size !== parsed.length) throw new Error("Report contains duplicate variationId values.")

  const [existing, totalVariations] = await Promise.all([
    prisma.variation.findMany({
      select: { id: true, muscleProfileSource: true },
      where: { id: { in: [...byId.keys()] } },
    }),
    prisma.variation.count(),
  ])
  if (existing.length !== totalVariations && !process.argv.includes("--allow-partial")) {
    throw new Error(`Refusing partial apply: report covers ${existing.length}/${totalVariations} variations. Finish the dry-run first.`)
  }
  const force = process.argv.includes("--force")
  const classifications = existing
    .filter((variation) => force || variation.muscleProfileSource === null)
    .flatMap((variation) => byId.get(variation.id) ?? [])

  for (let offset = 0; offset < classifications.length; offset += 50) {
    const batch = classifications.slice(offset, offset + 50)
    await prisma.$transaction(batch.map((classification) => {
      const approved = shouldAutoApprove(classification)
      return prisma!.variation.update({
        data: {
          activityType: classification.activityType,
          muscleProfileConfidence: classification.confidence,
          muscleProfileRationale: classification.rationale,
          muscleProfileReviewedAt: approved ? new Date() : null,
          muscleProfileSource: MuscleProfileSource.ai,
          muscleProfileStatus: approved ? MuscleProfileStatus.approved : MuscleProfileStatus.pending,
          muscleTargets: {
            create: buildMuscleTargetRows(classification).map((target) => ({
              ...target,
              role: target.role === "primary" ? MuscleTargetRole.primary : MuscleTargetRole.secondary,
            })),
            deleteMany: {},
          },
        },
        where: { id: classification.variationId },
      })
    }))
  }

  const approvedCount = classifications.filter(shouldAutoApprove).length
  process.stdout.write(`${JSON.stringify({
    applied: classifications.length,
    approved: approvedCount,
    pending: classifications.length - approvedCount,
    reportPath,
    skippedExisting: parsed.length - classifications.length,
    unresolvedReportFailures: totalVariations - existing.length,
  })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
}).finally(async () => prisma?.$disconnect())
