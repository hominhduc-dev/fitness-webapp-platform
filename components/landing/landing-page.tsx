"use client"

import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  BarChart3,
  Calendar,
  Dumbbell,
  Flame,
  Play,
  Ruler,
  Timer,
} from "lucide-react"

import { AuthModalLauncher } from "@/components/auth/auth-modal-launcher"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AppLocale } from "@/lib/i18n/config"
/* ============================================================
   LandingPage — Lift warm-minimal design (Step 3a)
   All sections are named exports for clarity; the root export
   is `LandingPage` which the page.tsx consumes.
   ============================================================ */

export function LandingPage(_props: { locale: AppLocale }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />

      <main>
        <Hero />
        <FeaturesSection />
        <TrainerCallout />
      </main>

      <FooterSection />

      <Suspense fallback={null}>
        <AuthModalLauncher />
      </Suspense>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TopBar
───────────────────────────────────────────────────────────── */
function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3.5 md:px-10 md:py-[18px]">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <Image
            src="/lift-mark.svg"
            alt=""
            width={26}
            height={26}
            className="shrink-0"
          />
          <span className="text-[20px] font-semibold tracking-[-0.04em] text-foreground">
            YeahBuddy Fitness
          </span>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-2 md:gap-7">
          <Link
            href="#features"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            Features
          </Link>
          <Link
            href="#trainers"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            For trainers
          </Link>

          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-sm font-medium"
          >
            <Link href="/?auth=login" scroll={false}>
              Sign in
            </Link>
          </Button>

          <Button
            size="sm"
            asChild
            className="bg-foreground text-background text-sm font-medium hover:bg-foreground/90"
          >
            <Link href="/?auth=register" scroll={false}>
              Get started
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}

/* ─────────────────────────────────────────────────────────────
   Hero
───────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-16 pt-10 md:px-10 md:pb-16 md:pt-20">
      {/* Headline block */}
      <div className="max-w-[760px]">
        <p className="label-micro mb-3.5">v1.0 · may 2026</p>

        <h1
          className="m-0 text-[44px] font-semibold leading-[0.96] tracking-[-0.035em] text-foreground md:text-[84px]"
        >
          Log the set.{" "}
          <br />
          <span className="text-muted-foreground">Move on.</span>
        </h1>

        <p className="mt-6 max-w-[540px] text-base leading-[1.55] text-muted-foreground md:text-[19px]">
          A quiet gym log for lifters who know what they&apos;re doing. No streaks to
          maintain. No coach pinging you. Just your numbers, where you left them.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap gap-2.5">
          <Button
            size="lg"
            asChild
            className="bg-foreground text-background font-medium hover:bg-foreground/90"
          >
            <Link href="/?auth=register" scroll={false}>
              Start logging — it&apos;s free
            </Link>
          </Button>

          <Button variant="ghost" size="lg" className="gap-2 font-medium" asChild>
            <Link href="#demo">
              <Play className="h-4 w-4" />
              Watch 30s demo
            </Link>
          </Button>
        </div>

        {/* Micro trust line */}
        <p className="mt-[22px] font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground/70">
          No credit card · iOS &amp; web · export your data anytime
        </p>
      </div>

      {/* Product preview tile */}
      <div className="mt-10 rounded-[14px] border border-border bg-card p-4 shadow-[0_24px_60px_-28px_rgba(13,13,11,0.12)] md:mt-[72px] md:p-7">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-[1.4fr_1fr] md:gap-6">
          {/* Mock set-log card */}
          <MockSetLog />
          {/* Mock sparkline chart */}
          <MockChart />
        </div>
      </div>
    </section>
  )
}

function MockSetLog() {
  const sets = [
    { n: 1, kind: "warm", kg: 60, reps: 10, done: true, pr: false },
    { n: 2, kind: "work", kg: 80, reps: 8, done: true, pr: false },
    { n: 3, kind: "work", kg: 82.5, reps: 8, done: true, pr: true },
    { n: 4, kind: "work", kg: 85, reps: null, done: false, pr: false },
  ]

  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-card">
      {/* Header */}
      <div className="border-b border-border px-[18px] py-3.5">
        <div className="text-base font-semibold text-foreground">Bench press</div>
        <div className="mt-0.5 text-xs text-muted-foreground/70">3 working sets · last 82.5 × 8</div>
      </div>

      {/* Rows */}
      {sets.map((s) => (
        <div
          key={s.n}
          className={cn(
            "grid items-center gap-2.5 border-b border-border px-[18px] py-2.5 font-mono text-[13px] last:border-b-0",
            "grid-cols-[40px_1fr_60px_60px_28px]",
            s.done && "bg-muted/60"
          )}
        >
          <span className="font-semibold text-foreground">{s.n}</span>

          <span
            className={cn(
              "text-[10px] uppercase tracking-[0.08em]",
              s.kind === "warm" ? "text-muted-foreground/60" : "text-muted-foreground"
            )}
          >
            {s.kind}
            {s.pr ? " · pr" : ""}
          </span>

          <span
            className={cn("text-center", s.done ? "text-muted-foreground/60" : "text-foreground")}
          >
            {s.kg}
          </span>

          <span
            className={cn("text-center", s.done ? "text-muted-foreground/60" : "text-foreground")}
          >
            {s.reps ?? "—"}
          </span>

          <div
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-[4px]",
              s.done
                ? "bg-[#2a8a5f] text-white"
                : "border-[1.5px] border-border bg-transparent"
            )}
          >
            {s.done && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function MockChart() {
  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <p className="label-micro mb-1.5">Bench press · 1RM est.</p>

      <div className="flex items-baseline gap-2">
        <span className="font-sans text-[36px] font-semibold leading-none tracking-[-0.03em] text-foreground [font-feature-settings:'tnum'_1]">
          112.5
        </span>
        <span className="text-[13px] text-muted-foreground">kg</span>
        <span className="ml-1 font-mono text-[12px] text-[#2a8a5f]">↑ 5.0 · 12 w</span>
      </div>

      <svg
        viewBox="0 0 240 100"
        className="mt-4 block w-full"
        aria-hidden="true"
      >
        <line x1="0" y1="25" x2="240" y2="25" stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1="60" x2="240" y2="60" stroke="var(--border)" strokeWidth="1" />
        <polyline
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          points="0,80 24,75 48,68 72,70 96,55 120,50 144,52 168,38 192,28 216,22 240,12"
        />
        <circle cx="240" cy="12" r="3" fill="var(--primary)" />
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Features grid
───────────────────────────────────────────────────────────── */
const FEATURE_ITEMS = [
  {
    Icon: Dumbbell,
    title: "Log a set in 3 taps",
    copy: "Previous numbers pre-filled. Tap kg, tap reps, tap check. Move on.",
  },
  {
    Icon: Flame,
    title: "PRs that find themselves",
    copy: "Hit a new best? YeahBuddy notices. No celebrating, no confetti — just a small tag.",
  },
  {
    Icon: BarChart3,
    title: "Charts that mean something",
    copy: "Volume, frequency, 1RM estimate. No vanity numbers.",
  },
  {
    Icon: Ruler,
    title: "Body weight + measurements",
    copy: "Weekly weigh-ins. Track waist, arms, body fat. Skip what you do not care about.",
  },
  {
    Icon: Timer,
    title: "Rest timer that knows",
    copy: "Auto-starts after each set. Tap to add 30 seconds. Auto-dismisses when done.",
  },
  {
    Icon: Calendar,
    title: "History without the noise",
    copy: "A clean monthly calendar. Click any day to see the session.",
  },
] as const

function FeaturesSection() {
  return (
    <section
      id="features"
      className="mx-auto max-w-[1200px] border-t border-border px-5 py-10 md:px-10 md:py-20"
    >
      {/* Section header */}
      <div className="mb-7 max-w-[640px] md:mb-12">
        <p className="label-micro mb-3">What&apos;s inside</p>
        <h2 className="m-0 text-[32px] font-semibold leading-[1.05] tracking-[-0.025em] text-foreground md:text-[48px]">
          Everything you need.{" "}
          <span className="text-muted-foreground">Nothing you don&apos;t.</span>
        </h2>
      </div>

      {/* 3×2 grid with hairline dividers */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {FEATURE_ITEMS.map((item, i) => {
            const col = i % 3
            const row = Math.floor(i / 3)
            const totalRows = Math.ceil(FEATURE_ITEMS.length / 3)
            return (
              <div
                key={item.title}
                className={cn(
                  "px-5 py-[22px] md:px-7 md:py-8",
                  // Mobile: bottom border on all but the last item
                  i < FEATURE_ITEMS.length - 1 && "border-b border-border",
                  // Desktop overrides: right border on cols 0 and 1
                  col < 2 && "md:border-r md:border-border",
                  // Desktop overrides: bottom border on all but last row
                  row < totalRows - 1 ? "md:border-b md:border-border" : "md:border-b-0"
                )}
              >
                <item.Icon className="h-[22px] w-[22px] text-foreground/80" />
                <h3 className="mb-1.5 mt-3.5 text-[17px] font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="m-0 text-sm leading-[1.5] text-muted-foreground">
                  {item.copy}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   Trainer callout
───────────────────────────────────────────────────────────── */
const CLIENT_ROWS = [
  { name: "Maya R.", activity: "pulled", status: "pr · deadlift 142.5", tone: "ok" as const },
  { name: "Theo S.", activity: "pushed", status: "−2 sets vs plan", tone: "warn" as const },
  { name: "Hana K.", activity: "rested", status: "4 days off", tone: "neutral" as const },
  { name: "Devon L.", activity: "pulled", status: "on track", tone: "neutral" as const },
] as const

function TrainerCallout() {
  return (
    <section
      id="trainers"
      className="mx-auto max-w-[1200px] px-5 pb-10 pt-5 md:px-10 md:pb-20 md:pt-10"
    >
      <div className="grid grid-cols-1 gap-6 rounded-[14px] bg-foreground px-6 py-8 text-background md:grid-cols-[1.3fr_1fr] md:items-center md:gap-12 md:px-[52px] md:py-12">
        {/* Left: copy */}
        <div>
          <p className="label-micro mb-3 text-[#9a9a92]">For coaches &amp; trainers</p>
          <h2 className="m-0 text-[28px] font-semibold leading-[1.05] tracking-[-0.025em] text-[#fcfcfa] md:text-[42px]">
            One dashboard for every lifter you coach.
          </h2>
          <p className="mb-6 mt-[18px] max-w-[440px] text-[15px] leading-[1.55] text-[#c9c9c2]">
            Assign programs, watch real sets land in real time, flag form check
            videos, and message clients between sessions — without a third app.
          </p>

          <div className="flex flex-wrap gap-2.5">
            <Button
              size="default"
              asChild
              className="bg-primary font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Link href="/coach">Open trainer view →</Link>
            </Button>
            <Button
              variant="ghost"
              size="default"
              className="font-medium text-[#fcfcfa] hover:bg-white/10 hover:text-[#fcfcfa]"
            >
              Request invite
            </Button>
          </div>
        </div>

        {/* Right: mock client table */}
        <div className="rounded-[10px] border border-white/[0.08] bg-white/[0.04] p-5 font-mono text-[13px] leading-[1.7] text-[#c9c9c2]">
          <div className="mb-2.5 text-[#fcfcfa]">This week · 12 clients</div>
          {CLIENT_ROWS.map((row, i) => (
            <div
              key={row.name}
              className={cn(
                "flex items-center justify-between py-1.5",
                i > 0 && "border-t border-white/[0.06]"
              )}
            >
              <span className="text-[#fcfcfa]">{row.name}</span>
              <span>{row.activity}</span>
              <span
                className={cn(
                  row.tone === "ok" && "text-[#2a8a5f]",
                  row.tone === "warn" && "text-[#b56a1a]",
                  row.tone === "neutral" && "text-[#8a8a82]"
                )}
              >
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   Footer
───────────────────────────────────────────────────────────── */
function FooterSection() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-3 px-5 py-6 md:flex-row md:items-center md:px-10 md:py-8">
        <p className="font-mono text-xs tracking-[0.04em] text-muted-foreground/70">
          © 2026 YeahBuddy Fitness · log the set, move on.
        </p>
        <div className="flex gap-[18px]">
          {["Privacy", "Terms", "Changelog", "Contact"].map((label) => (
            <Link
              key={label}
              href="#"
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
