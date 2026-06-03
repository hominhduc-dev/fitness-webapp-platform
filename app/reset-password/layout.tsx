import type { Metadata } from "next"
import type { ReactNode } from "react"

import { AppProviders } from "@/components/providers/app-providers"
import { getServerLocale } from "@/lib/i18n/server"

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your YeahBuddy Fitness account.",
  robots: { index: false, follow: false },
}

export default async function ResetPasswordLayout({ children }: { children: ReactNode }) {
  const locale = await getServerLocale()

  return (
    <AppProviders initialLocale={locale} withAuth={false}>
      {children}
    </AppProviders>
  )
}
