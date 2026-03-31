import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { defaultLocale } from "@/lib/i18n/config"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yeahbuddy.fit"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "YeahBuddy Fitness - Your Fitness Companion",
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
    title: "YeahBuddy Fitness - Your Fitness Companion",
    description:
      "Track workouts, log meals, monitor weight progress, and connect with professional coaches to achieve your fitness goals.",
    images: [
      {
        url: "/fitness-person.png",
        width: 1200,
        height: 630,
        alt: "YeahBuddy Fitness - Your Fitness Companion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YeahBuddy Fitness - Your Fitness Companion",
    description:
      "Track workouts, log meals, monitor weight progress, and connect with professional coaches to achieve your fitness goals.",
    images: ["/fitness-person.png"],
    creator: "@yeahbuddyfit",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-light-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  category: "health & fitness",
}

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang={defaultLocale}>
      <head>
        <link rel="dns-prefetch" href="https://bljmubatdtvuomucqmoj.supabase.co" />
        <link rel="preconnect" href="https://bljmubatdtvuomucqmoj.supabase.co" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
