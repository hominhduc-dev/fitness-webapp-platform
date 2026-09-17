"use client"

import type { ReactNode } from "react"

import { OfflineSyncManager } from "@/components/offline/offline-sync-manager"
import { PushSubscriptionAccountSync } from "@/components/pwa/push-subscription-account-sync"
import { AuthProvider } from "@/components/providers/auth-provider"
import { LocaleProvider } from "@/components/providers/locale-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { ThemeProvider, type ThemeMode } from "@/components/providers/theme-provider"
import { TimeZoneCookieSync } from "@/components/providers/time-zone-cookie-sync"
import { ToastProvider } from "@/components/providers/toast-provider"
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
    // QueryProvider sits outermost so AuthProvider can reach the cache: signing
    // out has to clear it, and that has to happen from inside AuthProvider.
    <QueryProvider>
      <TimeZoneCookieSync />
      <ThemeProvider initialTheme={initialTheme}>
        <LocaleProvider initialLocale={initialLocale}>
          {/* Inside LocaleProvider: the dismiss label is translated. */}
          <ToastProvider>
            {withAuth ? (
              <AuthProvider initialProfile={initialProfile}>
                <OfflineSyncManager />
                <PushSubscriptionAccountSync />
                {children}
              </AuthProvider>
            ) : children}
          </ToastProvider>
        </LocaleProvider>
      </ThemeProvider>
    </QueryProvider>
  )
}
