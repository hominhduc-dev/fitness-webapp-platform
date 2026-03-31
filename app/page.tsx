import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { LandingPage } from "@/components/landing/landing-page"
import { getServerAuthState } from "@/lib/auth/server"
import { getRoleLandingPath } from "@/lib/auth/roles"
import { LocaleProvider } from "@/components/providers/locale-provider"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"

export const metadata: Metadata = {
  title: "YeahBuddy Fitness - Your Fitness Companion",
  description:
    "The all-in-one fitness app to track workouts, log meals, monitor weight, and connect with professional coaches. Start your fitness journey today.",
  keywords: [
    "fitness app",
    "workout tracker",
    "meal log",
    "weight tracker",
    "calorie tracker",
    "fitness coach",
    "nutrition app",
    "gym app",
    "health tracker",
    "macro tracker",
  ],
  openGraph: {
    title: "YeahBuddy Fitness - Your Fitness Companion",
    description:
      "Track workouts, log meals, monitor your weight, and connect with professional coaches. Everything you need to reach your fitness goals.",
    url: "/",
    type: "website",
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
      "vi-VN": "/?lang=vi",
    },
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "YeahBuddy Fitness",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  description:
    "The all-in-one fitness app to track workouts, log meals, monitor weight, and connect with professional coaches.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Workout tracking",
    "Meal logging",
    "Calorie and macro tracking",
    "Weight tracking",
    "Coach connection",
    "Progress analytics",
    "Workout scheduling",
  ],
  audience: {
    "@type": "Audience",
    audienceType: "Fitness enthusiasts, gym-goers, athletes",
  },
}

export default async function Home() {
  const [{ profile }, locale, messages] = await Promise.all([getServerAuthState(), getServerLocale(), getServerMessages()])

  if (profile) {
    redirect(getRoleLandingPath(profile.role))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LocaleProvider initialLocale={locale}>
        <LandingPage locale={locale} messages={messages} />
      </LocaleProvider>
    </>
  )
}
