import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Admin Console",
  description: "System administration: manage users, the exercise library, programs, and coach connection requests.",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "admin" })
  return children
}
