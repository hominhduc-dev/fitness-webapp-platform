import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export default async function CoachProgramsLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "coach" })
  return children
}
