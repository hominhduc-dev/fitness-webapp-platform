"use client"

import { CheckCircle2, Dumbbell, Info, ShieldAlert, TriangleAlert } from "lucide-react"

import { MuscleMapPair } from "@/components/body/muscle-map-pair"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { useTheme } from "@/components/providers/theme-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

const swatches = [
  ["Canvas", "--background"],
  ["Surface", "--surface"],
  ["Card", "--card"],
  ["Primary", "--primary"],
  ["Primary soft", "--primary-soft"],
  ["Success", "--success"],
  ["Warning", "--warning"],
  ["Info", "--info"],
  ["Danger", "--destructive"],
] as const

const statuses = [
  { icon: CheckCircle2, label: "Success", surface: "bg-success-soft", text: "text-success-text" },
  { icon: TriangleAlert, label: "Warning", surface: "bg-warning-soft", text: "text-warning-text" },
  { icon: Info, label: "Information", surface: "bg-info-soft", text: "text-info-text" },
  { icon: ShieldAlert, label: "Danger", surface: "bg-destructive-soft", text: "text-destructive-text" },
] as const

export default function DesignSystemPage() {
  const { resolvedTheme } = useTheme()

  return (
    <main className="min-h-dvh px-4 py-8 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="glass-card flex flex-col gap-5 border p-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-micro mb-2 text-primary">YeahBuddy / Kinetic Glass v2</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Design System Lab</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Nguồn kiểm tra trực quan cho semantic colors, component states và muscle map. Theme hiện tại: {resolvedTheme}.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <section className="glass-card border p-6">
          <p className="label-micro mb-4">Color roles</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {swatches.map(([label, token]) => (
              <div key={token} className="overflow-hidden rounded-xl border bg-card">
                <div className="h-20 border-b" style={{ background: `var(${token})` }} />
                <div className="p-3">
                  <p className="text-sm font-medium">{label}</p>
                  <code className="mt-1 block text-[11px] text-muted-foreground">{token}</code>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="glass-card border p-6">
            <p className="label-micro mb-4">Status contract / text on soft</p>
            <div className="space-y-3">
              {statuses.map(({ icon: Icon, label, surface, text }) => (
                <div key={label} className={`flex items-center gap-3 rounded-xl border p-4 ${surface} ${text}`}>
                  <Icon className="size-5" />
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs opacity-80">WCAG AA body-text pair</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-card border p-6">
            <p className="label-micro mb-4">Component states</p>
            <div className="flex flex-wrap gap-2">
              <Button>Primary action</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Danger</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <Input aria-label="Example input" placeholder="Semantic input + focus ring" />
              <label className="flex items-center gap-2 text-sm">
                <Switch defaultChecked /> Enabled
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge>Primary</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Danger</Badge>
              <Badge variant="micro">Set 03</Badge>
            </div>
          </section>
        </div>

        <section className="glass-card grid gap-6 border p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="label-micro mb-2 text-primary">Workout visualization</p>
            <h2 className="text-xl font-semibold">Push day / muscle state</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Anatomical SVG keeps fixed artwork geometry, while highlights inherit the semantic primary role.
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-xl border bg-primary-soft p-4 text-primary">
              <Dumbbell className="size-5" />
              <span className="text-sm font-medium">7 exercises · 23 sets · last never</span>
            </div>
          </div>
          <MuscleMapPair
            size="md"
            label="Highlighted push muscles"
            highlights={{ chest: "var(--primary)", deltoids: "var(--primary)", triceps: "var(--primary)" }}
          />
        </section>
      </div>
    </main>
  )
}
