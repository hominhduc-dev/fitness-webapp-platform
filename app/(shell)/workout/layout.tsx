import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Workouts",
  description:
    "Browse and start your workouts. Access coach-assigned programs and personal routines, track sets, reps, and weights in real time.",
  robots: { index: false, follow: false },
}

export default async function WorkoutLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "trainee" })
  return children
}
