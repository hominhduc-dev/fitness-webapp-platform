"use client"

import { Suspense, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  LayoutDashboard,
  Menu,
  Plus,
  Timer,
  Users,
  X,
} from "lucide-react"
import { AuthModalLauncher } from "@/components/auth/auth-modal-launcher"
import { LanguageToggle } from "@/components/layout/language-toggle"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import type { AppLocale } from "@/lib/i18n/config"
import { cn } from "@/lib/utils"
import styles from "./landing-page.module.css"

type DemoKey = "workout" | "nutrition" | "progress"

export function LandingPage(_props: { locale: AppLocale }) {
  const { messages } = useLocale()
  const c = messages.landing
  return (
    <div
      className={cn(styles.shell, "min-h-screen bg-background text-foreground")}
    >
      <a href="#main-content" className={styles.skipLink}>
        {c.skipContent}
      </a>
      <div className={styles.announcement}>
        <span>{c.announcement}</span>
        <Link href="/?auth=register" scroll={false}>
          {c.getStarted}
          <ArrowRight size={14} />
        </Link>
      </div>
      <TopBar />
      <main id="main-content" className={styles.frame}>
        <Hero />
        <Specs />
        <FeaturesSection />
        <TrainerSection />
        <section className={styles.finalCta}>
          <p className={styles.eyebrow}>{c.finalEyebrow}</p>
          <h2 className={styles.sectionTitle}>
            {c.finalHeading}
            <br />
            <span>{c.finalMuted}</span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
            {c.finalCopy}
          </p>
          <Button asChild size="lg" className="mt-7 rounded-full">
            <Link href="/?auth=register" scroll={false}>
              {c.primaryCta}
              <ArrowRight />
            </Link>
          </Button>
        </section>
      </main>
      <footer className={styles.footer}>
        <p>{c.footerLine}</p>
        <div className="flex flex-wrap items-center gap-6">
          <LanguageToggle />
          <Link href="#features">{c.navFeatures}</Link>
          <Link href="/?auth=login" scroll={false}>
            {c.signIn}
            <ArrowRight size={14} />
          </Link>
        </div>
      </footer>
      <Suspense fallback={null}>
        <AuthModalLauncher />
      </Suspense>
    </div>
  )
}

function TopBar() {
  const { messages } = useLocale()
  const c = messages.landing
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight"
        >
          <Image
            src="/android-icon-192x192.png"
            width={30}
            height={30}
            alt=""
            className="rounded-lg"
          />
          <span className="text-lg">
            YeahBuddy<span className="text-primary">.</span>
          </span>
        </Link>
        <nav
          aria-label={c.navigation}
          className="hidden items-center gap-7 text-sm text-muted-foreground md:flex"
        >
          <Link href="#features" className="hover:text-foreground">
            {c.navFeatures}
          </Link>
          <Link href="#demo" className="hover:text-foreground">
            {c.productPreview}
          </Link>
          <Link href="#trainers" className="hover:text-foreground">
            {c.navTrainers}
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            asChild
            className="hidden rounded-full sm:inline-flex"
            onClick={() => setMenuOpen(false)}
          >
            <Link href="/?auth=login" scroll={false}>
              {c.signIn}
            </Link>
          </Button>
          <Button
            asChild
            className="rounded-full"
            onClick={() => setMenuOpen(false)}
          >
            <Link href="/?auth=register" scroll={false}>
              {c.getStarted}
              <ArrowRight size={15} className="hidden sm:block" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? c.closeMenu : c.openMenu}
            aria-expanded={menuOpen}
            aria-controls="landing-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {menuOpen && (
        <nav
          id="landing-navigation"
          aria-label={c.navigation}
          className={styles.mobileNav}
        >
          {[
            { href: "#features", label: c.navFeatures },
            { href: "#demo", label: c.productPreview },
            { href: "#trainers", label: c.navTrainers },
            { href: "/?auth=login", label: c.signIn },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
              <ArrowRight size={16} />
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}

function Hero() {
  const { messages } = useLocale()
  const c = messages.landing
  return (
    <section className={styles.hero}>
      <div className={styles.heroIntro}>
        <p className={styles.eyebrow}>
          YEAHBUDDY <span className="text-muted-foreground">/</span>{" "}
          {c.heroEyebrow}
        </p>
        <h1 className={styles.heroTitle}>
          {c.heroTitle}
          <br />
          <span>{c.heroMutedTitle}</span>
        </h1>
        <p className={styles.heroCopy}>{c.heroCopy}</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href="/?auth=register" scroll={false}>
              {c.startLogging}
              <ArrowRight size={17} />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full bg-transparent px-6"
          >
            <Link href="#demo">
              {c.watchDemo}
              <ArrowDown size={17} />
            </Link>
          </Button>
        </div>
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          {c.trustLine}
        </p>
      </div>
      <ProductPreview />
    </section>
  )
}

function ProductPreview() {
  const { messages } = useLocale()
  const c = messages.landing
  const [activeDemo, setActiveDemo] = useState<DemoKey>("workout")
  const demoTabs: Array<{ key: DemoKey; label: string }> = [
    { key: "workout", label: c.workouts },
    { key: "nutrition", label: c.nutrition },
    { key: "progress", label: c.progress },
  ]
  const nav = [
    { Icon: LayoutDashboard, label: c.overview, active: false },
    { Icon: Dumbbell, label: c.workouts, active: activeDemo === "workout" },
    { Icon: CalendarDays, label: c.weeklySchedule, active: false },
    { Icon: Flame, label: c.nutrition, active: activeDemo === "nutrition" },
    { Icon: BarChart3, label: c.progress, active: activeDemo === "progress" },
  ]
  return (
    <figure id="demo" className={styles.previewFigure}>
      <div className={styles.preview}>
        <div className={styles.windowBar}>
          <div
            className={styles.demoSwitch}
            role="tablist"
            aria-label={c.productPreview}
          >
            {demoTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeDemo === tab.key}
                aria-label={tab.label}
                className={cn(
                  styles.demoDot,
                  activeDemo === tab.key && styles.demoDotActive
                )}
                onClick={() => setActiveDemo(tab.key)}
              />
            ))}
          </div>
          <p>
            YeahBuddy <span className="mx-2 text-muted-foreground">/</span>{" "}
            {demoTabs.find((tab) => tab.key === activeDemo)?.label}
          </p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {c.sampleData}
          </span>
        </div>
        <div className={styles.workspace}>
          <aside className={styles.previewSidebar} aria-hidden="true">
            <div className="mb-7 flex items-center gap-2 text-sm font-semibold">
              <Dumbbell size={18} className="text-primary" />
              YeahBuddy
            </div>
            {nav.map(({ Icon, label, active }) => (
              <div
                key={label}
                className={cn(
                  styles.previewNav,
                  active && styles.previewNavActive
                )}
              >
                <Icon size={15} />
                {label}
              </div>
            ))}
            <div className="mt-auto border-t border-border pt-5 text-xs text-muted-foreground">
              {c.personalWorkspace}
              <div className="mt-2 flex items-center gap-2 text-foreground">
                <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-primary">
                  JD
                </span>
                Jamie D.
              </div>
            </div>
          </aside>
          {activeDemo === "workout" && <WorkoutDemo />}
          {activeDemo === "nutrition" && <NutritionDemo />}
          {activeDemo === "progress" && <ProgressDemo />}
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          {String(
            demoTabs.findIndex((tab) => tab.key === activeDemo) + 1
          ).padStart(2, "0")} /{" "}
          {c.productPreview}
        </span>
        <span>
          {activeDemo === "workout" && c.previewCaption}
          {activeDemo === "nutrition" && c.nutritionTarget}
          {activeDemo === "progress" && c.featureChartsTitle}
        </span>
      </figcaption>
    </figure>
  )
}

function WorkoutDemo() {
  const { messages } = useLocale()
  const c = messages.landing
  return (
    <div className={styles.previewMain}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {c.todaySession}
          </p>
          <h3 className="text-xl font-semibold tracking-tight">{c.pushDay}</h3>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 font-mono text-xs">
          <span className="size-1.5 rounded-full bg-success" />
          {c.inProgress}
        </span>
      </div>
      <div className={styles.sessionStats}>
        {[
          { value: "42:18", label: c.duration },
          { value: "4,280 kg", label: c.volume },
          { value: "12 / 18", label: c.sets },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 font-mono text-lg font-medium">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className={styles.previewPanels}>
        <MockSetLog />
        <MockChart />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <Check size={13} className="text-success-text" />
          {c.savedSets}
        </span>
        <span className="flex items-center gap-1.5">
          <Timer size={13} />
          {c.restTimer}
          <span className="font-mono text-foreground">01:30</span>
        </span>
      </div>
    </div>
  )
}

function MockSetLog() {
  const { messages } = useLocale()
  const c = messages.landing
  const sets = [
    { kg: 60, reps: 10, warm: true },
    { kg: 80, reps: 8 },
    { kg: 82.5, reps: 8 },
    { kg: 85, reps: null },
  ]
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{c.benchPress}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {c.benchSummary}
          </p>
        </div>
        <Dumbbell size={16} className="shrink-0 text-muted-foreground" />
      </div>
      <table className={styles.setTable}>
        <thead>
          <tr>
            <th>{c.set}</th>
            <th>kg</th>
            <th>{c.reps}</th>
            <th>
              <span className="sr-only">{c.status}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sets.map((set, index) => (
            <tr key={index} className={cn(index === 2 && styles.bestSet)}>
              <td>
                {index + 1}
                <span className="ml-2 text-[9px] text-muted-foreground">
                  {set.warm ? c.warmup : index === 2 ? "PR" : ""}
                </span>
              </td>
              <td>{set.kg}</td>
              <td>{set.reps ?? "—"}</td>
              <td>
                {set.reps ? (
                  <Check
                    size={14}
                    className="mx-auto text-success-text"
                    aria-label={c.completed}
                  />
                ) : (
                  <span className="mx-auto block size-3 rounded-sm border border-border" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-[11px] text-muted-foreground">
        <Plus size={12} />
        {c.nextSet}
      </p>
    </div>
  )
}

function NutritionDemo() {
  const { messages } = useLocale()
  const c = messages.landing
  const meals = [
    { label: "Breakfast", value: "620 kcal", detail: "42g protein" },
    { label: "Lunch", value: "810 kcal", detail: "58g protein" },
    { label: "Dinner", value: "740 kcal", detail: "49g protein" },
  ]
  return (
    <div className={styles.previewMain}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {c.nutritionTarget}
          </p>
          <h3 className="text-xl font-semibold tracking-tight">
            {c.featureNutritionTitle}
          </h3>
        </div>
        <span className="rounded-full border border-border px-3 py-1.5 font-mono text-xs">
          1,840 / 2,250 kcal
        </span>
      </div>
      <div className={styles.macroGrid}>
        {[
          { label: c.protein, value: "149g", amount: "86%" },
          { label: c.calories, value: "1,840", amount: "82%" },
          { label: c.carbs, value: "205g", amount: "72%" },
        ].map((item) => (
          <div key={item.label} className={styles.macroCard}>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{item.label}</span>
              <span>{item.amount}</span>
            </div>
            <p className="mt-3 font-mono text-2xl font-medium">{item.value}</p>
            <div className={styles.progressTrack}>
              <span style={{ width: item.amount }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background">
        {meals.map((meal) => (
          <div
            key={meal.label}
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <div>
              <p className="text-sm font-medium">{meal.label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {meal.detail}
              </p>
            </div>
            <span className="font-mono text-sm">{meal.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProgressDemo() {
  const { messages } = useLocale()
  const c = messages.landing
  return (
    <div className={styles.previewMain}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {c.progress}
          </p>
          <h3 className="text-xl font-semibold tracking-tight">
            {c.featureChartsTitle}
          </h3>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 font-mono text-xs">
          <span className="size-1.5 rounded-full bg-success" />
          +5.0 kg
        </span>
      </div>
      <div className={styles.progressPreviewGrid}>
        <MockChart />
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {c.progress}
          </p>
          {[
            { label: c.volume, value: "18,420 kg", trend: "+12%" },
            { label: c.bodyWeight, value: "74.8 kg", trend: "-1.4 kg" },
            { label: c.sets, value: "68", trend: "+8" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 border-b border-border py-4 last:border-b-0"
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="mt-1 font-mono text-lg">{item.value}</p>
              </div>
              <span className="rounded-full bg-success-soft px-2.5 py-1 font-mono text-[11px] text-success-text">
                {item.trend}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MockChart() {
  const { messages } = useLocale()
  const c = messages.landing
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-background p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {c.oneRmEstimate}
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-3xl tracking-tight">112.5</span>
        <span className="text-xs text-muted-foreground">kg</span>
      </div>
      <p className="mt-1 text-[10px] text-success-text">
        +5.0 kg <span className="text-muted-foreground">/ {c.twelveWeeks}</span>
      </p>
      <svg
        viewBox="0 0 240 112"
        className="mt-auto w-full pt-5"
        aria-hidden="true"
      >
        <path
          d="M0 20H240M0 55H240M0 90H240"
          stroke="var(--border)"
          strokeDasharray="3 4"
        />
        <path
          d="M0 95L24 89L48 78L72 81L96 61L120 56L144 58L168 39L192 31L216 24L238 10V112H0Z"
          fill="var(--primary-soft)"
        />
        <path
          d="M0 95L24 89L48 78L72 81L96 61L120 56L144 58L168 39L192 31L216 24L238 10"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="238" cy="10" r="3" fill="var(--primary)" />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>{c.weekOne}</span>
        <span>{c.weekTwelve}</span>
      </div>
    </div>
  )
}

function Specs() {
  const { messages } = useLocale()
  const c = messages.landing
  return (
    <dl className={styles.specs}>
      {[
        {
          label: c.specTraining,
          value: c.specTrainingValue,
          detail: c.specTrainingDetail,
        },
        {
          label: c.specNutrition,
          value: c.specNutritionValue,
          detail: c.specNutritionDetail,
        },
        {
          label: c.specProgress,
          value: c.specProgressValue,
          detail: c.specProgressDetail,
        },
        {
          label: c.specCoaching,
          value: c.specCoachingValue,
          detail: c.specCoachingDetail,
        },
      ].map((spec) => (
        <div key={spec.label}>
          <dt className={styles.eyebrow}>{spec.label}</dt>
          <dd className="mt-3 text-xl font-medium tracking-tight">
            {spec.value}
            <span className="mt-1.5 block text-xs font-normal tracking-normal text-muted-foreground">
              {spec.detail}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

function FeaturesSection() {
  const { messages } = useLocale()
  const c = messages.landing
  const features = [
    { Icon: Dumbbell, title: c.featureLogTitle, body: c.featureLogCopy },
    {
      Icon: Flame,
      title: c.featureNutritionTitle,
      body: c.featureNutritionCopy,
    },
    { Icon: BarChart3, title: c.featureChartsTitle, body: c.featureChartsCopy },
    {
      Icon: CalendarDays,
      title: c.featureHistoryTitle,
      body: c.featureHistoryCopy,
    },
    { Icon: Timer, title: c.featureTimerTitle, body: c.featureTimerCopy },
    { Icon: Users, title: c.featureCoachTitle, body: c.featureCoachCopy },
  ]
  return (
    <section id="features" className={styles.section}>
      <div className={styles.sectionIntro}>
        <p className={styles.eyebrow}>{c.featuresEyebrow}</p>
        <h2 className={styles.sectionTitle}>
          {c.featuresTitle}
          <br />
          <span>{c.featuresMutedTitle}</span>
        </h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
          {c.featuresCopy}
        </p>
      </div>
      <div className={styles.featureGrid}>
        {features.map(({ Icon, title, body }, index) => (
          <article key={title} className={styles.feature}>
            <div className="flex items-center justify-between">
              <Icon size={21} strokeWidth={1.5} className="text-primary" />
              <span className="font-mono text-[10px] text-muted-foreground">
                0{index + 1}
              </span>
            </div>
            <h3 className="mb-2 mt-7 text-base font-semibold tracking-tight">
              {title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </article>
        ))}
      </div>
      <div className={styles.sectionFoot}>
        <p>{c.featuresFootnote}</p>
        <Link href="/?auth=register" scroll={false}>
          {c.getStarted}
          <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  )
}

function TrainerSection() {
  const { messages } = useLocale()
  const c = messages.landing
  const rows = [
    {
      name: "Maya R.",
      initials: "MR",
      plan: c.pullDay,
      status: c.clientOnTrack,
      complete: true,
    },
    {
      name: "Theo S.",
      initials: "TS",
      plan: c.pushDay,
      status: c.clientUnderPlan,
      complete: false,
    },
    {
      name: "Hana K.",
      initials: "HK",
      plan: c.restDay,
      status: c.clientOnTrack,
      complete: true,
    },
  ]
  return (
    <section id="trainers" className={styles.trainers}>
      <div>
        <p className={styles.eyebrow}>{c.trainerEyebrow}</p>
        <h2 className={styles.sectionTitle}>
          {c.trainerTitle}
          <br />
          <span>{c.trainerMuted}</span>
        </h2>
        <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {c.trainerCopy}
        </p>
        <ul className="my-6 space-y-3 text-sm">
          {[
            c.coachBenefitPlan,
            c.coachBenefitProgress,
            c.coachBenefitOverview,
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Check size={16} className="mt-0.5 shrink-0 text-primary" />
              {item}
            </li>
          ))}
        </ul>
        <Button
          asChild
          variant="outline"
          className="rounded-full bg-transparent"
        >
          <Link href="/?auth=register" scroll={false}>
            {c.coachCta}
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
      <figure className={styles.coachPreview}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-sm font-medium">{c.coachWorkspace}</span>
          <Users size={16} className="text-primary" />
        </div>
        <div className="p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {c.yourTrainees}
          </p>
          <p className="mb-5 mt-2 text-3xl font-semibold">
            03{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {c.sampleProfiles}
            </span>
          </p>
          {rows.map((row) => (
            <div
              key={row.name}
              className="flex items-center gap-3 border-t border-border py-4"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-subtle font-mono text-xs">
                {row.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{row.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{row.plan}</p>
              </div>
              <span
                className={cn(
                  "max-w-28 rounded-full px-2 py-1 text-[10px]",
                  row.complete
                    ? "bg-success-soft text-success-text"
                    : "bg-warning-soft text-warning-text"
                )}
              >
                {row.status}
              </span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between rounded-md border border-border p-3 text-xs text-muted-foreground">
            {c.coachPreviewNote}
            <ChevronRight size={14} />
          </div>
        </div>
        <figcaption className="border-t border-border px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          02 / {c.sampleData}
        </figcaption>
      </figure>
    </section>
  )
}
