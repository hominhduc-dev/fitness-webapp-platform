import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Coach Stats",
  description: "Track headline numbers across your roster: active clients and authored programs.",
  robots: { index: false, follow: false },
}

export default async function CoachStatsLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "coach" })
  return children
}
