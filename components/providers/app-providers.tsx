"use client"

import type { ReactNode } from "react"

import { AuthProvider } from "@/components/providers/auth-provider"
import { LocaleProvider } from "@/components/providers/locale-provider"
import { ThemeProvider, type ThemeMode } from "@/components/providers/theme-provider"
import type { AppProfile } from "@/lib/auth/types"
import type { AppLocale } from "@/lib/i18n/config"

type AppProvidersProps = {
  children: ReactNode
  initialLocale: AppLocale
  initialProfile?: AppProfile | null
  initialTheme?: ThemeMode
  withAuth?: boolean
}

export function AppProviders({
  children,
  initialLocale,
  initialProfile = null,
  initialTheme,
  withAuth = true,
}: AppProvidersProps) {
  return (
    <ThemeProvider initialTheme={initialTheme}>
      <LocaleProvider initialLocale={initialLocale}>
        {withAuth ? <AuthProvider initialProfile={initialProfile}>{children}</AuthProvider> : children}
      </LocaleProvider>
    </ThemeProvider>
  )
}
