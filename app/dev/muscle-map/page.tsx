"use client"

import { useState } from "react"

import { MuscleMap, type MuscleSlug } from "@/components/body/muscle-map"
import { MuscleMapPair } from "@/components/body/muscle-map-pair"
import { TrainedAreasCard } from "@/components/progress/trained-areas-card"
import { startOfUtcWeek } from "@/lib/fitness/date-range"
import { buildMuscleHighlights, muscleGroupToSlugs } from "@/lib/fitness/muscle-map"
import type { WorkoutLog } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * Development preview for the body map. Deliberately outside the (shell) route
 * group so it renders without an authenticated session — nothing here reads
 * user data.
 */

// Mirrors the admin exercise picker (components/admin/admin-exercises-panel.tsx),
// which is the closest thing the repo has to a canonical muscle-group list.
const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes", "Calves", "Cardio", "Full Body"]

// Stand-ins for the tiers in the target design. Real thresholds are a later
// step; this exists so the palette can be judged against the artwork now.
const TIERS = [
  { color: "var(--chart-3)", label: "Gold" },
  { color: "var(--chart-4)", label: "Bronze" },
  { color: "var(--muted-foreground)", label: "Wood" },
]

/**
 * Fixtures for TrainedAreasCard. Dated relative to the real Monday-UTC week
 * boundary so the card's this-week / last-week split is genuinely exercised
 * rather than assumed.
 */
function makeLog(id: string, startedAt: Date, muscleGroups: string[]): WorkoutLog {
  return {
    comments: [],
    exercises: muscleGroups.map((muscleGroup, index) => ({
      exercise: { id: `${id}-e${index}`, muscleGroup, name: muscleGroup },
      id: `${id}-we${index}`,
      sets: [],
      variation: { id: `${id}-v${index}`, isDefault: true, name: "Default", sortOrder: 0 },
    })),
    id,
    startedAt,
    workout: { exercises: [], id: `${id}-w`, name: "Session" },
  }
}

const WEEK_START = startOfUtcWeek(new Date())
const DAY_MS = 24 * 60 * 60 * 1000

const MOCK_WEEK_LOGS = [makeLog("w1", new Date(WEEK_START.getTime() + DAY_MS), ["Chest", "Arms"])]
const MOCK_HISTORY_LOGS = [
  ...MOCK_WEEK_LOGS,
  makeLog("h1", new Date(WEEK_START.getTime() - 2 * DAY_MS), ["Legs", "Glutes"]),
  makeLog("h2", new Date(WEEK_START.getTime() - 6 * DAY_MS), ["Back"]),
  // Older than last week — must not appear under either toggle.
  makeLog("h3", new Date(WEEK_START.getTime() - 20 * DAY_MS), ["Shoulders"]),
]

export default function MuscleMapPreviewPage() {
  const [selected, setSelected] = useState<string[]>(["Chest", "Arms"])
  const [clicked, setClicked] = useState<MuscleSlug | null>(null)

  const highlights = buildMuscleHighlights(selected, "var(--chart-1)")
  const resolved = selected.flatMap((group) => muscleGroupToSlugs(group))

  function toggleGroup(group: string) {
    setSelected((current) =>
      current.includes(group) ? current.filter((entry) => entry !== group) : [...current, group],
    )
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Muscle map preview</h1>
        <p className="text-sm text-muted-foreground">
          Body artwork ported from react-native-body-highlighter (MIT). Toggle a muscle group to see how{" "}
          <code className="font-mono text-xs">muscleGroupToSlugs</code> resolves it.
        </p>
      </header>

      <section className="flex flex-wrap gap-2">
        {MUSCLE_GROUPS.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => toggleGroup(group)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              selected.includes(group)
                ? "border-primary/40 bg-primary-soft text-primary"
                : "border-border text-muted-foreground hover:border-primary/25",
            )}
          >
            {group}
          </button>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-6 rounded-[10px] border border-border bg-card p-6">
        <div className="space-y-2">
          <p className="label-micro text-center">Front</p>
          <MuscleMap side="front" highlights={highlights} onMuscleClick={setClicked} label="Front body map" />
        </div>
        <div className="space-y-2">
          <p className="label-micro text-center">Back</p>
          <MuscleMap side="back" highlights={highlights} onMuscleClick={setClicked} label="Back body map" />
        </div>
      </section>

      <section className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          Resolved slugs:{" "}
          <span className="font-mono text-xs text-foreground">
            {resolved.length > 0 ? [...new Set(resolved)].sort().join(", ") : "(none)"}
          </span>
        </p>
        <p className="text-muted-foreground">
          Last clicked: <span className="font-mono text-xs text-foreground">{clicked ?? "(none)"}</span>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Thumbnail (size=&quot;sm&quot;)</h2>
        <p className="text-sm text-muted-foreground">
          The scale used in routine cards and the builder dialog header, beside a title block.
        </p>
        <div className="flex max-w-[420px] items-start justify-between gap-3 rounded-[10px] border border-border bg-card p-5">
          <div className="min-w-0">
            <p className="label-micro mb-1">Push</p>
            <h3 className="text-[17px] font-semibold leading-tight text-foreground">Upper body A</h3>
            <p className="mt-1 font-mono text-xs text-muted-foreground">5 exercises · 18 sets</p>
          </div>
          <MuscleMapPair
            size="sm"
            highlights={buildMuscleHighlights(["Chest", "Shoulders", "Arms"], "var(--primary)")}
            label="Muscles targeted"
            className="mt-0.5"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Trained areas card</h2>
        <p className="text-sm text-muted-foreground">
          Rendered at the 360px column width it occupies on <code className="font-mono text-xs">/progress</code>.
          Fixtures: this week = Chest + Arms, last week = Legs + Glutes + Back.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="max-w-[360px]">
            <TrainedAreasCard weekLogs={MOCK_WEEK_LOGS} historyLogs={MOCK_HISTORY_LOGS} />
          </div>
          <div className="max-w-[360px]">
            <TrainedAreasCard weekLogs={[]} historyLogs={[]} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Tier palette</h2>
        <div className="flex gap-6">
          {TIERS.map((tier) => (
            <div key={tier.label} className="w-20 space-y-2">
              <MuscleMap
                side="front"
                highlights={{ chest: tier.color, deltoids: tier.color }}
                label={`${tier.label} tier sample`}
              />
              <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tier.color }} />
                {tier.label}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
