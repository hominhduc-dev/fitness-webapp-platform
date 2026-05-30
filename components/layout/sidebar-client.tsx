"use client"

import dynamic from "next/dynamic"
import type { AppRole } from "@/lib/auth/types"

const SidebarLazy = dynamic(
  () => import("@/components/layout/sidebar").then((m) => ({ default: m.Sidebar })),
  { ssr: false },
)

export function SidebarClient({ role }: { role: AppRole }) {
  return <SidebarLazy role={role} />
}
