import type { ReactNode } from "react"

import { AppProviders } from "@/components/providers/app-providers"
import { getServerLocale } from "@/lib/i18n/server"

/**
 * Providers for the /dev preview routes.
 *
 * These pages sit outside the (shell) group so they render without a session,
 * but components under preview still call useLocale()/useTheme(), which throw
 * without a provider. Auth is left off — nothing here reads user data.
 */
export default async function DevLayout({ children }: { children: ReactNode }) {
  const locale = await getServerLocale()

  return (
    <AppProviders initialLocale={locale} withAuth={false}>
      {children}
    </AppProviders>
  )
}
