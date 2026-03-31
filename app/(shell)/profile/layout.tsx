import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Profile",
  description:
    "Manage your profile settings, fitness goals, calorie targets, body measurements, and account preferences.",
  robots: { index: false, follow: false },
}

export default async function ProfileLayout({ children }: { children: ReactNode }) {
  await requireAppUser()
  return children
}
