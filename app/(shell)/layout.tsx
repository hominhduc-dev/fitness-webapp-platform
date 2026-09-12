import type { ReactNode } from "react"

import { AIChatBubble } from "@/components/ai/chat-bubble"
import { ShellHeader } from "@/components/layout/shell-header"
import { SidebarClient } from "@/components/layout/sidebar-client"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { AppProviders } from "@/components/providers/app-providers"
import { ResumeWorkoutCard } from "@/components/workout/resume-workout-card"
import { requireAppUser } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const [locale, profile] = await Promise.all([getServerLocale(), requireAppUser()])
  // The AI bubble is a fixed top-right button on phones (it only moves to the
  // bottom at md, where the mobile nav no longer owns that corner). Without this
  // offset it lands on top of every page's h1.
  const hasMobileTopBubble = profile.role === "trainee"

  return (
    <AppProviders initialLocale={locale} initialProfile={profile}>
      <div className="app-shell flex min-h-[100dvh] bg-background">
        <SidebarClient role={profile.role} />

        <div className="flex min-w-0 flex-1 flex-col">
          <ShellHeader role={profile.role} />
          <main
            className={cn(
              "flex-1 overflow-auto pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
              hasMobileTopBubble && "pt-[calc(3rem+env(safe-area-inset-top))] md:pt-0",
            )}
          >
            <PullToRefresh>{children}</PullToRefresh>
          </main>
        </div>

        {profile.role === "trainee" && <AIChatBubble />}
        {profile.role === "trainee" && <ResumeWorkoutCard />}
      </div>
    </AppProviders>
  )
}
