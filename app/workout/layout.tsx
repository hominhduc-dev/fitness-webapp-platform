import type { ReactNode } from "react"

import { ContextualProductTour } from "@/components/onboarding/contextual-product-tour"
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
      {/* These routes sit outside the (shell) group, which is the only other
          place the tour is mounted — without this the session screen has no
          tour at all, whatever is registered for its path. */}
      <ContextualProductTour role={profile.role} />
    </AppProviders>
  )
}
