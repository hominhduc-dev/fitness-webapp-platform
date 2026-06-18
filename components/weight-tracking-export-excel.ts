import type { Workbook, Worksheet } from "exceljs"

import type { BodyMetricEntry } from "@/lib/fitness/types"

type WeightTrackingSheetOptions = {
  from: string
  sheetName?: string
  subjectName?: string
  to: string
}

const WEIGHT_TRACKING_SHEET_NAME = "Weight Tracking"

function formatDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function roundMetric(value?: number | null, fractionDigits = 1) {
  if (value == null || !Number.isFinite(value)) return null
  return Number(value.toFixed(fractionDigits))
}

function getWeightEntries(bodyMetrics: BodyMetricEntry[]) {
  return bodyMetrics
    .filter((entry) => typeof entry.weightKg === "number" && Number.isFinite(entry.weightKg))
    .slice()
    .sort((left, right) => {
      const dateDiff = left.recordedAt.getTime() - right.recordedAt.getTime()
      return dateDiff || left.createdAt.getTime() - right.createdAt.getTime()
    })
}

function uniqueSheetName(workbook: Workbook, preferredName: string) {
  if (!workbook.getWorksheet(preferredName)) return preferredName

  for (let index = 2; index <= 99; index++) {
    const suffix = ` ${index}`
    const candidate = `${preferredName.slice(0, 31 - suffix.length)}${suffix}`
    if (!workbook.getWorksheet(candidate)) return candidate
  }

  return preferredName.slice(0, 31)
}

function styleSummaryCell(worksheet: Worksheet, address: string, value: string | number | null) {
  const cell = worksheet.getCell(address)
  cell.value = value
  cell.font = { bold: true, size: 11 }
  cell.alignment = { horizontal: "center", vertical: "middle" }
  cell.fill = { fgColor: { argb: "FFEAF4EF" }, pattern: "solid", type: "pattern" }
  cell.border = {
    bottom: { color: { argb: "FFB7D8C8" }, style: "thin" },
    left: { color: { argb: "FFB7D8C8" }, style: "thin" },
    right: { color: { argb: "FFB7D8C8" }, style: "thin" },
    top: { color: { argb: "FFB7D8C8" }, style: "thin" },
  }
}

export function addWeightTrackingSheet(
  workbook: Workbook,
  bodyMetrics: BodyMetricEntry[],
  options: WeightTrackingSheetOptions,
) {
  const worksheet = workbook.addWorksheet(uniqueSheetName(workbook, options.sheetName ?? WEIGHT_TRACKING_SHEET_NAME), {
    properties: { tabColor: { argb: "FF2F855A" } },
  })
  const entries = getWeightEntries(bodyMetrics)
  const firstEntry = entries[0]
  const latestEntry = entries[entries.length - 1]
  const startWeight = roundMetric(firstEntry?.weightKg)
  const latestWeight = roundMetric(latestEntry?.weightKg)
  const totalChange =
    startWeight != null && latestWeight != null && entries.length > 1
      ? roundMetric(latestWeight - startWeight)
      : null
  const averageWeight =
    entries.length > 0
      ? roundMetric(entries.reduce((sum, entry) => sum + (entry.weightKg ?? 0), 0) / entries.length)
      : null

  worksheet.views = [{ state: "frozen", ySplit: 7 }]
  worksheet.mergeCells("A1:J1")
  worksheet.getCell("A1").value = "Weight Tracking"
  worksheet.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 }
  worksheet.getCell("A1").fill = { fgColor: { argb: "FF1F5135" }, pattern: "solid", type: "pattern" }
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }
  worksheet.getRow(1).height = 26

  worksheet.mergeCells("A2:J2")
  worksheet.getCell("A2").value = `Period: ${options.from} to ${options.to} (exclusive)`
  worksheet.getCell("A2").font = { color: { argb: "FF4A5568" }, size: 10 }
  worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" }

  if (options.subjectName) {
    worksheet.mergeCells("A3:J3")
    worksheet.getCell("A3").value = `Client: ${options.subjectName}`
    worksheet.getCell("A3").font = { italic: true, color: { argb: "FF4A5568" }, size: 10 }
    worksheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" }
  }

  const summaryLabels = ["Entries", "Start Weight", "Latest Weight", "Change", "Average Weight"]
  const summaryValues = [
    entries.length,
    startWeight,
    latestWeight,
    totalChange,
    averageWeight,
  ]

  summaryLabels.forEach((label, index) => {
    const column = index * 2 + 1
    worksheet.getCell(5, column).value = label
    worksheet.getCell(5, column).font = { bold: true, color: { argb: "FF1F2937" }, size: 10 }
    worksheet.getCell(5, column).alignment = { horizontal: "center", vertical: "middle" }
    styleSummaryCell(worksheet, worksheet.getCell(6, column).address, summaryValues[index] ?? "")
    worksheet.mergeCells(5, column, 5, column + 1)
    worksheet.mergeCells(6, column, 6, column + 1)
  })

  const headerRow = worksheet.getRow(8)
  headerRow.values = [
    "Date",
    "Weight (kg)",
    "Change (kg)",
    "Body Fat (%)",
    "Waist (cm)",
    "Chest (cm)",
    "Hips (cm)",
    "Recorded By",
    "Recorded At",
    "Note",
  ]
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 }
    cell.fill = { fgColor: { argb: "FF1A1A1A" }, pattern: "solid", type: "pattern" }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.border = {
      bottom: { color: { argb: "FFCBD5E1" }, style: "thin" },
      left: { color: { argb: "FFCBD5E1" }, style: "thin" },
      right: { color: { argb: "FFCBD5E1" }, style: "thin" },
      top: { color: { argb: "FFCBD5E1" }, style: "thin" },
    }
  })

  if (entries.length === 0) {
    worksheet.mergeCells("A9:J9")
    worksheet.getCell("A9").value = "No weight entries in this export range."
    worksheet.getCell("A9").font = { italic: true, color: { argb: "FF64748B" }, size: 10 }
    worksheet.getCell("A9").alignment = { horizontal: "center", vertical: "middle" }
  } else {
    entries.forEach((entry, index) => {
      const rowNumber = 9 + index
      const previous = index > 0 ? entries[index - 1] : undefined
      const change =
        previous?.weightKg != null && entry.weightKg != null
          ? roundMetric(entry.weightKg - previous.weightKg)
          : null
      const row = worksheet.getRow(rowNumber)
      row.values = [
        formatDateOnly(entry.recordedAt),
        roundMetric(entry.weightKg),
        change,
        roundMetric(entry.bodyFatPct),
        roundMetric(entry.waistCm),
        roundMetric(entry.chestCm),
        roundMetric(entry.hipsCm),
        entry.coachName ?? "Trainee",
        formatDateTime(entry.recordedAt),
        entry.note ?? "",
      ]
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        cell.font = { size: 10 }
        cell.alignment = { vertical: "middle", wrapText: columnNumber === 10 }
        cell.border = {
          bottom: { color: { argb: "FFE2E8F0" }, style: "thin" },
          left: { color: { argb: "FFE2E8F0" }, style: "thin" },
          right: { color: { argb: "FFE2E8F0" }, style: "thin" },
          top: { color: { argb: "FFE2E8F0" }, style: "thin" },
        }
      })

      if (index % 2 === 1) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.fill = { fgColor: { argb: "FFF8FAFC" }, pattern: "solid", type: "pattern" }
        })
      }
    })
  }

  ;[14, 14, 14, 14, 13, 13, 13, 20, 20, 36].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width
  })
  ;[2, 3, 4, 5, 6, 7].forEach((column) => {
    worksheet.getColumn(column).numFmt = "0.0"
  })
  worksheet.autoFilter = {
    from: "A8",
    to: "J8",
  }
}
