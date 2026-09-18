import type { ReactNode } from "react"

import { AppProviders } from "@/components/providers/app-providers"
import { requireAppUser } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"

/**
 * Deliberately outside `(shell)`: the wizard owns the whole screen, and the shell
 * is what redirects here, so nesting it would loop.
 */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const [locale, profile] = await Promise.all([getServerLocale(), requireAppUser({ role: "trainee" })])

  return (
    <AppProviders initialLocale={locale} initialProfile={profile}>
      {children}
    </AppProviders>
  )
}
