"use client"

import {
  AlertCircle,
  CheckCircle2,
  Dumbbell,
  Flame,
  Info,
  Search,
  TriangleAlert,
} from "lucide-react"

import { ThemeToggle } from "@/components/layout/theme-toggle"
import { useTheme } from "@/components/providers/theme-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FilterChip } from "@/components/ui/filter-chip"
import { IconTile } from "@/components/ui/icon-tile"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * Poster-style styleguide sheet for the Kinetic Glass v2 system.
 *
 * Every swatch, state and measurement below reads a live token rather than a
 * literal, so switching palette in the header re-renders the whole sheet as
 * that theme's specimen — the point of the page is auditing the eight themes
 * against one another, not documenting a single one.
 *
 * Dev-only preview route (no session, no i18n messages), matching the sibling
 * /dev/design-system lab.
 */

const brandSwatches = [
  { label: "Primary action", token: "--primary", note: "Buttons, links, active nav" },
  { label: "Primary hover", token: "--primary-hover", note: "Pointer hover state" },
  { label: "Primary pressed", token: "--primary-pressed", note: "Active / pressed state" },
  { label: "Primary soft", token: "--primary-soft", note: "Tinted accent surfaces" },
  { label: "Focus ring", token: "--ring", note: "3px ring at 50% alpha" },
  { label: "Canvas", token: "--background", note: "Page backdrop" },
  { label: "Card", token: "--card", note: "Raised surface" },
  { label: "Surface subtle", token: "--surface-subtle", note: "Inset / recessed panel" },
  { label: "Border", token: "--border", note: "Hairline divider" },
] as const

const inkRamp = [
  ["ink-0", "--ink-0"],
  ["ink-50", "--ink-50"],
  ["ink-100", "--ink-100"],
  ["ink-150", "--ink-150"],
  ["ink-200", "--ink-200"],
  ["ink-400", "--ink-400"],
  ["ink-600", "--ink-600"],
  ["ink-800", "--ink-800"],
  ["ink-900", "--ink-900"],
] as const

const semanticPairs = [
  { label: "Success", surface: "--success-soft", ink: "--success-text", solid: "--success" },
  { label: "Warning", surface: "--warning-soft", ink: "--warning-text", solid: "--warning" },
  { label: "Info", surface: "--info-soft", ink: "--info-text", solid: "--info" },
  { label: "Danger", surface: "--destructive-soft", ink: "--destructive-text", solid: "--destructive" },
] as const

const typeScale = [
  { className: "text-4xl font-semibold tracking-tight", label: "Display", spec: "text-4xl / 600" },
  { className: "text-3xl font-semibold tracking-tight", label: "H1 Page title", spec: "text-3xl / 600" },
  { className: "text-2xl font-semibold tracking-tight", label: "H2 Section", spec: "text-2xl / 600" },
  { className: "text-lg font-semibold leading-none tracking-tight", label: "H3 Card title", spec: "text-lg / 600" },
  { className: "text-base", label: "Body large", spec: "text-base / 400" },
  { className: "text-sm", label: "Body", spec: "text-sm / 400" },
  { className: "text-xs text-muted-foreground", label: "Caption", spec: "text-xs / muted" },
] as const

const spacingSteps = [4, 8, 12, 16, 24, 32, 48] as const

const radiusSteps = [
  { label: "sm", value: "calc(var(--radius) - 4px)", note: "12px · chips, micro tags" },
  { label: "md", value: "calc(var(--radius) - 2px)", note: "14px · buttons, inputs" },
  { label: "lg", value: "var(--radius)", note: "16px · cards, alerts" },
  { label: "xl", value: "calc(var(--radius) + 4px)", note: "20px · glass cards" },
  { label: "full", value: "999px", note: "Pills, avatars, nav" },
] as const

const elevationSteps = [
  { label: "Level 0 · Flat", className: "border border-border bg-card", note: "Inline panels, table rows" },
  { label: "Level 1 · Raised", className: "border border-border bg-card shadow-sm", note: "Card — 0 1px 2px" },
  { label: "Level 2 · Floating", className: "glass-card border", note: "Dashboard tiles, hover lift" },
  { label: "Level 3 · Overlay", className: "glass-surface border rounded-xl", note: "Dialogs, sheets, sidebar" },
] as const

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="label-micro mb-3 border-b border-border pb-2">{children}</p>
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-card p-4 ${className ?? ""}`}>{children}</section>
}

function StateCell({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`flex h-9 min-w-0 items-center justify-center truncate rounded-md px-2 text-xs font-medium ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  )
}

export default function StyleguidePage() {
  const { resolvedTheme } = useTheme()

  return (
    <main className="relative min-h-dvh px-4 py-8 text-foreground sm:px-8 lg:px-12">
      {/* Drafting-sheet grid, purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, color-mix(in srgb, var(--border) 70%, transparent) 0 1px, transparent 1px 112px)",
        }}
      />

      <div className="relative mx-auto max-w-[1400px]">
        <header className="mb-8 flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label-micro mb-3 text-primary">YeahBuddy · Design tokens</p>
            <h1 className="text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl">
              Product UI
              <br />
              Styleguide
            </h1>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground">
              Kinetic Glass v2 — mọi swatch và state bên dưới đọc trực tiếp CSS custom property, nên đổi palette ở
              header là đổi toàn bộ sheet. Palette đang xem:{" "}
              <span className="font-mono text-foreground">{resolvedTheme}</span>.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <p className="label-micro">Palette</p>
            <ThemeToggle variant="select" className="w-64" />
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {/* ── Column 1 — colour ─────────────────────────────────────────── */}
          <div className="space-y-6">
            <Panel>
              <SectionLabel>Color tokens</SectionLabel>
              <div className="space-y-2">
                {brandSwatches.map(({ label, token, note }) => (
                  <div key={token} className="overflow-hidden rounded-lg border border-border">
                    <div className="h-14 border-b border-border" style={{ background: `var(${token})` }} />
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium leading-tight">{label}</p>
                      <code className="mt-0.5 block font-mono text-micro text-muted-foreground">{token}</code>
                      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionLabel>Ink ramp</SectionLabel>
              <div className="overflow-hidden rounded-lg border border-border">
                {inkRamp.map(([label, token]) => (
                  <div key={token} className="flex items-center gap-3 border-b border-border last:border-b-0">
                    <div className="h-10 w-16 shrink-0" style={{ background: `var(${token})` }} />
                    <span className="font-mono text-micro">{label}</span>
                    <code className="ml-auto pr-3 font-mono text-micro text-muted-foreground">{token}</code>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Light themes chạy ramp bằng grey đặc; dark và Black + Volt đảo sang white-alpha để border bắt được nền
                phía sau.
              </p>
            </Panel>

          </div>

          {/* ── Column 2 — type, spacing, radius ──────────────────────────── */}
          <div className="space-y-6">
            <Panel>
              <SectionLabel>Typography scale</SectionLabel>
              <div className="space-y-3">
                {typeScale.map(({ className, label, spec }) => (
                  <div key={label} className="border-b border-border pb-3 last:border-b-0 last:pb-0">
                    <p className={className}>{label}</p>
                    <code className="mt-1 block font-mono text-micro text-muted-foreground">{spec}</code>
                  </div>
                ))}
                <div className="border-t border-border pt-3">
                  <p className="label-micro">Micro label · mono uppercase</p>
                  <code className="mt-1 block font-mono text-micro text-muted-foreground">
                    .label-micro — 11px / 0.08em
                  </code>
                </div>
                <div>
                  <p className="tnum font-mono text-2xl font-semibold">102.5 kg × 8</p>
                  <code className="mt-1 block font-mono text-micro text-muted-foreground">
                    .tnum — tabular numerals, chữ ký của mọi số liệu
                  </code>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Geist Sans + Geist Mono, wired qua next/font.</p>
            </Panel>

            <Panel>
              <SectionLabel>Spacing</SectionLabel>
              <div className="space-y-2">
                {spacingSteps.map((step) => (
                  <div key={step} className="flex items-center gap-3">
                    <code className="w-12 shrink-0 font-mono text-micro text-muted-foreground">{step}px</code>
                    <div className="h-4 rounded-sm bg-primary/70" style={{ width: `${step * 2}px` }} />
                    <code className="ml-auto font-mono text-micro text-muted-foreground">
                      {step === 4 ? "gap-1" : step === 8 ? "gap-2" : step === 12 ? "gap-3" : step === 16 ? "gap-4" : step === 24 ? "gap-6" : step === 32 ? "gap-8" : "gap-12"}
                    </code>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Base 4px. Card padding 20px mobile → 24px từ md.
              </p>
            </Panel>

            <Panel>
              <SectionLabel>Radius</SectionLabel>
              <div className="space-y-3">
                {radiusSteps.map(({ label, value, note }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div
                      className="size-12 shrink-0 border border-border bg-primary/70"
                      style={{ borderRadius: value }}
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">{note}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Tất cả dẫn xuất từ <code className="font-mono">--radius: 1rem</code>, chia sẻ giữa light và dark.
              </p>
            </Panel>
          </div>

          {/* ── Column 3 — elevation + buttons ────────────────────────────── */}
          <div className="space-y-6">
            <Panel>
              <SectionLabel>Elevation</SectionLabel>
              <div className="space-y-3">
                {elevationSteps.map(({ label, className, note }) => (
                  <div key={label} className={`px-4 py-4 ${className}`}>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Light mode làm phẳng glass thành surface đục; dark giữ nguyên blur + rim highlight.
              </p>
            </Panel>

            <Panel>
              <SectionLabel>Buttons — states</SectionLabel>
              <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-1.5">
                <span />
                <span className="text-center font-mono text-micro text-muted-foreground">Default</span>
                <span className="text-center font-mono text-micro text-muted-foreground">Hover</span>
                <span className="text-center font-mono text-micro text-muted-foreground">Active</span>

                <span className="pr-2 text-xs text-muted-foreground">Primary</span>
                <StateCell className="bg-primary text-primary-foreground">Primary</StateCell>
                <StateCell className="bg-primary-hover text-primary-foreground">Primary</StateCell>
                <StateCell className="bg-primary-pressed text-primary-foreground">Primary</StateCell>

                <span className="pr-2 text-xs text-muted-foreground">Secondary</span>
                <StateCell className="bg-secondary text-secondary-foreground">Secondary</StateCell>
                <StateCell
                  className="text-secondary-foreground"
                  style={{ background: "var(--secondary-hover)" }}
                >
                  Secondary
                </StateCell>
                <StateCell className="bg-surface-hover text-secondary-foreground">Secondary</StateCell>

                <span className="pr-2 text-xs text-muted-foreground">Outline</span>
                <StateCell className="border border-border bg-background">Outline</StateCell>
                <StateCell className="border border-border bg-accent text-accent-foreground">Outline</StateCell>
                <StateCell className="border border-border bg-surface-hover">Outline</StateCell>

                <span className="pr-2 text-xs text-muted-foreground">Ghost</span>
                <StateCell>Ghost</StateCell>
                <StateCell className="bg-accent text-accent-foreground">Ghost</StateCell>
                <StateCell className="bg-surface-hover">Ghost</StateCell>

                <span className="pr-2 text-xs text-muted-foreground">Danger</span>
                <StateCell className="bg-destructive text-destructive-foreground">Delete</StateCell>
                <StateCell className="bg-destructive/90 text-destructive-foreground">Delete</StateCell>
                <StateCell className="bg-destructive/80 text-destructive-foreground">Delete</StateCell>
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <p className="label-micro mb-3">Sizes &amp; modifiers</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm">Small</Button>
                  <Button>Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon" aria-label="Icon button">
                    <Dumbbell />
                  </Button>
                  <Button variant="link">Link</Button>
                  <Button disabled>Disabled</Button>
                  <Button className="border-ring ring-[3px] ring-ring/50">Focus ring</Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Trên pointer thô, mọi size nâng lên 44px theo Apple HIG (<code className="font-mono">pointer-coarse:</code>).
                </p>
              </div>
            </Panel>

            <Panel>
              <SectionLabel>Semantic pairs</SectionLabel>
              <div className="space-y-2">
                {semanticPairs.map(({ label, surface, ink, solid }) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                    style={{ background: `var(${surface})`, color: `var(${ink})` }}
                  >
                    <span className="size-3 shrink-0 rounded-full" style={{ background: `var(${solid})` }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{label}</p>
                      <code className="font-mono text-micro opacity-80">
                        {surface} + {ink}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Soft surface luôn đi kèm ink token riêng — không dùng màu solid làm text trên nền nhạt.
              </p>
            </Panel>
          </div>

          {/* ── Column 4 — controls & patterns ────────────────────────────── */}
          <div className="space-y-6">
            <Panel>
              <SectionLabel>Inputs</SectionLabel>
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Default</p>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input aria-label="Search exercises" className="pl-9" placeholder="Tìm bài tập" />
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Focus</p>
                  <Input
                    aria-label="Email focused sample"
                    className="border-ring ring-[3px] ring-ring/50"
                    placeholder="name@company.com"
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Invalid</p>
                  <Input aria-invalid aria-label="Invalid sample" defaultValue="not-an-email" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Disabled</p>
                  <Input aria-label="Disabled sample" disabled placeholder="Không khả dụng" />
                </div>
              </div>
            </Panel>

            <Panel>
              <SectionLabel>Chips &amp; badges</SectionLabel>
              <div className="flex flex-wrap gap-2">
                <FilterChip active count={12}>
                  Đang hoạt động
                </FilterChip>
                <FilterChip count={4}>Đã ghim</FilterChip>
                <FilterChip>Chờ duyệt</FilterChip>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>Primary</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Danger</Badge>
                <Badge variant="micro">Set 03</Badge>
                <Badge variant="micro">PR</Badge>
              </div>
            </Panel>

            <Panel>
              <SectionLabel>Tabs</SectionLabel>
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Tổng quan</TabsTrigger>
                  <TabsTrigger value="history">Lịch sử</TabsTrigger>
                  <TabsTrigger value="notes">Ghi chú</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="mt-4">
                <p className="label-micro mb-2">Segmented</p>
                <Tabs defaultValue="push">
                  <TabsList variant="segmented">
                    <TabsTrigger value="push">
                      <Dumbbell />
                      Push
                    </TabsTrigger>
                    <TabsTrigger value="pull">
                      <Flame />
                      Pull
                    </TabsTrigger>
                    <TabsTrigger value="legs">
                      <CheckCircle2 />
                      Legs
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </Panel>

            <Panel>
              <SectionLabel>Alerts</SectionLabel>
              <div className="space-y-2.5">
                <Alert variant="success">
                  <CheckCircle2 />
                  <AlertTitle>Đã lưu buổi tập</AlertTitle>
                  <AlertDescription>23 set được ghi nhận.</AlertDescription>
                </Alert>
                <Alert variant="info">
                  <Info />
                  <AlertTitle>Tính năng mới</AlertTitle>
                  <AlertDescription>Theo dõi cân nặng đã có biểu đồ xu hướng.</AlertDescription>
                </Alert>
                <Alert variant="warning">
                  <TriangleAlert />
                  <AlertTitle>Phiên sắp hết hạn</AlertTitle>
                  <AlertDescription>Đăng nhập lại để tiếp tục.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Không lưu được</AlertTitle>
                  <AlertDescription>Kiểm tra kết nối rồi thử lại.</AlertDescription>
                </Alert>
              </div>
            </Panel>

            <Panel>
              <SectionLabel>Cards</SectionLabel>
              <Card>
                <CardHeader className="gap-3">
                  <div className="flex items-center gap-3">
                    <IconTile tone="primary">
                      <Dumbbell />
                    </IconTile>
                    <div>
                      <CardTitle>Push Day A</CardTitle>
                      <CardDescription>7 bài · 23 set</CardDescription>
                    </div>
                    <Badge variant="micro" className="ml-auto">
                      Hôm nay
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    Card chuẩn: <code className="font-mono text-micro">bg-card</code> + border hairline + shadow-sm.
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button size="sm">Bắt đầu</Button>
                  <Button size="sm" variant="outline">
                    Chi tiết
                  </Button>
                </CardFooter>
              </Card>

              <div className="glass-card mt-3 border p-5">
                <p className="label-micro mb-2 text-primary">Glass card</p>
                <p className="text-sm font-medium">Level 2 — dashboard tile</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Blur + rim highlight ở dark, phẳng thành surface đục ở light.
                </p>
              </div>
            </Panel>
          </div>
        </div>

        <footer className="mt-10 border-t border-border pt-6">
          <p className="label-micro">
            YeahBuddy Product UI Styleguide · Kinetic Glass v2 · 8 palette · /dev/styleguide
          </p>
        </footer>
      </div>
    </main>
  )
}
