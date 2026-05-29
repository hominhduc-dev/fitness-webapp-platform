import type { ReactNode } from "react"

import { AppProviders } from "@/components/providers/app-providers"
import { requireAppUser } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"

export default async function WorkoutSessionLayout({ children }: { children: ReactNode }) {
  const [locale] = await Promise.all([getServerLocale(), requireAppUser({ role: "trainee" })])

  return (
    <AppProviders initialLocale={locale}>
      {children}
    </AppProviders>
  )
}
