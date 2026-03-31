import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Weight Tracking",
  description:
    "Log and monitor your body weight over time. View trends, compare weekly progress, and stay on track toward your weight goals.",
  robots: { index: false, follow: false },
}

export default async function TrackWeightLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "trainee" })
  return children
}
