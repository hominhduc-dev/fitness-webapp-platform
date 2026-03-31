import type { Metadata } from "next"
import type { ReactNode } from "react"

import { requireAppUser } from "@/lib/auth/server"

export const metadata: Metadata = {
  title: "Meal Tracking",
  description:
    "Log your daily meals, track calories and macronutrients (protein, carbs, fats), and visualize your weekly nutrition trends.",
  robots: { index: false, follow: false },
}

export default async function MealsLayout({ children }: { children: ReactNode }) {
  await requireAppUser({ role: "trainee" })
  return children
}
