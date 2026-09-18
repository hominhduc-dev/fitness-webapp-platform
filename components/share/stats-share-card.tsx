import type { Ref } from "react"

import type { ShareCardData, ShareCardFormatId } from "@/lib/share/stats-card"
import { SHARE_CARD_FORMATS } from "@/lib/share/stats-card"

/**
 * The card is exported as a fixed-size PNG, so its type scale is in absolute
 * pixels rather than the app's responsive steps: 1080px of canvas is 1080px of
 * canvas whether it was composed on a phone or a desktop. Colours still come
 * from tokens — the `share-*` context contract in `globals.css`, which is
 * deliberately theme-independent.
 */
type ShareCardMetrics = {
  caption: number
  footer: number
  gap: number
  headline: number
  highlight: number
  padding: number
  statDetail: number
  statLabel: number
  statValue: number
  unit: number
  wordmark: number
}

/**
 * Sized so the tallest possible card — the one with a personal-record strip —
 * still fits its canvas: the hero block takes the slack via `flex-1`, but the
 * header, tiles and footer are fixed and must leave room for it.
 */
const SHARE_CARD_METRICS: Record<ShareCardFormatId, ShareCardMetrics> = {
  square: {
    caption: 22,
    footer: 22,
    gap: 22,
    headline: 128,
    highlight: 26,
    padding: 64,
    statDetail: 18,
    statLabel: 20,
    statValue: 52,
    unit: 40,
    wordmark: 32,
  },
  story: {
    caption: 32,
    footer: 30,
    gap: 42,
    headline: 210,
    highlight: 40,
    padding: 88,
    statDetail: 25,
    statLabel: 28,
    statValue: 88,
    unit: 62,
    wordmark: 46,
  },
}

function BrandMark({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className="shrink-0 text-share-accent"
    >
      <rect x="1" y="1" width="22" height="22" rx="7" fill="currentColor" />
      <path d="M13.4 4.5 7 13.2h4.1L10.6 19.5 17 10.8h-4.1l.5-6.3Z" fill="var(--share-accent-ink)" />
    </svg>
  )
}

/**
 * The visual card itself — presentational only, no data fetching and no share
 * plumbing, so it renders identically in the preview and in the off-screen node
 * that gets serialised to PNG.
 */
export function StatsShareCard({
  cardRef,
  data,
  format,
}: {
  cardRef?: Ref<HTMLDivElement>
  data: ShareCardData
  format: ShareCardFormatId
}) {
  const size = SHARE_CARD_FORMATS[format]
  const metrics = SHARE_CARD_METRICS[format]

  return (
    <div
      ref={cardRef}
      data-slot="stats-share-card"
      className="relative isolate flex flex-col overflow-hidden bg-share-canvas font-sans text-share-foreground"
      style={{ height: size.height, padding: metrics.padding, width: size.width }}
    >
      {/* A single warm corner keeps the flat ink from reading as a screenshot. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -z-10"
        style={{
          background: "radial-gradient(circle at 100% 0%, var(--share-glow), transparent 62%)",
          inset: 0,
        }}
      />

      <header className="flex shrink-0 items-center justify-between" style={{ gap: metrics.gap }}>
        <span className="flex min-w-0 items-center" style={{ gap: metrics.wordmark * 0.4 }}>
          <BrandMark size={metrics.wordmark * 1.15} />
          <span
            className="truncate font-bold uppercase tracking-tight"
            style={{ fontSize: metrics.wordmark, letterSpacing: "-0.02em" }}
          >
            YeahBuddy
          </span>
        </span>
        <span
          className="shrink-0 whitespace-nowrap rounded-full border border-share-border font-medium text-share-secondary"
          style={{
            fontSize: metrics.caption,
            padding: `${metrics.caption * 0.5}px ${metrics.caption}px`,
          }}
        >
          {data.periodLabel}
        </span>
      </header>

      {/* `min-h-0` keeps an unusually tall hero (a long exercise name wrapping in
          the record strip) from pushing the tiles and footer off the canvas. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center" style={{ gap: metrics.gap, paddingTop: metrics.gap }}>
        <p
          className="font-medium uppercase text-share-muted"
          style={{ fontSize: metrics.caption, letterSpacing: "0.14em" }}
        >
          {data.headline.caption}
        </p>

        <p className="flex flex-wrap items-baseline font-mono font-semibold tnum" style={{ gap: metrics.gap * 0.5 }}>
          <span className="whitespace-nowrap" style={{ fontSize: metrics.headline, letterSpacing: "-0.045em", lineHeight: 0.85 }}>
            {data.headline.value}
          </span>
          {data.headline.unit ? (
            <span className="font-sans font-medium text-share-muted" style={{ fontSize: metrics.unit }}>
              {data.headline.unit}
            </span>
          ) : null}
        </p>
        <p className="font-medium text-share-secondary" style={{ fontSize: metrics.highlight }}>
          {data.headline.trend}
        </p>

        {data.highlight ? (
          <div
            className="flex items-center justify-between rounded-3xl bg-share-accent text-share-accent-ink"
            style={{
              gap: metrics.gap,
              marginTop: metrics.gap * 0.5,
              padding: `${metrics.highlight}px ${metrics.highlight * 1.3}px`,
            }}
          >
            <span className="min-w-0 truncate font-semibold" style={{ fontSize: metrics.highlight }}>
              {data.highlight.label}
            </span>
            <span
              className="shrink-0 whitespace-nowrap font-mono font-bold tnum"
              style={{ fontSize: metrics.highlight * 1.2 }}
            >
              {data.highlight.value}
            </span>
          </div>
        ) : null}
      </div>

      <dl className="grid shrink-0 grid-cols-2" style={{ gap: metrics.gap * 0.6 }}>
        {data.stats.map((stat) => (
          <div
            key={stat.label}
            className="min-w-0 rounded-3xl border border-share-border bg-share-surface"
            style={{ padding: metrics.statLabel * 1.4 }}
          >
            <dt className="truncate text-share-muted" style={{ fontSize: metrics.statLabel }}>
              {stat.label}
            </dt>
            <dd
              className="flex flex-wrap items-baseline font-mono font-semibold tnum"
              style={{ gap: metrics.statLabel * 0.35, marginTop: metrics.statLabel * 0.5 }}
            >
              <span className="whitespace-nowrap" style={{ fontSize: metrics.statValue, letterSpacing: "-0.03em", lineHeight: 1 }}>
                {stat.value}
              </span>
              {stat.unit ? (
                <span className="font-sans font-normal text-share-muted" style={{ fontSize: metrics.statDetail }}>
                  {stat.unit}
                </span>
              ) : null}
            </dd>
            {stat.detail ? (
              <dd
                className="truncate text-share-muted"
                style={{ fontSize: metrics.statDetail, marginTop: metrics.statLabel * 0.4 }}
              >
                {stat.detail}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>

      <footer
        className="flex shrink-0 items-center justify-between border-t border-share-border"
        style={{ fontSize: metrics.footer, gap: metrics.gap, marginTop: metrics.gap, paddingTop: metrics.gap }}
      >
        <span className="min-w-0 truncate font-semibold text-share-foreground">{data.athleteName}</span>
        <span className="shrink-0 whitespace-nowrap font-mono tnum text-share-muted">{data.stamp}</span>
      </footer>
    </div>
  )
}
