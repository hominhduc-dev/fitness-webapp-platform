import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Trainees",
  description: "View and manage your trainees. Monitor compliance, track individual progress, and provide personalized coaching.",
  robots: { index: false, follow: false },
}

export default async function CoachTraineesLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "coach" })
  return children
}
