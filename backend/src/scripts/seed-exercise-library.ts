import { existsSync } from "node:fs"
import path from "node:path"

import { Prisma } from "@prisma/client"
import * as XLSX from "xlsx"

import { prisma } from "../lib/prisma"

type ParsedRow = {
  equipment?: string
  exerciseName: string
  isDefault: boolean
  metadata?: Record<string, unknown>
  muscleGroup: string
  sortOrder: number
  variationName: string
}

type RawSheetRow = Record<string, unknown>

const REQUIRED_COLUMNS = ["exercise_name", "muscle_group", "variation_name"] as const
const OPTIONAL_COLUMNS = new Set(["equipment", "is_default", "sort_order"])

function readArg(name: string) {
  const flag = `--${name}`
  const args = process.argv.slice(2)
  const withEquals = args.find((arg) => arg.startsWith(`${flag}=`))

  if (withEquals) {
    return withEquals.slice(flag.length + 1)
  }

  const index = args.indexOf(flag)
  if (index === -1) {
    return undefined
  }

  return args[index + 1]
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_")
}

function sanitizeText(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || undefined
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  return undefined
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    return value !== 0
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return ["1", "true", "yes", "y"].includes(normalized)
  }

  return false
}

function parseSortOrder(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value))
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed))
    }
  }

  return 0
}

function serializeMetadataValue(value: unknown): unknown {
  if (value == null || value === "") {
    return undefined
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || undefined
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  return String(value)
}

function parseRows(rows: RawSheetRow[]) {
  return rows.map((row, index) => {
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
    )

    const exerciseName = sanitizeText(normalized.exercise_name)
    const muscleGroup = sanitizeText(normalized.muscle_group)
    const variationName = sanitizeText(normalized.variation_name)

    if (!exerciseName || !muscleGroup || !variationName) {
      throw new Error(`Row ${index + 2} is missing one of: ${REQUIRED_COLUMNS.join(", ")}`)
    }

    const metadataEntries = Object.entries(normalized)
      .filter(([key]) => !REQUIRED_COLUMNS.includes(key as (typeof REQUIRED_COLUMNS)[number]) && !OPTIONAL_COLUMNS.has(key))
      .map(([key, value]) => [key, serializeMetadataValue(value)] as const)
      .filter((entry): entry is readonly [string, unknown] => entry[1] !== undefined)

    return {
      equipment: sanitizeText(normalized.equipment),
      exerciseName,
      isDefault: parseBoolean(normalized.is_default),
      metadata: metadataEntries.length > 0 ? Object.fromEntries(metadataEntries) : undefined,
      muscleGroup,
      sortOrder: parseSortOrder(normalized.sort_order),
      variationName,
    } satisfies ParsedRow
  })
}

function getBaseKey(exerciseName: string, muscleGroup: string) {
  return `${normalizeKey(exerciseName)}::${normalizeKey(muscleGroup)}`
}

function getVariationKey(exerciseId: string, variationName: string) {
  return `${exerciseId}::${normalizeKey(variationName)}`
}

async function main() {
  if (!prisma) {
    throw new Error("Database is not configured.")
  }

  const fileArg = readArg("file") ?? process.argv[2]
  if (!fileArg) {
    throw new Error("Missing input file. Use --file <path-to-excel>.")
  }

  const workbookPath = path.resolve(process.cwd(), fileArg)
  if (!existsSync(workbookPath)) {
    throw new Error(`File not found: ${workbookPath}`)
  }

  const workbook = XLSX.readFile(workbookPath, {
    cellDates: true,
  })
  const requestedSheet = readArg("sheet")
  const sheetName = requestedSheet && workbook.SheetNames.includes(requestedSheet) ? requestedSheet : workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error("Workbook does not contain any sheets.")
  }

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`)
  }

  const rawRows = XLSX.utils.sheet_to_json<RawSheetRow>(sheet, {
    defval: null,
  })
  const parsedRows = parseRows(rawRows)

  const existingExercises = await prisma.exercise.findMany({
    include: {
      variations: true,
    },
    orderBy: [{ muscleGroup: "asc" }, { name: "asc" }],
  })

  const exerciseByKey = new Map(existingExercises.map((exercise) => [getBaseKey(exercise.name, exercise.muscleGroup), exercise]))
  const variationByKey = new Map(
    existingExercises.flatMap((exercise) =>
      exercise.variations.map((variation) => [getVariationKey(exercise.id, variation.name), variation] as const),
    ),
  )

  let createdExercises = 0
  let createdVariations = 0
  let updatedExercises = 0
  let updatedVariations = 0

  for (const row of parsedRows) {
    const exerciseKey = getBaseKey(row.exerciseName, row.muscleGroup)
    let exercise = exerciseByKey.get(exerciseKey)

    if (!exercise) {
      exercise = await prisma.exercise.create({
        data: {
          muscleGroup: row.muscleGroup,
          name: row.exerciseName,
        },
        include: {
          variations: true,
        },
      })
      exerciseByKey.set(exerciseKey, exercise)
      createdExercises += 1
    } else if (exercise.name !== row.exerciseName || exercise.muscleGroup !== row.muscleGroup) {
      exercise = await prisma.exercise.update({
        data: {
          muscleGroup: row.muscleGroup,
          name: row.exerciseName,
        },
        include: {
          variations: true,
        },
        where: {
          id: exercise.id,
        },
      })
      exerciseByKey.set(exerciseKey, exercise)
      updatedExercises += 1
    }

    const variationKey = getVariationKey(exercise.id, row.variationName)
    const existingVariation = variationByKey.get(variationKey)

    if (!existingVariation) {
      const variation = await prisma.variation.create({
        data: {
          equipment: row.equipment,
          exerciseId: exercise.id,
          isDefault: row.isDefault,
          metadata: row.metadata as Prisma.InputJsonValue | undefined,
          name: row.variationName,
          sortOrder: row.sortOrder,
        },
      })
      variationByKey.set(variationKey, variation)
      createdVariations += 1

      if (row.isDefault) {
        await prisma.variation.updateMany({
          data: {
            isDefault: false,
          },
          where: {
            exerciseId: exercise.id,
            id: {
              not: variation.id,
            },
          },
        })
      }
      continue
    }

    await prisma.variation.update({
      data: {
        equipment: row.equipment,
        isDefault: row.isDefault,
        metadata: row.metadata as Prisma.InputJsonValue | undefined,
        name: row.variationName,
        sortOrder: row.sortOrder,
      },
      where: {
        id: existingVariation.id,
      },
    })
    updatedVariations += 1

    if (row.isDefault) {
      await prisma.variation.updateMany({
        data: {
          isDefault: false,
        },
        where: {
          exerciseId: exercise.id,
          id: {
            not: existingVariation.id,
          },
        },
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        createdExercises,
        createdVariations,
        sheetName,
        sourceFile: workbookPath,
        totalRows: parsedRows.length,
        updatedExercises,
        updatedVariations,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma?.$disconnect()
  })
