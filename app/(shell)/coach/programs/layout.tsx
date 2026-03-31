import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Programs",
  description: "Create, edit, and assign workout programs to your trainees. Build structured training plans with exercises, sets, and reps.",
  robots: { index: false, follow: false },
}

export default async function CoachProgramsLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "coach" })
  return children
}
