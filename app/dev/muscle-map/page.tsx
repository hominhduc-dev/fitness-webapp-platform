"use client"

import { useState } from "react"

import { MuscleMap, type MuscleSlug } from "@/components/body/muscle-map"
import { buildMuscleHighlights, muscleGroupToSlugs } from "@/lib/fitness/muscle-map"
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
