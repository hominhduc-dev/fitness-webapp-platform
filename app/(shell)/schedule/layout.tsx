import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Workout Schedule",
  description:
    "Plan and manage your weekly workout schedule. Organize training sessions, rest days, and keep a consistent fitness routine.",
  robots: { index: false, follow: false },
}

export default async function ScheduleLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "trainee" })
  return children
}
