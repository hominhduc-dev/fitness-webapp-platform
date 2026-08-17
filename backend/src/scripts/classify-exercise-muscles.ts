import { MuscleProfileSource, MuscleProfileStatus, MuscleTargetRole } from "@prisma/client"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import { buildMuscleTargetRows } from "../domain/muscle-profile"
import { classifyBatchWithRetry, isRateLimitError, shouldAutoApprove } from "../domain/muscle-profile-classifier"
import { getAIProvider } from "../lib/ai/ai-client"
import { prisma } from "../lib/prisma"

function readArg(name: string) {
  const args = process.argv.slice(2)
  const exact = args.indexOf(`--${name}`)
  const inline = args.find((arg) => arg.startsWith(`--${name}=`))
  return inline?.slice(name.length + 3) ?? (exact >= 0 ? args[exact + 1] : undefined)
}

function hasFlag(name: string) {
  return process.argv.slice(2).includes(`--${name}`)
}

type ReportRow = Record<string, unknown> & { variationId: string }

function countBy(values: readonly string[]) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((entry) => entry === value).length]))
}

async function readReport(reportPath: string) {
  try {
    const parsed = JSON.parse(await readFile(reportPath, "utf8")) as { failures?: ReportRow[]; results?: ReportRow[] }
    return { failures: parsed.failures ?? [], results: parsed.results ?? [] }
  } catch {
    return { failures: [] as ReportRow[], results: [] as ReportRow[] }
  }
}

async function writeReport(reportPath: string, report: { failures: ReportRow[]; results: ReportRow[] }) {
  const activities = report.results.map((row) => String(row.activityType))
  const primaryMuscles = report.results.flatMap((row) => Array.isArray(row.primaryMuscles) ? row.primaryMuscles.map(String) : [])
  const secondaryMuscles = report.results.flatMap((row) => Array.isArray(row.secondaryMuscles) ? row.secondaryMuscles.map(String) : [])
  const approved = report.results.filter((row) => row.autoApproved === true).length
  const payload = {
    ...report,
    generatedAt: new Date().toISOString(),
    summary: {
      activities: countBy(activities),
      approved,
      failed: report.failures.length,
      pending: report.results.length - approved + report.failures.length,
      primaryMuscles: countBy(primaryMuscles),
      processed: report.results.length + report.failures.length,
      secondaryMuscles: countBy(secondaryMuscles),
    },
  }
  await mkdir(path.dirname(reportPath), { recursive: true })
  const temporaryPath = `${reportPath}.tmp`
  await writeFile(temporaryPath, JSON.stringify(payload, null, 2), "utf8")
  await rename(temporaryPath, reportPath)
}

async function main() {
  if (!prisma) throw new Error("DATABASE_URL is required.")
  const apply = hasFlag("apply")
  if (apply === hasFlag("dry-run")) throw new Error("Choose exactly one of --dry-run or --apply.")

  const batchSize = Math.min(25, Math.max(1, Number(readArg("batch-size") ?? 25)))
  const limit = Math.max(1, Number(readArg("limit") ?? Number.MAX_SAFE_INTEGER))
  const delayMs = Math.max(0, Number(readArg("delay-ms") ?? 2_000))
  const resumeAfter = readArg("resume-after")
  const reportPath = path.resolve(process.cwd(), readArg("report") ?? `../outputs/muscle-profile-${apply ? "apply" : "dry-run"}.json`)
  const report = await readReport(reportPath)
  const completedIds = new Set((apply ? [] : report.results).map((row) => row.variationId))
  const rows = (await prisma.variation.findMany({
    include: { exercise: { select: { muscleGroup: true, name: true } } },
    orderBy: { id: "asc" },
    take: limit,
    where: {
      muscleProfileSource: null,
      ...(resumeAfter ? { id: { gt: resumeAfter } } : {}),
    },
  })).filter((row) => !completedIds.has(row.id))

  const provider = getAIProvider()
  const summary = { approved: 0, failed: 0, pending: 0, processed: 0, tokenUsage: 0 }

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize)
    const input = batch.map((variation) => ({
      equipment: variation.equipment,
      exerciseName: variation.exercise.name,
      legacyMuscleGroup: variation.exercise.muscleGroup,
      variationId: variation.id,
      variationName: variation.name,
    }))

    try {
      const result = await classifyBatchWithRetry(provider, input)
      summary.tokenUsage += result.tokenUsage
      const approved = result.classifications.filter(shouldAutoApprove).length
      summary.approved += approved
      summary.pending += result.classifications.length - approved + result.failedVariationIds.length
      summary.failed += result.failedVariationIds.length
      summary.processed += batch.length

      const resultById = new Map(result.classifications.map((classification) => [classification.variationId, classification]))
      for (const variation of batch) {
        const classification = resultById.get(variation.id)
        if (!classification) continue
        report.failures = report.failures.filter((failure) => failure.variationId !== variation.id)
        report.results = report.results.filter((row) => row.variationId !== variation.id)
        report.results.push({
          ...classification,
          autoApproved: shouldAutoApprove(classification),
          equipment: variation.equipment,
          exerciseName: variation.exercise.name,
          legacyMuscleGroup: variation.exercise.muscleGroup,
          variationName: variation.name,
        })
      }
      for (const variationId of result.failedVariationIds) {
        const variation = batch.find((row) => row.id === variationId)
        report.failures = report.failures.filter((failure) => failure.variationId !== variationId)
        report.failures.push({
          variationId,
          equipment: variation?.equipment,
          exerciseName: variation?.exercise.name,
          legacyMuscleGroup: variation?.exercise.muscleGroup,
          variationName: variation?.name,
        })
      }
      await writeReport(reportPath, report)

      if (apply) {
        await prisma.$transaction(
          result.classifications.map((classification) => {
            const isApproved = shouldAutoApprove(classification)
            return prisma!.variation.update({
              data: {
                activityType: classification.activityType,
                muscleProfileConfidence: classification.confidence,
                muscleProfileRationale: classification.rationale,
                muscleProfileReviewedAt: isApproved ? new Date() : null,
                muscleProfileSource: MuscleProfileSource.ai,
                muscleProfileStatus: isApproved ? MuscleProfileStatus.approved : MuscleProfileStatus.pending,
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
          }),
        )
      }

      const lastId = batch.at(-1)?.id
      process.stdout.write(`${JSON.stringify({ ...summary, batch: offset / batchSize + 1, failedVariationIds: result.failedVariationIds, lastId, mode: apply ? "apply" : "dry-run" })}\n`)
    } catch (error) {
      summary.failed += batch.length
      for (const variation of batch) {
        report.failures = report.failures.filter((failure) => failure.variationId !== variation.id)
        report.failures.push({
          error: error instanceof Error ? error.message : String(error),
          variationId: variation.id,
          equipment: variation.equipment,
          exerciseName: variation.exercise.name,
          legacyMuscleGroup: variation.exercise.muscleGroup,
          variationName: variation.name,
        })
      }
      await writeReport(reportPath, report)
      process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error), failedIds: batch.map((row) => row.id) })}\n`)
      if (isRateLimitError(error)) {
        throw new Error(`AI provider rate limit persisted after retries. Checkpoint saved at ${reportPath}.`, { cause: error })
      }
    }
    if (delayMs > 0 && offset + batchSize < rows.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  process.stdout.write(`${JSON.stringify({ final: true, ...summary, catalogRows: rows.length, reportPath })}\n`)
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
  .finally(async () => prisma?.$disconnect())
