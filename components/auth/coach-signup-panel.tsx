"use client"

import Link from "next/link"
import { BarChart3, Check, ListChecks, Users } from "lucide-react"

import { CoachSignupForm } from "@/components/auth/coach-signup-form"
import { useLocale } from "@/components/providers/locale-provider"

/** The marketing half of /coach-signup, next to the form itself. */
export function CoachSignupPanel() {
  const { messages } = useLocale()
  const benefits = [
    { icon: ListChecks, label: messages.landing.coachBenefitPlan },
    { icon: BarChart3, label: messages.landing.coachBenefitProgress },
    { icon: Users, label: messages.landing.coachBenefitOverview },
  ]

  return (
    <div className="mt-8 grid items-start gap-8 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
      <div className="min-w-0">
        <p className="font-mono text-micro font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {messages.landing.trainerEyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.025em] md:text-4xl">
          {messages.auth.coachSignupTitle}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          {messages.auth.coachSignupSubtitle}
        </p>

        <ul className="mt-8 space-y-3">
          {benefits.map((benefit) => (
            <li key={benefit.label} className="flex items-start gap-3">
              <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft">
                <Check className="size-3.5 text-primary" />
              </span>
              <span className="text-sm leading-relaxed">{benefit.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 space-y-2 text-sm text-muted-foreground">
          <p>
            {messages.auth.coachSignupHasAccount}{" "}
            <Link href="/?auth=login" className="font-medium text-primary hover:underline">
              {messages.auth.login}
            </Link>
          </p>
          <p>
            {messages.auth.coachSignupTraineePrompt}{" "}
            <Link href="/?auth=register" className="font-medium text-primary hover:underline">
              {messages.auth.coachSignupTraineeCta}
            </Link>
          </p>
        </div>
      </div>

      <CoachSignupForm />
    </div>
  )
}
