"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, Phone, ShieldCheck, User } from "lucide-react"

import { GoogleIcon } from "@/components/ui/brand-icons"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trackRegistrationEvent } from "@/lib/analytics/registration"
import { ApiError, registerRequest } from "@/lib/auth/api"
import { getOptionalBrowserSupabaseClient } from "@/lib/supabase/client"
import { getAppBaseUrl, getSupabasePublicConfigError } from "@/lib/supabase/config"

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""

export type CoachSignupResult = "pending" | "check-email" | "email-return" | "email-confirmed" | "email-failed"

function getCoachEmailCallbackUrl() {
  const url = new URL("/auth/callback", getAppBaseUrl())
  url.searchParams.set("flow", "coach-email")
  return url.toString()
}

/**
 * Coach self-signup. A coach account is created locked and waits in the admin
 * queue, so unlike the trainee modal this form never signs anyone in: it ends
 * on the pending screen and the backend withholds the session.
 */
export function CoachSignupForm({
  defaultError = null,
  initialResult = null,
}: {
  /** Set when the OAuth callback bounced back with a failure. */
  defaultError?: string | null
  initialResult?: CoachSignupResult | null
} = {}) {
  const { messages } = useLocale()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(defaultError)
  const [submittedResult, setSubmittedResult] = useState<CoachSignupResult | null>(null)
  const result = submittedResult ?? initialResult
  const turnstileRef = useRef<TurnstileInstance | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaEnabled = TURNSTILE_SITE_KEY.length > 0
  const supabaseConfigError = getSupabasePublicConfigError()

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null)
    turnstileRef.current?.reset()
  }, [])

  useEffect(() => {
    trackRegistrationEvent("form_view", { method: "email", role: "coach" })
  }, [])

  useEffect(() => {
    if (result !== "email-return") return

    // Express starts Supabase email signup without a PKCE verifier, so a
    // successful confirmation returns the signup result in a URL fragment.
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const hasError = ["error", "error_code", "error_description"].some((key) => fragment.has(key))
    // This is only a display hint. The token is never read into an auth session.
    const confirmed = !hasError && fragment.get("type") === "signup" && Boolean(fragment.get("access_token"))
    window.location.replace(`/coach-signup?status=${confirmed ? "email-confirmed" : "email-failed"}`)
  }, [result])

  /**
   * Google never sees our role, so the callback URL carries it and the callback
   * claims it server-side. The account comes back locked either way, which is
   * why this leaves on the pending screen instead of signing anyone in.
   */
  const handleGoogleSignup = async () => {
    setError(null)

    const supabase = getOptionalBrowserSupabaseClient()

    if (!supabase) {
      setError(supabaseConfigError ?? messages.auth.supabaseNotConfigured)
      return
    }

    setIsGoogleRedirecting(true)
    trackRegistrationEvent("form_submit", { method: "google", role: "coach" })

    const redirectUrl = new URL("/auth/callback", getAppBaseUrl())
    redirectUrl.searchParams.set("role", "coach")

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      options: { redirectTo: redirectUrl.toString() },
      provider: "google",
    })

    if (oauthError) {
      trackRegistrationEvent("form_error", { method: "google", role: "coach" })
      setError(oauthError.message)
      setIsGoogleRedirecting(false)
    }
  }

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

    if (password !== confirmPassword) {
      trackRegistrationEvent("form_error", { method: "email", role: "coach" })
      setError(messages.auth.passwordMismatch)
      return
    }

    setIsSubmitting(true)

    try {
      const response = await registerRequest({
        captchaToken: captchaToken ?? undefined,
        email,
        name,
        password,
        phone: phone.trim() || undefined,
        redirectTo: getCoachEmailCallbackUrl(),
        role: "coach",
      })

      trackRegistrationEvent("sign_up", {
        method: "email",
        email_confirmation_required: Boolean(response.requiresEmailConfirmation),
        role: "coach",
      })

      setSubmittedResult(response.requiresEmailConfirmation ? "check-email" : "pending")
    } catch (rawError) {
      trackRegistrationEvent("form_error", { method: "email", role: "coach" })
      setError(
        rawError instanceof ApiError || rawError instanceof Error ? rawError.message : messages.auth.registerFailed,
      )
    } finally {
      resetCaptcha()
      setIsSubmitting(false)
    }
  }

  if (result) {
    const [title, description] = {
      pending: [messages.auth.coachSignupPendingTitle, messages.auth.coachSignupPendingCopy],
      "check-email": [messages.auth.coachSignupCheckEmailTitle, messages.auth.coachSignupCheckEmailCopy],
      "email-return": [messages.auth.coachSignupCheckingEmail, null],
      "email-confirmed": [messages.auth.coachSignupEmailConfirmedTitle, messages.auth.coachSignupEmailConfirmedCopy],
      "email-failed": [messages.auth.coachSignupEmailFailedTitle, messages.auth.coachSignupEmailFailedCopy],
    }[result]
    const Icon = result === "check-email" || result === "email-failed" ? Mail
      : result === "email-return" ? Loader2 : CheckCircle2
    return (
      <div role="status" className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
        <span aria-hidden="true" className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-primary-soft">
          <Icon className={result === "email-return" ? "size-6 animate-spin text-primary" : "size-6 text-primary"} />
        </span>
        <h2 className="text-xl font-semibold tracking-[-0.01em]">{title}</h2>
        {description && <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
        {result === "email-failed" && (
          <a className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline" href="mailto:hoominhduc@gmail.com">
            {messages.auth.coachSignupContactSupport}
          </a>
        )}
        {result !== "email-return" && (
          <Button asChild variant="outline" className={result === "email-failed" ? "mx-auto mt-2 flex w-fit" : "mt-6"}>
            {result === "check-email" ? (
              <Link href="/">{messages.auth.coachSignupBackHome}</Link>
            ) : (
              <Link href="/?auth=login">{messages.auth.login}</Link>
            )}
          </Button>
        )}
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

        <div className="space-y-2">
          <Label htmlFor="coach-confirm-password">{messages.auth.confirmPasswordLabel}</Label>
          <div className="relative">
            <Lock aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="coach-confirm-password"
              autoComplete="new-password"
              className="h-11 pl-10 pr-10 sm:h-10"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              required
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? messages.auth.hidePassword : messages.auth.showPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowConfirmPassword((current) => !current)}
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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

        {captchaEnabled ? (
          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              onExpire={() => setCaptchaToken(null)}
              onSuccess={setCaptchaToken}
              options={{ size: "flexible", theme: "auto" }}
              siteKey={TURNSTILE_SITE_KEY}
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive-soft p-3 text-sm text-destructive-text">
            {error}
          </p>
        ) : null}

        <Button
          className="h-12 w-full text-base sm:h-11 sm:text-sm"
          disabled={isSubmitting || isGoogleRedirecting || !acceptTerms || (captchaEnabled && !captchaToken)}
          type="submit"
        >
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

        <div className="relative py-1">
          <span aria-hidden="true" className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </span>
          <span className="relative mx-auto block w-fit bg-card px-2 text-center text-xs uppercase text-muted-foreground">
            {messages.auth.signUpWith}
          </span>
        </div>

        <Button
          className="h-12 w-full text-base sm:h-11 sm:text-sm"
          disabled={isSubmitting || isGoogleRedirecting || !acceptTerms}
          onClick={() => void handleGoogleSignup()}
          type="button"
          variant="outline"
        >
          {isGoogleRedirecting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <GoogleIcon className="mr-2 size-4" />
          )}
          Google
        </Button>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          {messages.auth.coachSignupReviewNote}
        </p>
      </form>
    </div>
  )
}
