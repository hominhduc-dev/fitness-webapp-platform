import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Find a Coach",
  description: "Browse available coaches and send a connection request to start training with a professional.",
  robots: { index: false, follow: false },
}

export default async function FindCoachLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "trainee" })
  return children
}
