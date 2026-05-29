import type { ReactNode } from "react"

import { AuthProvider } from "@/components/providers/auth-provider"
import { LocaleProvider } from "@/components/providers/locale-provider"
import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { requireAppUser } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const [locale, profile] = await Promise.all([getServerLocale(), requireAppUser()])

  return (
    <LocaleProvider initialLocale={locale}>
      <AuthProvider initialProfile={profile}>
        <div className="flex min-h-screen bg-background">
          <Sidebar role={profile.role} />

          <div className="flex min-w-0 flex-1 flex-col">
            {profile.role === "admin" ? <Header /> : null}
            <main className="flex-1 overflow-auto pb-20 md:pb-6">{children}</main>
            <MobileNav role={profile.role} />
          </div>
        </div>
      </AuthProvider>
    </LocaleProvider>
  )
}
