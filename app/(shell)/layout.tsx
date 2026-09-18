import type { ReactNode } from "react"

import { ShellHeader } from "@/components/layout/shell-header"
import { ShellMain } from "@/components/layout/shell-main"
import { SidebarClient } from "@/components/layout/sidebar-client"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { PushPermissionPrompt } from "@/components/pwa/push-permission-prompt"
import { AppProviders } from "@/components/providers/app-providers"
import { CoachRoutePrefetch } from "@/components/providers/coach-route-prefetch"
import { TraineeRoutePrefetch } from "@/components/providers/trainee-route-prefetch"
import { ResumeWorkoutCard } from "@/components/workout/resume-workout-card"
import { requireAppUser } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const [locale, profile] = await Promise.all([getServerLocale(), requireAppUser()])
  return (
    <AppProviders initialLocale={locale} initialProfile={profile}>
      {profile.role === "trainee" ? <TraineeRoutePrefetch userId={profile.id} /> : null}
      {profile.role === "coach" ? <CoachRoutePrefetch userId={profile.id} /> : null}
      <div className="app-shell flex min-h-[100dvh] bg-background">
        <SidebarClient role={profile.role} />

        <div className="flex min-w-0 flex-1 flex-col">
          <ShellHeader role={profile.role} />
          <ShellMain>
            <PullToRefresh>{children}</PullToRefresh>
          </ShellMain>
        </div>

        {profile.role === "trainee" && <ResumeWorkoutCard />}
        <PushPermissionPrompt />
      </div>
    </AppProviders>
  )
}
