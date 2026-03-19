import type { ReactNode } from "react"

import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { requireAppUser } from "@/lib/auth/server"

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const profile = await requireAppUser()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={profile.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto pb-20 md:pb-6">{children}</main>
        <MobileNav role={profile.role} />
      </div>
    </div>
  )
}
