import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { ShellHeader } from "@/components/layout/shell-header"
import { ShellMain } from "@/components/layout/shell-main"
import { SidebarClient } from "@/components/layout/sidebar-client"
import { PullToRefresh } from "@/components/pull-to-refresh"
import { PushPermissionPrompt } from "@/components/pwa/push-permission-prompt"
import { AppProviders } from "@/components/providers/app-providers"
import { CoachRoutePrefetch } from "@/components/providers/coach-route-prefetch"
import { ContextualProductTour } from "@/components/onboarding/contextual-product-tour"
import { TraineeRoutePrefetch } from "@/components/providers/trainee-route-prefetch"
import { ResumeWorkoutCard } from "@/components/workout/resume-workout-card"
import { requireAppUser } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"
import { isProfileOnboarded, ONBOARDING_SKIP_COOKIE } from "@/lib/onboarding/state"

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const [locale, profile, cookieStore] = await Promise.all([getServerLocale(), requireAppUser(), cookies()])

  // A trainee whose body stats are missing lands in the wizard first; dismissing
  // it sets the cookie, so nobody is sent back here twice. Coaches and admins
  // have no body stats to collect.
  if (
    profile.role === "trainee"
    && !isProfileOnboarded(profile)
    && cookieStore.get(ONBOARDING_SKIP_COOKIE)?.value !== "1"
  ) {
    redirect("/onboarding")
  }

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
        <ContextualProductTour role={profile.role} />
      </div>
    </AppProviders>
  )
}
