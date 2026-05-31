// Re-export shared implementation so existing import paths keep working.
export { buildWorkoutLogsFile as buildTraineeSelfExportFile, downloadWorkoutLogs as downloadTraineeSelfExport } from "@/components/workout-export-excel"
export type { WorkoutExportOptions as ExportOptions } from "@/components/workout-export-excel"
