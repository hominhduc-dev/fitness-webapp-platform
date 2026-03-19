import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "trainee" })
  return children
}
