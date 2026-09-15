"use client"

import { track } from "@vercel/analytics"

type RegistrationEvent = "form_view" | "form_submit" | "form_error" | "sign_up"

export function trackRegistrationEvent(event: RegistrationEvent, properties?: { method?: "email" | "google" | "apple"; email_confirmation_required?: boolean }) {
  // Never send names, email addresses, phone numbers, or error messages to analytics.
  track(event === "sign_up" ? "sign_up" : `registration_${event}`, properties)

  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
  gtag?.("event", event === "sign_up" ? "sign_up" : `registration_${event}`, properties ?? {})
}
