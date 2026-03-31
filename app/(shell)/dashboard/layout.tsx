import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your personalized fitness dashboard. View today's workout, nutrition summary, weekly stats, and recent activity at a glance.",
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "trainee" })
  return children
}
