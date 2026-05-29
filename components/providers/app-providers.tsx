"use client"

import type { ReactNode } from "react"

import { AuthProvider } from "@/components/providers/auth-provider"
import { LocaleProvider } from "@/components/providers/locale-provider"
import type { AppProfile } from "@/lib/auth/types"
import type { AppLocale } from "@/lib/i18n/config"

type AppProvidersProps = {
  children: ReactNode
  initialLocale: AppLocale
  initialProfile?: AppProfile | null
  withAuth?: boolean
}

export function AppProviders({
  children,
  initialLocale,
  initialProfile = null,
  withAuth = true,
}: AppProvidersProps) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      {withAuth ? <AuthProvider initialProfile={initialProfile}>{children}</AuthProvider> : children}
    </LocaleProvider>
  )
}
