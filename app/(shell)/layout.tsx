import type { ReactNode } from "react"

import { MobileNav } from "@/components/layout/mobile-nav"
import { SidebarClient } from "@/components/layout/sidebar-client"
import { AppProviders } from "@/components/providers/app-providers"
import { requireAppUser } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const [locale, profile] = await Promise.all([getServerLocale(), requireAppUser()])

  return (
    <AppProviders initialLocale={locale} initialProfile={profile}>
      <div className="flex min-h-screen bg-background">
        <SidebarClient role={profile.role} />

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 overflow-auto pb-20 md:pb-6">{children}</main>
          <MobileNav role={profile.role} />
        </div>
      </div>
    </AppProviders>
  )
}
