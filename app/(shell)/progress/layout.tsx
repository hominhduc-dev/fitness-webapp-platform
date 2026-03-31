import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Progress & Analytics",
  description:
    "Visualize your fitness progress. Track strength gains, muscle group distribution, weekly training volume, and personal records over time.",
  robots: { index: false, follow: false },
}

export default async function ProgressLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "trainee" })
  return children
}
