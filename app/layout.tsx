import type React from "react"
import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar"
import { LiquidGlassFilters } from "@/components/ui/liquid-glass-filters"
import { defaultLocale } from "@/lib/i18n/config"
import "./globals.css"

// -- Lift typography ---------------------------------------------------
// Geist for everything UI · Geist Mono for tabular data, labels, timers.
// Both exposed as CSS variables so Tailwind v4's @theme inline can wire
// them up as --font-sans / --font-mono in globals.css.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["400", "500", "600"],
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yeahbuddy.fit"
const isVercelRuntime = process.env.VERCEL === "1"
const gaMeasurementId = /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "")
  ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  : null
const themeInitScript = `
(function() {
  try {
    var storageKey = "yeahbuddy-theme";
    var storedTheme = window.localStorage.getItem(storageKey);
    // "glass" and "midnight" were extra themes before the liquid-glass
    // material became universal. Both were dark-family, so migrate rather
    // than let them fall through to light. Mirrors migrateStoredTheme() in
    // theme-provider.tsx.
    if (storedTheme === "glass" || storedTheme === "midnight") {
      storedTheme = "dark";
      window.localStorage.setItem(storageKey, storedTheme);
    }
    if (storedTheme === "sport") {
      storedTheme = "electric-blue";
      window.localStorage.setItem(storageKey, storedTheme);
    }
    var paletteThemes = ["performance-green", "electric-blue", "volt-lime", "iron-orange", "black-volt", "crimson-performance"];
    var isKnownTheme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" || paletteThemes.indexOf(storedTheme) !== -1;
    var theme = isKnownTheme ? storedTheme : "light";
    // The public marketing route has a fixed light art direction. Keep the
    // stored preference untouched so authenticated routes can restore it.
    if (window.location.pathname === "/") theme = "light";
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolvedTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
    var root = document.documentElement;
    // Mirrors applyThemeToDocument() in
    // components/providers/theme-provider.tsx — keep the two in sync.
    var isDarkTheme = resolvedTheme === "dark" || resolvedTheme === "black-volt";
    root.classList.remove("sport");
    paletteThemes.forEach(function (paletteTheme) { root.classList.remove(paletteTheme); });
    root.classList.toggle("dark", isDarkTheme);
    if (paletteThemes.indexOf(resolvedTheme) !== -1) root.classList.add(resolvedTheme);
    root.style.colorScheme = isDarkTheme ? "dark" : "light";
    var themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      var themeColors = {
        light: "#e8ecf3",
        "performance-green": "#f5f8f6",
        "electric-blue": "#f3f6fc",
        "volt-lime": "#f3f6f5",
        "iron-orange": "#faf9f7",
        "black-volt": "#0d0f0e",
        "crimson-performance": "#f8f8f7",
        dark: "#080a0f"
      };
      themeColor.setAttribute("content", themeColors[resolvedTheme] || themeColors.light);
    }
    // -- Liquid glass capability probe --------------------------------
    // Refraction rides on an SVG filter referenced from backdrop-filter.
    // Only Chromium actually resolves url(#id) there: Safari reports support
    // then paints nothing, Firefox drops it. CSS.supports() cannot tell those
    // apart, so gate on the engine and let everyone else keep frosted blur.
    // Runs pre-paint, so there is no flash between the two materials.
    var ua = navigator.userAgent;
    var brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    var isChromium = brands.some(function (entry) { return entry.brand === "Chromium"; })
      || (/(Chrome|Chromium|Edg)\\/[0-9]/.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPT)\\//.test(ua));
    var opaquePreferred = window.matchMedia && window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
    if (isChromium && !opaquePreferred && window.CSS && CSS.supports("backdrop-filter", "url(#lg-sheet)")) {
      root.dataset.liquidGlass = "on";
    }
  } catch (error) {}
})();
`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "YeahBuddy Fitness — Log the set. Move on.",
    template: "%s | YeahBuddy Fitness",
  },
  description:
    "Track workouts, log meals, monitor weight progress, and connect with professional coaches to achieve your fitness goals. Your all-in-one fitness companion.",
  keywords: [
    "fitness app",
    "workout tracker",
    "meal logging",
    "weight tracking",
    "calorie counter",
    "fitness coach",
    "gym tracker",
    "nutrition tracker",
    "body weight log",
    "exercise tracker",
    "macro tracker",
    "personal trainer",
    "fitness goals",
    "strength training",
  ],
  authors: [{ name: "YeahBuddy Fitness" }],
  creator: "YeahBuddy Fitness",
  publisher: "YeahBuddy Fitness",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "vi_VN",
    url: siteUrl,
    siteName: "YeahBuddy Fitness",
    title: "YeahBuddy Fitness — Log the set. Move on.",
    description:
      "Track workouts, log meals, monitor weight progress, and connect with professional coaches to achieve your fitness goals.",
    images: [
      {
        url: "/og-image.png",
        width: 1536,
        height: 1024,
        alt: "YeahBuddy Fitness — Your Fitness Companion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YeahBuddy Fitness — Log the set. Move on.",
    description:
      "Track workouts, log meals, monitor weight progress, and connect with professional coaches to achieve your fitness goals.",
    images: ["/og-image.png"],
    creator: "@yeahbuddyfit",
  },
  icons: {
    icon: [
      { url: "/favicon-yeahbuddy/favicon.ico" },
      { url: "/favicon-yeahbuddy/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-yeahbuddy/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-yeahbuddy/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-yeahbuddy/android-icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/favicon-yeahbuddy/apple-icon-57x57.png", sizes: "57x57", type: "image/png" },
      { url: "/favicon-yeahbuddy/apple-icon-60x60.png", sizes: "60x60", type: "image/png" },
      { url: "/favicon-yeahbuddy/apple-icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/favicon-yeahbuddy/apple-icon-76x76.png", sizes: "76x76", type: "image/png" },
      { url: "/favicon-yeahbuddy/apple-icon-114x114.png", sizes: "114x114", type: "image/png" },
      { url: "/favicon-yeahbuddy/apple-icon-120x120.png", sizes: "120x120", type: "image/png" },
      { url: "/favicon-yeahbuddy/apple-icon-144x144.png", sizes: "144x144", type: "image/png" },
      { url: "/favicon-yeahbuddy/apple-icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/favicon-yeahbuddy/apple-icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon-yeahbuddy/favicon.ico",
  },
  manifest: "/manifest.json",
  category: "health & fitness",
  // Windows tiles (msapplication) — favicon set referenced via browserconfig
  other: {
    "msapplication-TileColor": "#e8ecf3",
    "msapplication-TileImage": "/favicon-yeahbuddy/ms-icon-144x144.png",
    "msapplication-config": "/browserconfig.xml",
  },
  // -- iOS "Add to Home Screen" — run fullscreen like a native app -----
  appleWebApp: {
    capable: true,
    title: "YeahBuddy",
    statusBarStyle: "default",
  },
}

export const viewport: Viewport = {
  themeColor: "#e8ecf3",
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available — WCAG 1.4.4 wants it, and iOS Safari has
  // ignored `user-scalable=no` since iOS 10 anyway. The two reasons to block it
  // are handled properly instead: the 16px input floor above stops focus
  // auto-zoom, and `touch-action: manipulation` in globals.css keeps taps
  // instant by opting controls out of double-tap zoom only.
  viewportFit: "cover", // let content extend under the notch; pair with env(safe-area-inset-*)
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="dns-prefetch" href="https://bljmubatdtvuomucqmoj.supabase.co" />
        <link rel="preconnect" href="https://bljmubatdtvuomucqmoj.supabase.co" crossOrigin="anonymous" />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}>
        <LiquidGlassFilters />
        <ServiceWorkerRegistrar />
        {children}
        {gaMeasurementId ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} window.gtag = gtag; gtag('js', new Date()); gtag('config', ${JSON.stringify(gaMeasurementId)});`}
            </Script>
          </>
        ) : null}
        {isVercelRuntime ? <Analytics /> : null}
        {isVercelRuntime ? <SpeedInsights /> : null}
      </body>
    </html>
  )
}
