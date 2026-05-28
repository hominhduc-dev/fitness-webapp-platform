import Link from "next/link"
import { Suspense } from "react"
import { formatDistanceToNow } from "date-fns"
import { Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CreateWorkoutDialogLazy } from "@/components/workout/create-workout-dialog-lazy"
import { DeleteWorkoutButton } from "@/components/workout/delete-workout-button"
import { EditWorkoutButton } from "@/components/workout/edit-workout-button"
import { requireAppSession } from "@/lib/auth/server"
import { formatExerciseVariationLabel } from "@/lib/exercise-display"
import { fetchWorkouts } from "@/lib/fitness/api"
import type { Workout, WorkoutLog } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatRepTarget } from "@/lib/workout-reps"

// ---------------------------------------------------------------------------
// Kind config
// ---------------------------------------------------------------------------

const KIND_CONFIG: Record<string, { label: string; color: string }> = {
  push:      { label: "Push",      color: "var(--chart-1)" },
  pull:      { label: "Pull",      color: "var(--chart-3)" },
  legs:      { label: "Legs",      color: "var(--chart-4)" },
  full_body: { label: "Full body", color: "var(--chart-2)" },
  cardio:    { label: "Cardio",    color: "var(--chart-5, var(--chart-2))" },
  other:     { label: "Other",     color: "var(--muted-foreground)" },
}

function kindColor(kind?: string | null) {
  return kind ? (KIND_CONFIG[kind]?.color ?? "var(--border)") : "var(--border)"
}

function kindLabel(kind?: string | null) {
  return kind ? (KIND_CONFIG[kind]?.label ?? null) : null
}

// ---------------------------------------------------------------------------
// Quick-start card
// ---------------------------------------------------------------------------

function QuickStartCard({ workout }: { workout: Workout }) {
  const kLabel = kindLabel(workout.kind)
  const kColor = kindColor(workout.kind)

  return (
    <Link href={`/workout/${workout.id}/start`} className="group block">
      <div className="relative overflow-hidden rounded-[10px] border border-border bg-card transition-colors hover:border-primary/30">
        {/* Kind colour strip */}
        <div className="absolute inset-y-0 left-0 w-1 rounded-l-[10px]" style={{ background: kColor }} />

        <div className="flex items-center gap-4 px-6 py-5 pl-7">
          {/* Text */}
          <div className="min-w-0 flex-1">
            {kLabel && (
              <span className="label-micro mb-1 block" style={{ color: kColor }}>
                {kLabel}
              </span>
            )}
            <h2 className="truncate text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-foreground group-hover:text-primary">
              {workout.name}
            </h2>
            <p className="mt-1 font-mono text-[11px] tnum text-muted-foreground">
              {workout.exercises.length} exercises
              {workout.duration ? ` · ${workout.duration} min` : ""}
            </p>
          </div>

          {/* CTA */}
          <Button
            size="sm"
            className="shrink-0 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            tabIndex={-1}
          >
            <Play className="h-3.5 w-3.5" />
            Start
          </Button>
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Workout card
// ---------------------------------------------------------------------------

function WorkoutCard({ workout }: { workout: Workout }) {
  const kColor = kindColor(workout.kind)
  const kLabel = kindLabel(workout.kind)

  return (
    <div className="group flex flex-col rounded-[10px] border border-border bg-card transition-colors hover:border-primary/25">
      {/* Kind colour bar at top */}
      <div className="h-[3px] w-full rounded-t-[10px]" style={{ background: kColor }} />

      <div className="flex flex-1 flex-col p-5">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="line-clamp-1 text-base font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors">
              {workout.name}
            </h3>
            {kLabel && (
              <span
                className="label-micro shrink-0 rounded-sm px-1.5 py-0.5"
                style={{ color: kColor, background: `color-mix(in srgb, ${kColor} 10%, transparent)` }}
              >
                {kLabel}
              </span>
            )}
          </div>

          <p className="mt-1 font-mono text-[11px] tnum text-muted-foreground">
            {workout.exercises.length} exercises
            {workout.duration ? ` · ${workout.duration} min` : ""}
          </p>
        </div>

        {/* Exercise preview */}
        <div className="flex-1 space-y-2">
          {workout.exercises.slice(0, 3).map((ex) => (
            <div key={ex.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] text-foreground">
                {formatExerciseVariationLabel({
                  exerciseName: ex.exercise.name,
                  isDefault: ex.variation.isDefault,
                  variationName: ex.variation.name,
                })}
              </span>
              <span className="shrink-0 font-mono text-[12px] font-medium tnum text-muted-foreground">
                {ex.sets.length}×{formatRepTarget({
                  reps: ex.sets[0]?.targetReps,
                  repsMin: ex.sets[0]?.targetRepsMin,
                })}
              </span>
            </div>
          ))}
          {workout.exercises.length > 3 && (
            <p className="label-micro pt-1">
              +{workout.exercises.length - 3} more
            </p>
          )}
        </div>

        {/* Muscle group micro tags */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[...new Set(workout.exercises.map((ex) => ex.exercise.muscleGroup))].slice(0, 4).map((group) => (
            <span
              key={group}
              className="rounded-[4px] border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground"
            >
              {group}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <Link href={`/workout/${workout.id}/start`} className="flex-1">
          <Button
            size="sm"
            className="w-full gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Play className="h-3.5 w-3.5" />
            Start
          </Button>
        </Link>
        {workout.isPersonal && <EditWorkoutButton workout={workout} />}
        {workout.isPersonal && <DeleteWorkoutButton workoutId={workout.id} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function WorkoutSection({
  label,
  count,
  workouts,
  emptyMessage,
}: {
  label: string
  count: number
  workouts: Workout[]
  emptyMessage: string
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="label-micro">{label}</span>
        <span className="font-mono text-[11px] tnum text-muted-foreground">{count}</span>
      </div>

      {workouts.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// History section (inline, Lift-styled)
// ---------------------------------------------------------------------------

function HistoryRow({
  log,
  weightUnitLabel,
}: {
  log: WorkoutLog
  weightUnitLabel: string
}) {
  const kColor = kindColor(log.workout.kind)
  const startedAt = log.startedAt
  const completedAt = log.completedAt

  const durationMins =
    completedAt
      ? Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000))
      : null

  const ago = formatDistanceToNow(completedAt ?? startedAt, { addSuffix: true })

  const dayNum = startedAt.getDate()
  const monthShort = startedAt.toLocaleDateString("en-US", { month: "short" })

  return (
    <div className="flex items-center gap-3.5 rounded-[8px] border border-border bg-card px-4 py-3">
      {/* Date column */}
      <div className="w-8 shrink-0 text-center">
        <div className="label-micro leading-tight">{monthShort}</div>
        <div className="font-mono text-[17px] font-semibold leading-tight tnum text-foreground">
          {dayNum}
        </div>
      </div>

      {/* Kind bar */}
      <div className="h-8 w-0.5 shrink-0 rounded-sm" style={{ background: kColor }} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{log.workout.name}</p>
        <div className="mt-0.5 flex items-center gap-3 font-mono text-[11px] tnum text-muted-foreground">
          {durationMins && <span>{durationMins} min</span>}
          {log.totalVolume ? (
            <span>
              {log.totalVolume >= 1000
                ? `${(log.totalVolume / 1000).toFixed(1)}k`
                : Math.round(log.totalVolume)}{" "}
              {weightUnitLabel}
            </span>
          ) : null}
          <span className="ml-auto">{ago}</span>
        </div>
      </div>

      {/* Coach comments */}
      {log.comments.length > 0 && (
        <div className="shrink-0 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] text-primary">
          {log.comments.length} note{log.comments.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  )
}

function HistorySection({
  logs,
  weightUnitLabel,
}: {
  logs: WorkoutLog[]
  weightUnitLabel: string
}) {
  if (logs.length === 0) return null

  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="label-micro">Recent sessions</span>
        <span className="font-mono text-[11px] tnum text-muted-foreground">{logs.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {logs.map((log) => (
          <HistoryRow key={log.id} log={log} weightUnitLabel={weightUnitLabel} />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function WorkoutPageSkeleton() {
  return (
    <div className="space-y-10">
      {/* Quick start */}
      <Skeleton className="h-[72px] w-full rounded-[10px]" />

      {/* Section */}
      {[0, 1].map((i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-3 w-24 rounded" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-52 rounded-[10px]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main content (SSR)
// ---------------------------------------------------------------------------

async function WorkoutContent() {
  const { accessToken, profile } = await requireAppSession({ role: "trainee" })
  const workoutData = await fetchWorkouts(accessToken)
  const weightUnitLabel = profile.preferredWeightUnit === "lbs" ? "lbs" : "kg"

  const reusableWorkouts = workoutData.workouts.filter((w) => !w.scheduledDate)
  const personalWorkouts = reusableWorkouts.filter((w) => w.isPersonal)
  const coachWorkouts = reusableWorkouts.filter((w) => !w.isPersonal)

  const quickStart =
    workoutData.todayWorkout ?? reusableWorkouts[0] ?? workoutData.workouts[0] ?? null

  const totalCount = reusableWorkouts.length

  return (
    <>
      {/* ---- Header ---- */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <span className="label-micro mb-2 block">Your library</span>
          <h1 className="text-[2.25rem] font-semibold leading-none tracking-[-0.02em] text-foreground">
            {totalCount === 0
              ? "No workouts yet"
              : `${totalCount} ${totalCount === 1 ? "workout" : "workouts"}`}
          </h1>
        </div>
        <div className="mt-1 shrink-0">
          <CreateWorkoutDialogLazy workoutTemplates={reusableWorkouts} />
        </div>
      </div>

      <div className="space-y-10">
        {/* ---- Quick start ---- */}
        {quickStart && (
          <section>
            <span className="label-micro mb-3 block">Quick start</span>
            <QuickStartCard workout={quickStart} />
          </section>
        )}

        {/* ---- No workouts at all ---- */}
        {workoutData.workouts.length === 0 && (
          <div className="rounded-[10px] border border-dashed border-border px-8 py-14 text-center">
            <p className="text-base font-medium text-foreground">Start your first workout</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a personal workout or ask your coach to assign a program.
            </p>
            <div className="mt-5 flex justify-center">
              <CreateWorkoutDialogLazy workoutTemplates={[]} />
            </div>
          </div>
        )}

        {/* ---- Personal workouts ---- */}
        {(personalWorkouts.length > 0 || coachWorkouts.length > 0) && (
          <WorkoutSection
            label="My workouts"
            count={personalWorkouts.length}
            workouts={personalWorkouts}
            emptyMessage="You haven't created any personal workouts yet."
          />
        )}

        {/* ---- Coach workouts ---- */}
        {coachWorkouts.length > 0 && (
          <WorkoutSection
            label="From coach"
            count={coachWorkouts.length}
            workouts={coachWorkouts}
            emptyMessage="No workouts assigned by your coach yet."
          />
        )}

        {/* ---- History ---- */}
        <HistorySection
          logs={workoutData.historyLogs}
          weightUnitLabel={weightUnitLabel}
        />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkoutPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-10">
      <Suspense
        fallback={
          <>
            <div className="mb-8 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-9 w-40 rounded" />
              </div>
              <Skeleton className="mt-1 h-9 w-32 rounded-[8px]" />
            </div>
            <WorkoutPageSkeleton />
          </>
        }
      >
        <WorkoutContent />
      </Suspense>
    </div>
  )
}
