import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Exercise Library",
  description: "Manage your personal exercise library and browse the shared catalogue before building training plans.",
  robots: { index: false, follow: false },
}

export default async function CoachExercisesLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "coach" })
  return children
}
