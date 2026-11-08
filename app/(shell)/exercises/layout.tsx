import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Exercise Library",
  description: "Explore exercises by muscle group, equipment and activity, and watch movement demonstrations.",
  robots: { index: false, follow: false },
}

export default async function ExercisesLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "trainee" })
  return children
}
