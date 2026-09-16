"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, Phone, ShieldCheck, User } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trackRegistrationEvent } from "@/lib/analytics/registration"
import { ApiError, registerRequest } from "@/lib/auth/api"
import { getAppBaseUrl, getSupabasePublicConfigError } from "@/lib/supabase/config"

/**
 * Coach self-signup. A coach account is created locked and waits in the admin
 * queue, so unlike the trainee modal this form never signs anyone in: it ends
 * on the pending screen and the backend withholds the session.
 */
export function CoachSignupForm() {
  const { messages } = useLocale()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const supabaseConfigError = getSupabasePublicConfigError()

  useEffect(() => {
    trackRegistrationEvent("form_view", { method: "email", role: "coach" })
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    trackRegistrationEvent("form_submit", { method: "email", role: "coach" })

    if (supabaseConfigError) {
      setError(supabaseConfigError)
      return
    }

    if (password.length < 6) {
      trackRegistrationEvent("form_error", { method: "email", role: "coach" })
      setError(messages.auth.passwordTooShort)
      return
    }

    setIsSubmitting(true)

    try {
      // Confirming the email lands on the sign-in modal rather than the app: the
      // account stays locked until an admin approves it, and signing in there is
      // what surfaces that message.
      const redirectUrl = new URL("/auth/callback", getAppBaseUrl())
      redirectUrl.searchParams.set("next", "/?auth=login")
      const response = await registerRequest({
        email,
        name,
        password,
        phone: phone.trim() || undefined,
        redirectTo: redirectUrl.toString(),
        role: "coach",
      })

      trackRegistrationEvent("sign_up", {
        method: "email",
        email_confirmation_required: Boolean(response.requiresEmailConfirmation || !response.session),
        role: "coach",
      })

      setIsSubmitted(true)
    } catch (rawError) {
      trackRegistrationEvent("form_error", { method: "email", role: "coach" })
      setError(
        rawError instanceof ApiError || rawError instanceof Error ? rawError.message : messages.auth.registerFailed,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <span aria-hidden="true" className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-primary-soft">
          <CheckCircle2 className="size-6 text-primary" />
        </span>
        <h2 className="text-xl font-semibold tracking-[-0.01em]">{messages.auth.coachSignupPendingTitle}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {messages.auth.coachSignupPendingCopy}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">{messages.auth.coachSignupBackHome}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-[-0.01em]">{messages.auth.coachSignupFormTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{messages.auth.coachSignupFormSubtitle}</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="coach-name">{messages.auth.fullName}</Label>
          <div className="relative">
            <User aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="coach-name"
              autoComplete="name"
              className="h-11 pl-10 sm:h-10"
              onChange={(event) => setName(event.target.value)}
              placeholder={messages.auth.fullNamePlaceholder}
              required
              value={name}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="coach-email">{messages.auth.email}</Label>
          <div className="relative">
            <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="coach-email"
              autoComplete="email"
              className="h-11 pl-10 sm:h-10"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={messages.auth.emailPlaceholder}
              required
              type="email"
              value={email}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="coach-phone">{messages.auth.phone}</Label>
          <div className="relative">
            <Phone aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="coach-phone"
              autoComplete="tel"
              className="h-11 pl-10 sm:h-10"
              onChange={(event) => setPhone(event.target.value)}
              placeholder={messages.auth.phonePlaceholder}
              type="tel"
              value={phone}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="coach-password">{messages.auth.passwordLabel}</Label>
          <div className="relative">
            <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="coach-password"
              autoComplete="new-password"
              className="h-11 pl-10 pr-10 sm:h-10"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              type="button"
              aria-label={showPassword ? messages.auth.hidePassword : messages.auth.showPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="coach-terms"
            checked={acceptTerms}
            className="mt-0.5"
            onCheckedChange={(checked) => setAcceptTerms(Boolean(checked))}
          />
          <p className="min-w-0 flex-1 text-xs leading-relaxed sm:text-sm">
            <label htmlFor="coach-terms" className="cursor-pointer">
              {messages.auth.termsPrefix}
            </label>{" "}
            <Link href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {messages.auth.terms}
            </Link>{" "}
            {messages.auth.and}{" "}
            <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {messages.auth.privacy}
            </Link>
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive-soft p-3 text-sm text-destructive-text">
            {error}
          </p>
        ) : null}

        <Button className="h-12 w-full text-base sm:h-11 sm:text-sm" disabled={isSubmitting || !acceptTerms} type="submit">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {messages.auth.coachSignupSubmitting}
            </>
          ) : (
            <>
              {messages.auth.coachSignupSubmit}
              <ArrowRight className="ml-2 size-4" />
            </>
          )}
        </Button>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          {messages.auth.coachSignupReviewNote}
        </p>
      </form>
    </div>
  )
}
