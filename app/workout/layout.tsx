import type { ReactNode } from "react"

import { AppProviders } from "@/components/providers/app-providers"
import { requireAppUser } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"

export default async function WorkoutSessionLayout({ children }: { children: ReactNode }) {
  const [locale, profile] = await Promise.all([getServerLocale(), requireAppUser({ role: "trainee" })])

  // Seeding the profile means a session page reopened from the offline page
  // cache renders without first fetching /api/auth/me, which cannot succeed.
  return (
    <AppProviders initialLocale={locale} initialProfile={profile}>
      {children}
    </AppProviders>
  )
}
