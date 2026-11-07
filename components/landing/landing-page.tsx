"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  Check,
  Dumbbell,
  Flame,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Plus,
  ShieldCheck,
  Timer,
  Users,
  X,
} from "lucide-react"
import { AuthModalLauncher } from "@/components/auth/auth-modal-launcher"
import { LanguageToggle } from "@/components/layout/language-toggle"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/ui/brand-logo"
import { cn } from "@/lib/utils"
import styles from "./landing-page.module.css"

type DemoKey = "workout" | "nutrition" | "progress" | "coach"

// Content is visible on the server; motion is an optional client enhancement.
function useLandingMotion() {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const root = ref.current
    if (!root || typeof IntersectionObserver === "undefined") return
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-motion]"))
    let observer: IntersectionObserver | undefined
    const reset = () => {
      observer?.disconnect()
      nodes.forEach((node) => { delete node.dataset.motionState })
    }
    const start = () => {
      reset()
      if (preference.matches) return
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const node = entry.target as HTMLElement
          node.dataset.motionState = "visible"
          observer?.unobserve(node)
        })
      }, { threshold: 0.08 })
      nodes.forEach((node) => {
        const bounds = node.getBoundingClientRect()
        if (bounds.top < window.innerHeight && bounds.bottom > 0) return
        node.dataset.motionState = "pending"
        observer?.observe(node)
      })
    }
    start()
    preference.addEventListener("change", start)
    return () => { preference.removeEventListener("change", start); reset() }
  }, [])
  return ref
}

export function LandingPage() {
  const { locale, messages } = useLocale()
  const c = messages.landing
  const motionRef = useLandingMotion()
  return (
    <div
      ref={motionRef}
      lang={locale}
      className={cn(styles.shell, "min-h-screen bg-background text-foreground")}
    >
      <a href="#main-content" className={styles.skipLink}>
        {c.skipContent}
      </a>
      <TopBar />
      <div className={styles.scrollProgress} aria-hidden="true" />
      <main id="main-content" className={styles.frame}>
        <Hero />
        <Highlights />
        <FeaturesSection />
        <ProductPreview />
        <TrainerSection />
        <AISection />
        <ComparisonSection />
        <section className={styles.finalCta}>
          <div data-motion="reveal" className={styles.finalPanel}>
            <p className={styles.eyebrow}>{c.finalEyebrow}</p>
            <h2 className={styles.finalTitle}>
              {c.finalHeading}
              <br />
              <span>{c.finalMuted}</span>
            </h2>
            <p className={styles.finalCopy}>{c.finalCopy}</p>
            <Button asChild size="lg" className={styles.ctaOnBrand}>
              <Link href={`/?lang=${locale}&auth=register`} scroll={false}>
                {c.primaryCta}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <p>{c.footerLine}</p>
        <div className={styles.footerLinks}>
          <Link href="/privacy-policy">{c.privacy}</Link>
          <Link href="/terms-of-service">{c.terms}</Link>
          <Link href="#features">{c.navFeatures}</Link>
          <Link href={`/?lang=${locale}&auth=login`} scroll={false}>
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
  const { locale, messages } = useLocale()
  const c = messages.landing
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link
          href="/"
          className="flex shrink-0 items-center font-semibold tracking-tight"
        >
          <BrandLogo
            className="gap-2.5"
            markClassName="size-8"
            textClassName="text-xl font-semibold tracking-[-0.01em]"
          />
        </Link>
        <nav
          aria-label={c.navigation}
          className="hidden items-center gap-8 whitespace-nowrap text-[15px] text-muted-foreground lg:flex"
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
          <Link href="#compare" className="hover:text-foreground">
            {c.navCompare}
          </Link>
        </nav>
        <div className="flex items-center gap-2 lg:gap-5">
          <LanguageToggle className="shrink-0" syncLanguageQuery />
          <Link
            href={`/?lang=${locale}&auth=login`}
            scroll={false}
            className="hidden min-h-11 items-center text-[15px] font-medium hover:text-primary lg:inline-flex"
            onClick={() => setMenuOpen(false)}
          >
            {c.signIn}
          </Link>
          <Button
            asChild
            className={cn(styles.ctaPrimary, "hidden sm:inline-flex")}
            onClick={() => setMenuOpen(false)}
          >
            <Link href={`/?lang=${locale}&auth=register`} scroll={false}>
              {c.getStarted}
              <ArrowRight size={15} className="hidden sm:block" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
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
            { href: "#compare", label: c.navCompare },
            { href: `/?lang=${locale}&auth=login`, label: c.signIn },
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
  const { locale, messages } = useLocale()
  const c = messages.landing
  return (
    <section className={styles.hero}>
      <div className={styles.heroIntro}>
        <p className={cn(styles.heroPill, styles.heroStep1)}>
          <span>{c.heroPillTag}</span>
          {c.heroPill}
        </p>
        <h1 className={cn(styles.heroTitle, styles.heroStep2)}>
          {c.heroTitle}
          <br />
          <span>{c.heroMutedTitle}</span>
        </h1>
        <p className={cn(styles.heroCopy, styles.heroStep3)}>{c.heroCopy}</p>
        <div className={cn(styles.heroActions, styles.heroStep4)}>
          <Button asChild size="lg" className={styles.ctaPrimary}>
            <Link href={`/?lang=${locale}&auth=register`} scroll={false}>
              {c.primaryCta}
              <ArrowRight size={17} />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className={styles.ctaSecondary}>
            <a href="#demo">
              {c.livePreviewCta}
              <ArrowDown size={17} />
            </a>
          </Button>
        </div>
        <ul className={cn(styles.trustList, styles.heroStep5)}>
          {c.trustLine.split(" · ").map((item) => (
            <li key={item}>
              <Check size={15} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <HeroMockups />
    </section>
  )
}

function HeroMockups() {
  const { messages } = useLocale()
  const c = messages.landing
  const copy = c.heroMockup

  return (
    <div className={styles.heroMockups}>
      {/* Device composition follows the "MacBook Pro 14 — Realistic Mockup" Figma file. */}
      <figure className={styles.macbook} data-motion="device">
        <figcaption className="sr-only">{copy.trainee}</figcaption>
        <div className={styles.macLid}>
          <div className={styles.macScreen}>
            <span className={styles.macNotch} aria-hidden="true" />
            <Image
              src="/landing/mockup-macbook-workout.webp"
              alt={copy.traineeAlt}
              width={1920}
              height={1100}
              priority
              unoptimized
              sizes="(min-width: 1240px) 860px, 76vw"
              className={styles.macImage}
            />
          </div>
        </div>
        <div className={styles.macBase} aria-hidden="true"><span /></div>
      </figure>
      <figure className={styles.iphone} data-motion="device" data-motion-order="1">
        <figcaption className="sr-only">{copy.coach}</figcaption>
        <div className={styles.iphoneScreen}>
          <span className={styles.iphoneIsland} aria-hidden="true" />
          <Image
            src="/landing/mockup-iphone-session.webp"
            alt={copy.coachAlt}
            width={390}
            height={844}
            unoptimized
            sizes="(min-width: 1240px) 240px, (min-width: 768px) 20vw, 32vw"
            className={styles.iphoneImage}
          />
        </div>
      </figure>
      <div className={cn(styles.heroChip, styles.chipSets)} aria-hidden="true">
        <span className={styles.chipIcon}><Check size={16} /></span>
        <span>
          <strong>{c.savedSets}</strong>
          <small>{c.benchPress} · 82.5 kg × 8</small>
        </span>
      </div>
      <div className={cn(styles.heroChip, styles.chipRest)} aria-hidden="true">
        <span className={styles.chipIcon}><Timer size={16} /></span>
        <span>
          <strong>{c.restTimer} 01:30</strong>
          <small>{c.nextSet}</small>
        </span>
      </div>
    </div>
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
    { key: "coach", label: c.coachTab },
  ]
  const nav =
    activeDemo === "coach"
      ? [
          { Icon: LayoutDashboard, label: c.overview, active: true },
          { Icon: Users, label: c.yourTrainees, active: false },
          { Icon: CalendarDays, label: c.coachPrograms, active: false },
          { Icon: Dumbbell, label: c.coachExercises, active: false },
        ]
      : [
          { Icon: LayoutDashboard, label: c.overview, active: false },
          {
            Icon: Dumbbell,
            label: c.workouts,
            active: activeDemo === "workout",
          },
          { Icon: CalendarDays, label: c.weeklySchedule, active: false },
          {
            Icon: Flame,
            label: c.nutrition,
            active: activeDemo === "nutrition",
          },
          {
            Icon: BarChart3,
            label: c.progress,
            active: activeDemo === "progress",
          },
        ]
  return (
    <figure id="demo" className={cn(styles.previewFigure, styles.heroStep6)}>
      <div className={styles.previewHeading}>
        <p className={styles.eyebrow}>01 / {c.productPreview}</p>
        <p>{c.demoHint}</p>
      </div>
      <div className={styles.preview}>
        <div className={styles.windowBar}>
          <div
            className={styles.demoSwitch}
            role="group"
            aria-label={c.productPreview}
          >
            {demoTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={activeDemo === tab.key}
                className={cn(
                  styles.demoTab,
                  activeDemo === tab.key && styles.demoTabActive
                )}
                onClick={() => setActiveDemo(tab.key)}
              >
                {tab.label}
              </button>
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
              {activeDemo === "coach" ? c.coachWorkspace : c.personalWorkspace}
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
          {activeDemo === "coach" && <CoachDemo />}
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          {String(
            demoTabs.findIndex((tab) => tab.key === activeDemo) + 1
          ).padStart(2, "0")}{" "}
          / {c.productPreview}
        </span>
        <span>
          {activeDemo === "workout" && c.previewCaption}
          {activeDemo === "nutrition" && c.nutritionTarget}
          {activeDemo === "progress" && c.featureChartsTitle}
          {activeDemo === "coach" && c.coachPreviewNote}
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
    { label: c.breakfast, value: "620 kcal", detail: `42g ${c.protein}` },
    { label: c.lunch, value: "810 kcal", detail: `58g ${c.protein}` },
    { label: c.dinner, value: "410 kcal", detail: `49g ${c.protein}` },
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

function Highlights() {
  const { messages } = useLocale()
  const c = messages.landing
  const highlights = [
    { Icon: LayoutDashboard, href: "#features", ...c.differences.tracking },
    { Icon: Users, href: "#trainers", ...c.differences.coaching },
    { Icon: ShieldCheck, href: "#ai", ...c.differences.approval },
  ]
  return (
    <section id="why" aria-labelledby="why-title" className={styles.highlights}>
      <p className={styles.eyebrow}>{c.differences.title}</p>
      <h2 id="why-title" className={styles.sectionTitle}>{c.differences.heading}</h2>
      <div className={styles.highlightsGrid}>
        {highlights.map(({ Icon, href, title, body }, index) => (
          <article className={styles.highlight} key={href} data-motion="reveal" data-motion-order={index}>
            <span className={styles.featureIconWrap} aria-hidden="true"><Icon size={22} /></span>
            <h3 className="mt-4 text-xl font-semibold tracking-[-0.01em]">{title}</h3>
            <p className="mt-4 text-[15px] leading-6 text-muted-foreground">{body}</p>
            <a className={styles.detailLink} href={href}>
              {c.differences.details}<span className="sr-only"> {title}</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}

const comparisonSources = {
  hevy: { name: "Hevy", href: "https://www.hevyapp.com/features/" },
  fitbod: { name: "Fitbod", href: "https://fitbod.me/faqs/" },
  trainerize: { name: "ABC Trainerize", href: "https://help.trainerize.com/hc/en-us/articles/208688876-What-is-ABC-Trainerize-A-Getting-Started-Overview" },
} as const

function ComparisonSection() {
  const { messages } = useLocale()
  const copy = messages.landing.comparison
  const products = [
    { name: "YeahBuddy", body: copy.yeahbuddy },
    ...Object.entries(comparisonSources).map(([key, source]) => ({
      ...source, body: copy[key as keyof typeof comparisonSources],
    })),
  ]
  return (
    <section id="compare" className={styles.comparison} aria-labelledby="compare-title" data-motion="heading">
      <div className={styles.sectionIntro}>
        <p className={styles.eyebrow}>{copy.label}</p>
        <h2 id="compare-title" className={styles.sectionTitle}>{copy.title}</h2>
        <p className={styles.introSmall}>{copy.intro}</p>
      </div>
      <dl className={styles.comparisonList}>
        {products.map(({ name, body, ...source }) => (
          <div key={name} className={styles.comparisonRow}>
            <dt>{name}</dt>
            <dd className="min-w-0 text-[15px] leading-relaxed text-muted-foreground">{body}</dd>
            <dd>
              {"href" in source ? (
                <a className={styles.comparisonTag} href={source.href}>
                  {copy.source}<span className="sr-only"> {name}</span>
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </a>
              ) : (
                <span className={styles.comparisonTag}>{copy.current}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{copy.note}</p>
    </section>
  )
}

function FeaturesSection() {
  const { locale, messages } = useLocale()
  const c = messages.landing
  const features = [
    { title: c.featureLogTitle, body: c.featureLogCopy },
    { title: c.featureNutritionTitle, body: c.featureNutritionCopy },
    { title: c.featureChartsTitle, body: c.featureChartsCopy },
    { title: c.featureHistoryTitle, body: c.featureHistoryCopy },
    { title: c.featureTimerTitle, body: c.featureTimerCopy },
    { title: c.featureCoachTitle, body: c.featureCoachCopy },
  ]
  return (
    <section
      id="features"
      className={styles.section}
    >
      <div data-motion="heading" className={styles.sectionIntro}>
        <p className={styles.eyebrow}>02 / {c.featuresEyebrow}</p>
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
        {features.map(({ title, body }, index) => (
          <article key={title} data-motion="reveal" data-motion-order={index % 3} className={styles.feature}>
            <span className={styles.featureNumber}>0{index + 1}</span>
            <h3 className="mb-3 mt-3 text-xl font-semibold tracking-[-0.01em]">{title}</h3>
            <p className="text-[15px] leading-6 text-muted-foreground">{body}</p>
          </article>
        ))}
      </div>
      <div className={styles.accountBand}>
        <p>{c.featuresFootnote}</p>
        <Button asChild size="lg" className={styles.ctaPrimary}>
          <Link href={`/?lang=${locale}&auth=register`} scroll={false}>
            {c.getStarted}
            <ArrowRight size={17} />
          </Link>
        </Button>
      </div>
    </section>
  )
}

function TrainerSection() {
  const { messages } = useLocale()
  const c = messages.landing
  return (
    <section
      id="trainers"
      className={styles.trainers}
    >
      <div data-motion="heading">
        <p className={styles.eyebrow}>03 / {c.trainerEyebrow}</p>
        <h2 className={styles.sectionTitle}>
          {c.trainerTitle}
          <br />
          <span>{c.trainerMuted}</span>
        </h2>
        <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {c.trainerCopy}
        </p>
        <ul className={styles.checkList}>
          {[
            c.coachBenefitPlan,
            c.coachBenefitProgress,
            c.coachBenefitOverview,
          ].map((item) => (
            <li key={item}>
              <span aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
              {item}
            </li>
          ))}
        </ul>
        <Button asChild size="lg" variant="outline" className={styles.ctaSecondary}>
          <Link href="/coach-signup">
            {c.coachSignupCta}
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <figure data-motion="reveal" data-motion-order="1" className={styles.coachPreview}>
        <CoachDemo badge={c.sampleData} />
      </figure>
    </section>
  )
}
function AISection() {
  const { messages } = useLocale()
  const c = messages.landing
  const steps = [c.aiStepRead, c.aiStepDraft, c.aiStepReview]
  return (
    <section
      id="ai"
      className={styles.aiSection}
    >
      <div data-motion="heading" className={styles.sectionIntro}>
        <p className={styles.eyebrow}>04 / {c.aiEyebrow}</p>
        <h2 className={styles.sectionTitle}>
          {c.aiTitle}<br /><span>{c.aiMutedTitle}</span>
        </h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">{c.aiCopy}</p>
      </div>
      <div className={styles.aiGrid}>
        <article data-motion="reveal" className={styles.aiCard}>
          <span className={styles.featureIconWrap} aria-hidden="true"><MessageCircle size={22} /></span>
          <h3 className="mt-4 text-xl font-semibold tracking-[-0.01em]">AI Coach</h3>
          <p className="mt-4 text-[15px] leading-6 text-muted-foreground">{c.aiCoachCopy}</p>
          <div className={styles.aiChat}>
            <span className={styles.eyebrow}>{c.aiExampleLabel}</span>
            <p className={styles.aiQuestion}>{c.aiQuestion}</p>
          </div>
        </article>
        <article data-motion="reveal" data-motion-order="1" className={cn(styles.aiCard, styles.aiAgentCard)}>
          <span className={styles.featureIconWrap} aria-hidden="true"><Bot size={22} /></span>
          <h3 className="mt-4 text-xl font-semibold tracking-[-0.01em]">AI Agent</h3>
          <p className="mt-4 text-[15px] leading-6 text-muted-foreground">{c.aiAgentCopy}</p>
          <ol className={styles.aiSteps}>
            {steps.map((step, index) => (
              <li key={step}>
                <span aria-hidden="true">0{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <p className={styles.aiNote}>
            <ShieldCheck size={18} aria-hidden="true" />
            {c.aiGuardrail}
          </p>
        </article>
      </div>
    </section>
  )
}

function CoachDemo({ badge }: { badge?: string }) {
  const { messages } = useLocale()
  const c = messages.landing
  return (
    <div className={styles.previewMain}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className={cn(styles.eyebrow, styles.eyebrowMuted)}>{c.coachWorkspace}</p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.01em]">
            {c.coachDemoTitle}
          </h3>
        </div>
        {badge ? (
          <span className={styles.sampleBadge}>{badge}</span>
        ) : (
          <Users size={20} className="shrink-0 text-primary" aria-hidden="true" />
        )}
      </div>
      <div className={styles.coachMetrics}>
        {[
          { label: c.yourTrainees, value: "3" },
          { label: c.coachSessions, value: "6" },
          { label: c.coachCompletion, value: "67%" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-border bg-background p-3"
          >
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-2 font-mono text-2xl font-medium">{item.value}</p>
          </div>
        ))}
      </div>
      <div className={styles.weeklyChart}>
        <p className="text-[15px] font-medium">{c.coachWeeklyActivity}</p>
        <div
          className={styles.activityBars}
          aria-label={c.coachActivityDescription}
          role="img"
        >
          {[2, 1, 0, 2, 1, 0, 0].map((count, index) => (
            <div key={index}>
              <span className={count ? "text-foreground" : undefined}>{count}</span>
              <span
                className={cn(styles.activityBar, !count && styles.activityBarEmpty)}
                style={{ height: Math.max(6, count * 44) + "px" }}
              />
              <span>{5 + index}/10</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.swapRequest}>
        <span className={styles.swapIcon} aria-hidden="true">
          <ArrowLeftRight size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={styles.eyebrow}>{c.coachSwapTitle}</p>
          <p className="mt-0.5 text-[15px] font-medium">{c.coachSwapExample}</p>
          <p className="text-[15px] leading-6 text-muted-foreground">
            Maya R. · {c.coachSwapDay} · {c.coachSwapReview}
          </p>
        </div>
        <span className={styles.swapApprove}>{c.coachSwapApprove}</span>
      </div>
    </div>
  )
}
