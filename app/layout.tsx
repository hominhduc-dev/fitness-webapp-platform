import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/components/providers/auth-provider"
import { LocaleProvider } from "@/components/providers/locale-provider"
import { getServerLocale } from "@/lib/i18n/server"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "YeahBuddy Fitness - Your Fitness Companion",
  description: "Track workouts, meals, and connect with coaches to achieve your fitness goals",
    generator: 'v0.app'
}

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getServerLocale()

  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}>
        <LocaleProvider initialLocale={locale}>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
        <Analytics />
      </body>
    </html>
  )
}
