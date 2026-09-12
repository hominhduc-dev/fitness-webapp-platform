/**
 * Consolidate only high-confidence duplicate exercise names.
 *
 * Dry run: npx tsx src/scripts/dedupe-exercises.ts
 * Apply:   npx tsx src/scripts/dedupe-exercises.ts --apply
 */
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { prisma } from "../lib/prisma"

function normalize(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(?:the|a|an)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
}

function singularize(value: string) {
  return normalize(value).split(" ").map((token) => {
    if (token === "triceps") return "tricep"
    if (token === "biceps") return "bicep"
    return token.length > 4 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token
  }).join(" ")
}

function groupKey(exercise: { muscleGroup: string; name: string }, kind: "exact" | "morphology") {
  return `${normalize(exercise.muscleGroup)}::${kind === "exact" ? normalize(exercise.name) : singularize(exercise.name)}`
}

async function main() {
  if (!prisma) throw new Error("DATABASE_URL is not configured")
  const apply = process.argv.includes("--apply")
  const exercises = await prisma.exercise.findMany({
    include: {
      variations: {
        include: {
          muscleTargets: true,
          workoutExercises: { select: { id: true, originalVariationId: true, variationId: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  const parent = new Map(exercises.map((exercise) => [exercise.id, exercise.id]))
  const find = (id: string): string => {
    const current = parent.get(id)!
    if (current === id) return id
    const root = find(current)
    parent.set(id, root)
    return root
  }
  const union = (a: string, b: string) => {
    const left = find(a)
    const right = find(b)
    if (left !== right) parent.set(right, left)
  }

  for (const kind of ["exact", "morphology"] as const) {
    const seen = new Map<string, string>()
    for (const exercise of exercises) {
      const key = groupKey(exercise, kind)
      const first = seen.get(key)
      if (first) union(first, exercise.id)
      else seen.set(key, exercise.id)
    }
  }

  const grouped = new Map<string, typeof exercises>()
  for (const exercise of exercises) {
    const root = find(exercise.id)
    grouped.set(root, [...(grouped.get(root) ?? []), exercise])
  }
  const duplicateGroups = [...grouped.values()].filter((group) => group.length > 1)
  const plans = duplicateGroups.map((group) => {
    const ranked = group.slice().sort((a, b) => {
      const systemRank = Number(Boolean(a.createdById)) - Number(Boolean(b.createdById))
      if (systemRank !== 0) return systemRank
      const aUsage = a.variations.reduce((sum, variation) => sum + variation.workoutExercises.length, 0)
      const bUsage = b.variations.reduce((sum, variation) => sum + variation.workoutExercises.length, 0)
      return bUsage - aUsage
    })
    return { target: ranked[0], sources: ranked.slice(1) }
  })

  const backupPath = join(tmpdir(), `fitness-exercise-dedupe-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  await writeFile(backupPath, JSON.stringify({ createdAt: new Date(), plans }, null, 2), "utf8")
  console.log(JSON.stringify({
    apply,
    backupPath,
    duplicateGroups: plans.length,
    exerciseRows: exercises.length,
    rowsToRemove: plans.reduce((sum, plan) => sum + plan.sources.length, 0),
    variationRows: exercises.reduce((sum, exercise) => sum + exercise.variations.length, 0),
    workoutReferences: plans.reduce((sum, plan) => sum + plan.sources.reduce((sourceSum, source) =>
      sourceSum + source.variations.reduce((variationSum, variation) => variationSum + variation.workoutExercises.length, 0), 0), 0),
  }, null, 2))

  if (!apply) return

  for (const plan of plans) {
    await prisma.$transaction(async (tx) => {
      const targetVariations = await tx.variation.findMany({
        include: { muscleTargets: true },
        where: { exerciseId: plan.target.id },
      })

      for (const sourceExercise of plan.sources) {
        const sourceVariations = await tx.variation.findMany({
          include: { muscleTargets: true },
          where: { exerciseId: sourceExercise.id },
        })

        for (const sourceVariation of sourceVariations) {
          const targetVariation = targetVariations.find((candidate) =>
            normalize(candidate.name) === normalize(sourceVariation.name)
            || (sourceVariations.length === 1 && targetVariations.length === 1
              && normalize(candidate.equipment ?? "") === normalize(sourceVariation.equipment ?? "")),
          )

          if (!targetVariation) {
            await tx.variation.update({ data: { exerciseId: plan.target.id }, where: { id: sourceVariation.id } })
            targetVariations.push(sourceVariation)
            continue
          }

          if (sourceVariation.muscleTargets.length > 0) {
            await tx.variationMuscleTarget.createMany({
              data: sourceVariation.muscleTargets.map((target) => ({
                muscleSlug: target.muscleSlug,
                position: target.position,
                role: target.role,
                variationId: targetVariation.id,
              })),
              skipDuplicates: true,
            })
          }
          await tx.workoutExercise.updateMany({
            data: { variationId: targetVariation.id },
            where: { variationId: sourceVariation.id },
          })
          await tx.workoutExercise.updateMany({
            data: { originalVariationId: targetVariation.id },
            where: { originalVariationId: sourceVariation.id },
          })
          await tx.variation.delete({ where: { id: sourceVariation.id } })
        }
        await tx.exercise.delete({ where: { id: sourceExercise.id } })
      }
    }, { timeout: 60_000 })
  }

  console.log("Exercise deduplication completed.")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => prisma?.$disconnect())
