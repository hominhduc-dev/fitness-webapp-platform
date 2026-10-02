import type { Metadata } from "next"
import { Suspense, type ReactNode } from "react"

import { TraineeHubShell } from "@/components/coach/trainee-hub/trainee-hub-shell"
import { TraineeRoster } from "@/components/coach/trainee-hub/trainee-roster"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachTrainees } from "@/lib/fitness/api"

export const metadata: Metadata = {
  title: "Trainees",
  description: "View and manage your trainees. Monitor compliance, track individual progress, and provide personalized coaching.",
  robots: { index: false, follow: false },
}

/**
 * The roster lives in the layout, so moving from one trainee to the next only
 * renders the detail column: the list keeps its scroll, search and data.
 */
export default async function CoachTraineesLayout({ children }: { children: ReactNode }) {
  const { accessToken } = await requireAppSession({ role: "coach" })
  // A failed prefetch is not fatal: the roster fetches on the client instead.
  const initialTrainees = await fetchCoachTrainees(accessToken).catch(() => undefined)

  return (
    <TraineeHubShell
      roster={
        <Suspense>
          <TraineeRoster initialTrainees={initialTrainees} />
        </Suspense>
      }
    >
      {children}
    </TraineeHubShell>
  )
}
