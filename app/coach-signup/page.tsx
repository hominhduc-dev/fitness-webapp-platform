import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { CoachSignupPanel } from "@/components/auth/coach-signup-panel"
import { AppProviders } from "@/components/providers/app-providers"
import { getRoleLandingPath } from "@/lib/auth/roles"
import { getServerAuthState } from "@/lib/auth/server"
import { getServerLocale } from "@/lib/i18n/server"

export const metadata: Metadata = {
  title: "Become a coach - YeahBuddy Fitness",
  description:
    "Apply for a YeahBuddy coach account: build training programs, assign them to your clients, and follow every trainee's progress in one workspace.",
  keywords: [
    "fitness coach app",
    "personal trainer software",
    "coach client management",
    "training program builder",
    "online coaching platform",
  ],
  openGraph: {
    title: "Become a YeahBuddy coach",
    description:
      "Build programs, assign them to clients, and follow every trainee's progress in one workspace. Coach accounts are reviewed before activation.",
    url: "/coach-signup",
    type: "website",
  },
  alternates: {
    canonical: "/coach-signup",
  },
}

export default async function CoachSignupPage() {
  const [{ profile }, locale] = await Promise.all([getServerAuthState(), getServerLocale()])

  // Someone already signed in has no use for a signup form.
  if (profile) {
    redirect(getRoleLandingPath(profile.role))
  }

  return (
    <AppProviders initialLocale={locale} initialTheme="light" withAuth={false}>
      <main className="min-h-[100dvh] bg-background text-foreground">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6 md:py-16">
          <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            YeahBuddy<span className="text-primary">.</span>
          </Link>

          <CoachSignupPanel />
        </div>
      </main>
    </AppProviders>
  )
}
