import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { defaultLocale } from "@/lib/i18n/config"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })

export const metadata: Metadata = {
  title: "YeahBuddy Fitness - Your Fitness Companion",
  description: "Track workouts, meals, and connect with coaches to achieve your fitness goals",
  generator: "v0.app",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
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
