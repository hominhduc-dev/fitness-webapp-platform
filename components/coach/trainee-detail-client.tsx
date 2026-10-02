"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  ChevronDown,
  ChevronRight,
  Cookie,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { TraineeAIInsightPanel } from "@/components/coach/trainee-ai-insight-panel"
import { TraineeOverview } from "@/components/coach/trainee-hub/trainee-overview"
import { TraineeMealPlanPanel } from "@/components/coach/trainee-meal-plan-panel"
import { TraineeWorkoutLogsPanel } from "@/components/coach/trainee-workout-logs-panel"
import { useCoachData } from "@/lib/queries/coach-data"
import { queryKeys } from "@/lib/queries/keys"
import { fetchCoachTraineeDetail, fetchCoachPrograms } from "@/lib/fitness/api"
import { useLocale } from "@/components/providers/locale-provider"
import { coachInsightMessages } from "@/lib/i18n/messages/coach-insight"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDateKey } from "@/lib/time-zone"
import { cn } from "@/lib/utils"
import {
  useAssignCoachProgram,
  useUnassignCoachProgram,
} from "@/lib/queries/coach"
import type { CoachProgram, CoachTraineeDetail } from "@/lib/fitness/types"
import type { MealType } from "@/lib/types"

/** Same meal order and icons as the trainee meals screen. */
const MEAL_SECTIONS: Array<{ icon: LucideIcon; type: MealType }> = [
  { icon: Sunrise, type: "breakfast" },
  { icon: Sun, type: "lunch" },
  { icon: Sunset, type: "dinner" },
  { icon: Cookie, type: "snack" },
]

type CoachTraineeDetailClientProps = {
  coachPrograms: CoachProgram[]
  initialDetail: CoachTraineeDetail
}

function formatNumber(value?: number, suffix = "") {
  return value != null ? `${value}${suffix}` : "--"
}

/** Overview day keys are UTC, like the backend week and the trainee's schedule. */
function parseDayKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

/* ─── Main export ────────────────────────────────────────────────────────── */
export function CoachTraineeDetailClient({
  coachPrograms: initialCoachPrograms,
  initialDetail,
}: CoachTraineeDetailClientProps) {
  const { data: coachPrograms = initialCoachPrograms } = useCoachData(queryKeys.coach.programs(), fetchCoachPrograms, initialCoachPrograms)
  const { locale, messages } = useLocale()
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"
  const integerFormatter = new Intl.NumberFormat(dateLocale, { maximumFractionDigits: 0 })
  const assignProgram = useAssignCoachProgram()
  const unassignProgram = useUnassignCoachProgram()
  const detailQuery = useCoachData(queryKeys.coach.traineeDetail(initialDetail.trainee.id), (token) => fetchCoachTraineeDetail(token, initialDetail.trainee.id), initialDetail, true, 30_000)
  const { data: detail = initialDetail, setData: setDetail } = detailQuery
  const [selectedProgramId, setSelectedProgramId] = useState("")
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignNotice, setAssignNotice] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const [removingProgramId, setRemovingProgramId] = useState<string | null>(null)
  const [expandedNutritionDate, setExpandedNutritionDate] = useState<string | null>(null)
  // Controlled, so the overview's "View all" can open the workout logs.
  const [tab, setTab] = useState("overview")

  const assignedProgramIds = new Set(detail.programs.map((program) => program.id))
  const assignablePrograms = coachPrograms.filter((program) => !assignedProgramIds.has(program.id))
  const dayKeyFormatter = new Intl.DateTimeFormat(dateLocale, { day: "numeric", month: "short", timeZone: "UTC" })
  const formatDayKey = (dateKey: string) => dayKeyFormatter.format(parseDayKey(dateKey))

  async function handleAssignProgram() {
    if (!selectedProgramId) {
      return
    }

    setIsAssigning(true)
    setAssignError(null)
    setAssignNotice(null)

    try {
      await assignProgram.mutateAsync({ programId: selectedProgramId, traineeId: detail.trainee.id })
      const assignedProgram = coachPrograms.find((program) => program.id === selectedProgramId)

      if (assignedProgram) {
        setDetail((current) => ({
          ...current,
          programs: [assignedProgram, ...current.programs],
        }))
      }

      setSelectedProgramId("")
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Could not assign program.")
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleUnassignProgram(programId: string) {

    setRemovingProgramId(programId)
    setAssignError(null)
    setAssignNotice(null)

    try {
      await unassignProgram.mutateAsync({ programId, traineeId: detail.trainee.id })
      setDetail((current) => ({
        ...current,
        programs: current.programs.filter((program) => program.id !== programId),
      }))
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Could not remove program.")
    } finally {
      setRemovingProgramId(null)
    }
  }

  const nutritionSummary = detail.nutritionSummary
  const expandedNutritionLog = nutritionSummary?.dailyLogs.find((row) => row.date === expandedNutritionDate) ?? null
  const bodyMetricsByDate = new Map<string, CoachTraineeDetail["bodyMetrics"][number]>()
  for (const entry of detail.bodyMetrics) {
    const dateKey = formatDateKey(entry.recordedAt)
    if (!bodyMetricsByDate.has(dateKey)) {
      bodyMetricsByDate.set(dateKey, entry)
    }
  }
  const mealTypeLabels: Record<MealType, string> = {
    breakfast: messages.meals.breakfast,
    dinner: messages.meals.dinner,
    lunch: messages.meals.lunch,
    snack: messages.meals.snack,
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <div className="sticky top-0 z-10 rounded-2xl border border-border/80 bg-card p-1.5 shadow-md shadow-foreground/5 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <TabsList
          data-tour="coach-client-tabs"
          className={cn(
            "flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-transparent p-0",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
        {[
          ["overview", messages.coach.tabOverview],
          ["nutrition", messages.coach.tabNutrition],
          ["logs", messages.coach.tabWorkoutLogs],
          ["ai", coachInsightMessages[locale].tab],
        ].map(([value, label]) => (
          <TabsTrigger
            key={value}
            value={value}
            className={cn(
              "flex-none rounded-xl border border-transparent bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-colors",
              "hover:text-foreground",
              "data-[state=active]:border-primary/25 data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/20",
            )}
          >
            {label}
          </TabsTrigger>
        ))}
        </TabsList>
      </div>

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <TabsContent value="overview" className="space-y-4">
        <TraineeOverview
          detail={detail}
          onNotesChange={(notes) => setDetail((current) => ({ ...current, notes }))}
          onViewLogs={() => setTab("logs")}
        />

        {/* Assigned programs */}
        <section id="assigned-programs" className="scroll-mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm" data-tour="coach-client-actions">
          <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-end @3xl:justify-between">
            <div>
              <h2 className="text-base font-semibold">{messages.coach.assignedProgramsTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.coach.assignedProgramsDesc}
              </p>
            </div>
            <div className="flex flex-col gap-2 @md:flex-row">
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="w-full @md:min-w-[240px] rounded-xl bg-background/70">
                  <SelectValue placeholder={messages.coach.selectProgramPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {assignablePrograms.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="rounded-xl"
                onClick={() => void handleAssignProgram()}
                disabled={!selectedProgramId || isAssigning}
              >
                {isAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {messages.coach.assignProgram}
              </Button>
            </div>
          </div>

          {assignError ? (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive-text">
              {assignError}
            </div>
          ) : null}
          {assignNotice ? (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-primary">
              {assignNotice}
            </div>
          ) : null}

          {detail.programs.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {messages.coach.noProgramsAssigned}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {detail.programs.map((program) => (
                <div
                  key={program.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 px-4 py-4 @xl:flex-row @xl:items-center @xl:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{program.name}</p>
                      {program.forkedFromProgramId ? (
                        <Badge variant="micro" className="border-primary/20 bg-primary-soft text-primary">
                          {locale === "en" ? "Personalized copy" : "Bản cá nhân hoá"}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {program.workoutsPerWeek} workouts/week · {program.duration} weeks · {program.difficulty}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/coach/programs/${program.id}?adjustTrainee=${detail.trainee.id}`} className="flex-1 sm:flex-none">
                      <Button className="w-full">
                        {messages.coach.adjustPlan}
                      </Button>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0 bg-transparent"
                          disabled={removingProgramId === program.id}
                        >
                          {removingProgramId === program.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/coach/programs/${program.id}`}>
                            <ExternalLink />
                            {messages.coach.openPlan}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => void handleUnassignProgram(program.id)}
                        >
                          <Trash2 />
                          {messages.coach.removeProgram}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </TabsContent>

      {/* ── Nutrition ─────────────────────────────────────────────────────── */}
      <TabsContent value="nutrition" className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
        <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.22fr)]">
          <div className="min-w-0 space-y-4">
            <TraineeMealPlanPanel traineeId={detail.trainee.id} />

            <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-md shadow-foreground/5 ring-1 ring-card/70">
              <h2 className="text-base font-semibold">{messages.coach.nutritionTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.coach.nutritionDesc}
              </p>

              {!nutritionSummary ? (
                <p className="mt-4 text-sm text-muted-foreground">{messages.coach.nutritionUnavailable}</p>
              ) : nutritionSummary.daysTracked === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">{messages.coach.noMealsLogged30Days}</p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[
                    {
                      label: messages.coach.avgCaloriesLabel,
                      value: `${nutritionSummary.avgCalories} kcal`,
                      sub: nutritionSummary.traineeCalorieGoal
                        ? messages.coach.calorieGoalLabel(nutritionSummary.traineeCalorieGoal)
                        : undefined,
                    },
                    { label: messages.coach.avgProteinLabel, value: `${nutritionSummary.avgProtein} g` },
                    { label: messages.coach.avgCarbsLabel, value: `${nutritionSummary.avgCarbs} g` },
                    { label: messages.coach.avgFatLabel, value: `${nutritionSummary.avgFat} g` },
                  ].map((card) => (
                    <div key={card.label} className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
                      <p className="label-micro text-muted-foreground">{card.label}</p>
                      <p className="mt-1 text-base font-semibold tnum">{card.value}</p>
                      {card.sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.sub}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="min-w-0 max-w-full rounded-2xl border border-border/80 bg-card p-4 shadow-md shadow-foreground/5 ring-1 ring-card/70">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{messages.coach.nutritionTitle} · 30 ngày</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {nutritionSummary ? messages.coach.daysTrackedLabel(nutritionSummary.daysTracked) : messages.coach.nutritionDesc}
                </p>
              </div>
            </div>

            {!nutritionSummary ? (
              <p className="mt-4 text-sm text-muted-foreground">{messages.coach.nutritionUnavailable}</p>
            ) : nutritionSummary.daysTracked === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{messages.coach.noMealsLogged30Days}</p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:hidden">
                {[
                  {
                    label: messages.coach.avgCaloriesLabel,
                    value: `${nutritionSummary.avgCalories} kcal`,
                    sub: nutritionSummary.traineeCalorieGoal
                      ? messages.coach.calorieGoalLabel(nutritionSummary.traineeCalorieGoal)
                      : undefined,
                  },
                  { label: messages.coach.avgProteinLabel, value: `${nutritionSummary.avgProtein} g` },
                  { label: messages.coach.avgCarbsLabel, value: `${nutritionSummary.avgCarbs} g` },
                  { label: messages.coach.avgFatLabel, value: `${nutritionSummary.avgFat} g` },
                ].map((card) => (
                  <div key={card.label} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <p className="label-micro text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-sm font-semibold tnum">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Daily log accordion — tap a day to expand meal-by-meal breakdown */}
              <div className="mt-4 flex min-w-0 max-w-full max-h-[520px] flex-col gap-2 overflow-x-hidden overflow-y-auto pr-1">
                {nutritionSummary.dailyLogs.map((row) => {
                  const goal = nutritionSummary.traineeCalorieGoal
                  const goalPct = goal > 0 ? Math.round((row.calories / goal) * 100) : null
                  const over = goal > 0 && row.calories > goal
                  const onTrack = goalPct != null && goalPct >= 90 && goalPct <= 110
                  const isOpen = expandedNutritionDate === row.date
                  const bodyMetric = bodyMetricsByDate.get(row.date)
                  return (
                    // shrink-0: in a height-capped flex column, overflow-hidden rows
                    // would otherwise be squashed to fit instead of the list scrolling.
                    <div
                      key={row.date}
                      className="shrink-0 overflow-hidden rounded-lg border border-border bg-card"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedNutritionDate(isOpen ? null : row.date)}
                        className="flex min-w-0 w-full max-w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 sm:gap-3"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        {/* dd/MM on one line: the list only spans the last 30 days. */}
                        <span
                          title={row.date}
                          className="shrink-0 whitespace-nowrap font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground"
                        >
                          {`${row.date.slice(8, 10)}/${row.date.slice(5, 7)}`}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate font-mono text-sm tabular-nums",
                            over ? "text-warning-text" : "text-foreground",
                          )}
                        >
                          {integerFormatter.format(row.calories)}{" "}
                          {goal > 0 && (
                            <span className="text-muted-foreground">
                              / {integerFormatter.format(goal)} kcal
                            </span>
                          )}
                        </span>
                        <span className="max-w-[5.5rem] shrink-0 truncate font-mono text-xs tabular-nums text-muted-foreground sm:max-w-none">
                          {bodyMetric?.weightKg != null ? `W ${formatNumber(bodyMetric.weightKg, " kg")}` : "W --"}
                          {bodyMetric?.bodyFatPct != null ? ` · BF ${formatNumber(bodyMetric.bodyFatPct, "%")}` : ""}
                        </span>
                        <span className="hidden font-mono text-xs tabular-nums text-muted-foreground md:inline">
                          P {Math.round(row.protein)}g
                        </span>
                        {goal > 0 && (
                          <Badge
                            variant="micro"
                            className={cn(
                              "shrink-0",
                              over
                                ? "border-warning/20 bg-warning-soft text-warning-text"
                                : onTrack
                                  ? "border-success/20 bg-success/10 text-success-text"
                                  : "border-border bg-muted text-muted-foreground",
                            )}
                          >
                            {over ? "Over" : messages.coach.statusOnTrack}
                          </Badge>
                        )}
                      </button>

                      {isOpen && (
                        <div className="border-t border-border">
                          {/* Day macro totals */}
                          <div className="grid grid-cols-3 gap-3 border-b border-border bg-muted/20 px-4 py-3">
                            {(
                              [
                                [messages.coach.proteinCol, row.protein],
                                [messages.coach.carbsCol, row.carbs],
                                [messages.coach.fatCol, row.fat],
                              ] as [string, number][]
                            ).map(([label, value]) => (
                              <div key={label}>
                                <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
                                  {label}
                                </p>
                                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
                                  {Math.round(value)}g
                                </p>
                              </div>
                            ))}
                          </div>

                          {/* Meal sections */}
                          {MEAL_SECTIONS.map(({ icon: Icon, type }) => {
                            const items = row.items.filter((item) => item.mealType === type)
                            if (items.length === 0) return null
                            const mealCalories = items.reduce((sum, item) => sum + item.calories, 0)
                            return (
                              <div key={type} className="border-t border-border/50 first:border-t-0">
                                <div className="flex items-center gap-2.5 bg-muted/10 px-4 py-2 pl-11">
                                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                                    {mealTypeLabels[type]}
                                  </span>
                                  <span className="font-mono text-micro tabular-nums text-muted-foreground">
                                    {Math.round(mealCalories)} kcal
                                  </span>
                                </div>
                                {items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-3 border-t border-border/40 px-4 py-2 pl-11"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm text-foreground">
                                        {item.name}
                                        {item.amountLabel ? (
                                          <span className="text-muted-foreground"> {item.amountLabel}</span>
                                        ) : null}
                                      </p>
                                      <p className="mt-0.5 font-mono text-micro tabular-nums text-muted-foreground">
                                        P{Math.round(item.protein ?? 0)} · C{Math.round(item.carbs ?? 0)} · F{Math.round(item.fat ?? 0)}
                                      </p>
                                    </div>
                                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                                      {Math.round(item.calories)} kcal
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              </>
            )}
          </section>
        </div>
      </TabsContent>

      {/* ── Workout logs ──────────────────────────────────────────────────── */}
      <TabsContent value="logs" className="space-y-6">
        <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-md shadow-foreground/5 ring-1 ring-card/70">
          <div>
            <h2 className="text-base font-semibold">{messages.coach.workoutLogHistoryTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {messages.coach.workoutLogHistoryDesc}
            </p>
          </div>

          <div className="mt-6">
            <TraineeWorkoutLogsPanel
              traineeId={detail.trainee.id}
              traineeName={detail.trainee.name}
              initialLogs={detail.recentLogs}
            />
          </div>
        </section>
      </TabsContent>
      {/* ── AI analysis ───────────────────────────────────────────────────── */}
      <TabsContent value="ai" className="space-y-4">
        <TraineeAIInsightPanel traineeId={detail.trainee.id} />
      </TabsContent>
      <Dialog open={Boolean(expandedNutritionLog)} onOpenChange={(open) => !open && setExpandedNutritionDate(null)}>
        <DialogContent className="max-h-[86dvh] max-w-[min(94vw,560px)] overflow-hidden p-0">
          {expandedNutritionLog ? (
            <>
              <DialogHeader className="border-b border-border px-4 py-4 text-left">
                <DialogTitle>{formatDayKey(expandedNutritionLog.date)}</DialogTitle>
                <DialogDescription>
                  {integerFormatter.format(expandedNutritionLog.calories)} kcal
                  {bodyMetricsByDate.get(expandedNutritionLog.date)?.weightKg != null
                    ? ` · ${formatNumber(bodyMetricsByDate.get(expandedNutritionLog.date)?.weightKg, " kg")}`
                    : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[calc(86dvh-92px)] overflow-y-auto px-4 py-4">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      [messages.coach.proteinCol, expandedNutritionLog.protein],
                      [messages.coach.carbsCol, expandedNutritionLog.carbs],
                      [messages.coach.fatCol, expandedNutritionLog.fat],
                    ] as [string, number][]
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border bg-muted/20 px-3 py-2">
                      <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{Math.round(value)}g</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {MEAL_SECTIONS.map(({ icon: Icon, type }) => {
                    const items = expandedNutritionLog.items.filter((item) => item.mealType === type)
                    if (items.length === 0) return null
                    const mealCalories = items.reduce((sum, item) => sum + item.calories, 0)
                    return (
                      <section key={type} className="overflow-hidden rounded-lg border border-border">
                        <div className="flex items-center gap-2.5 bg-muted/20 px-3 py-2">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{mealTypeLabels[type]}</span>
                          <span className="font-mono text-micro tabular-nums text-muted-foreground">{Math.round(mealCalories)} kcal</span>
                        </div>
                        {items.map((item) => (
                          <div key={item.id} className="flex items-start gap-3 border-t border-border/40 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground">
                                {item.name}
                                {item.amountLabel ? <span className="text-muted-foreground"> {item.amountLabel}</span> : null}
                              </p>
                              <p className="mt-0.5 font-mono text-micro tabular-nums text-muted-foreground">
                                P{Math.round(item.protein ?? 0)} · C{Math.round(item.carbs ?? 0)} · F{Math.round(item.fat ?? 0)}
                              </p>
                            </div>
                            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{Math.round(item.calories)} kcal</span>
                          </div>
                        ))}
                      </section>
                    )
                  })}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
