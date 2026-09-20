"use client"

import type React from "react"

import { startTransition, useCallback, useEffect, useRef, useState } from "react"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, X, AlertCircle, CheckCircle } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BrandLogo } from "@/components/ui/brand-logo"
import { GoogleIcon } from "@/components/ui/brand-icons"
import { Checkbox } from "@/components/ui/checkbox"
import { useLocale } from "@/components/providers/locale-provider"
import {
  ApiError,
  forgotPasswordRequest,
  loginRequest,
  registerRequest,
} from "@/lib/auth/api"
import type { AppRole } from "@/lib/auth/types"
import { getRoleLandingPath } from "@/lib/auth/roles"
import { getOptionalBrowserSupabaseClient } from "@/lib/supabase/client"
import { getAppBaseUrl, getSupabasePublicConfigError } from "@/lib/supabase/config"
import { trackRegistrationEvent } from "@/lib/analytics/registration"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"

interface AuthModalProps {
  defaultTab?: "login" | "register"
  onOpenChange: (open: boolean) => void
  open: boolean
  redirectToPath?: string | null
}

const REMEMBERED_IDENTIFIER_KEY = "yeahbuddy:remembered-identifier"

/**
 * When set, the Turnstile CAPTCHA widget is rendered in login/register forms.
 * Leave empty to disable CAPTCHA (e.g. local development).
 */
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""

function sanitizeRedirectPath(path?: string | null) {
  if (!path || !path.startsWith("/")) {
    return null
  }

  return path
}

function createCallbackRedirect(nextPath?: string | null) {
  const redirectUrl = new URL("/auth/callback", getAppBaseUrl())
  const sanitizedPath = sanitizeRedirectPath(nextPath)

  if (sanitizedPath) {
    redirectUrl.searchParams.set("next", sanitizedPath)
  }

  return redirectUrl.toString()
}

export function AuthModal({ open, onOpenChange, defaultTab = "login", redirectToPath }: AuthModalProps) {
  const { messages } = useLocale()
  const supabaseConfigError = getSupabasePublicConfigError()
  const isSupabaseConfigured = supabaseConfigError === null
  const [activeTab, setActiveTab] = useState<"login" | "register">(defaultTab)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<"google" | "apple" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loginIdentifier, setLoginIdentifier] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [registerName, setRegisterName] = useState("")
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const finalRedirectPath = sanitizeRedirectPath(redirectToPath)

  // ---------- Turnstile CAPTCHA ----------
  const turnstileRef = useRef<TurnstileInstance | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaEnabled = TURNSTILE_SITE_KEY.length > 0

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null)
    turnstileRef.current?.reset()
  }, [])

  const onCaptchaSuccess = useCallback((token: string) => {
    setCaptchaToken(token)
  }, [])

  const onCaptchaExpire = useCallback(() => {
    setCaptchaToken(null)
  }, [])

  useEffect(() => {
    setActiveTab(defaultTab)
    setError(null)
    setSuccess(null)
  }, [defaultTab])

  useEffect(() => {
    if (open && activeTab === "register") {
      trackRegistrationEvent("form_view")
    }
  }, [activeTab, open])

  useEffect(() => {
    const rememberedIdentifier = window.localStorage.getItem(REMEMBERED_IDENTIFIER_KEY)

    if (!rememberedIdentifier) {
      return
    }

    startTransition(() => {
      setLoginIdentifier(rememberedIdentifier)
      setRememberMe(true)
    })
  }, [])

  function getSupabaseClientOrThrow() {
    const supabase = getOptionalBrowserSupabaseClient()

    if (!supabase) {
      throw new Error(supabaseConfigError ?? "Supabase browser client is unavailable.")
    }

    return supabase
  }

  async function applyBrowserSession(session?: {
    accessToken: string
    refreshToken: string
  } | null) {
    if (!session) {
      return
    }

    const supabase = getSupabaseClientOrThrow()
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    })

    if (sessionError) {
      throw sessionError
    }

    const {
      data: { session: currentSession },
      error: getSessionError,
    } = await supabase.auth.getSession()

    if (getSessionError) {
      throw getSessionError
    }

    if (!currentSession?.access_token) {
      throw new Error(messages.auth.backendMissingSession)
    }
  }

  async function finalizeAuthentication(role?: AppRole | null, session?: { accessToken: string; refreshToken: string } | null) {
    await applyBrowserSession(session)

    if (rememberMe) {
      window.localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, loginIdentifier.trim())
    } else {
      window.localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY)
    }

    window.location.replace(finalRedirectPath ?? getRoleLandingPath(role))
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!isSupabaseConfigured) {
      setError(supabaseConfigError ?? messages.auth.supabaseNotConfigured)
      return
    }

    setIsLoading(true)

    try {
      const response = await loginRequest({
        captchaToken: captchaToken ?? undefined,
        identifier: loginIdentifier,
        password: loginPassword,
      })

      if (!response.session) {
        throw new Error(messages.auth.backendMissingSession)
      }

      setSuccess(messages.auth.loginSuccess)
      await finalizeAuthentication(response.profile?.role, response.session)
    } catch (rawError) {
      const message =
        rawError instanceof ApiError || rawError instanceof Error
          ? rawError.message
          : messages.auth.loginFailed
      setError(message)
    } finally {
      setIsLoading(false)
      resetCaptcha()
    }
  }

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    trackRegistrationEvent("form_submit", { method: "email", role: "trainee" })

    if (!isSupabaseConfigured) {
      setError(supabaseConfigError ?? messages.auth.supabaseNotConfigured)
      return
    }

    if (registerPassword.length < 6) {
      trackRegistrationEvent("form_error", { method: "email", role: "trainee" })
      setError(messages.auth.passwordTooShort)
      return
    }

    if (registerPassword !== registerConfirmPassword) {
      trackRegistrationEvent("form_error", { method: "email", role: "trainee" })
      setError(messages.auth.passwordMismatch)
      return
    }

    setIsLoading(true)
    let accountCreated = false

    try {
      const response = await registerRequest({
        captchaToken: captchaToken ?? undefined,
        email: registerEmail,
        name: registerName,
        password: registerPassword,
        redirectTo: createCallbackRedirect(finalRedirectPath),
        role: "trainee",
      })
      accountCreated = true

      trackRegistrationEvent("sign_up", {
        method: "email",
        email_confirmation_required: Boolean(response.requiresEmailConfirmation || !response.session),
        role: "trainee",
      })

      if (response.requiresEmailConfirmation || !response.session) {
        setSuccess(response.message ?? messages.auth.registerPending)
        setActiveTab("login")
        setLoginIdentifier(registerEmail.trim())
        setLoginPassword("")
        return
      }

      setSuccess(messages.auth.registerSuccess)
      await finalizeAuthentication(response.profile?.role, response.session)
    } catch (rawError) {
      if (!accountCreated) {
        trackRegistrationEvent("form_error", { method: "email", role: "trainee" })
      }
      const message =
        rawError instanceof ApiError || rawError instanceof Error
          ? rawError.message
          : messages.auth.registerFailed
      setError(message)
    } finally {
      setIsLoading(false)
      resetCaptcha()
    }
  }

  const handleForgotPassword = async () => {
    setError(null)
    setSuccess(null)

    if (!isSupabaseConfigured) {
      setError(supabaseConfigError ?? messages.auth.supabaseNotConfigured)
      return
    }

    const targetIdentifier = loginIdentifier.trim()

    if (!targetIdentifier) {
      setError(messages.auth.missingResetIdentifier)
      return
    }

    setIsLoading(true)

    try {
      const response = await forgotPasswordRequest({
        captchaToken: captchaToken ?? undefined,
        identifier: targetIdentifier,
        redirectTo: createCallbackRedirect("/reset-password"),
      })

      setSuccess(response.message ?? messages.auth.resetEmailSent)
    } catch (rawError) {
      const message =
        rawError instanceof ApiError || rawError instanceof Error
          ? rawError.message
          : messages.auth.resetEmailFailed
      setError(message)
    } finally {
      setIsLoading(false)
      resetCaptcha()
    }
  }

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    setError(null)
    setSuccess(null)

    const supabase = getOptionalBrowserSupabaseClient()

    if (!supabase) {
      setError(supabaseConfigError ?? messages.auth.supabaseNotConfigured)
      return
    }

    setOauthLoadingProvider(provider)
    if (activeTab === "register") {
      trackRegistrationEvent("form_submit", { method: provider })
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      options: {
        redirectTo: createCallbackRedirect(finalRedirectPath),
      },
      provider,
    })

    if (oauthError) {
      if (activeTab === "register") {
        trackRegistrationEvent("form_error", { method: provider })
      }
      setError(oauthError.message)
      setOauthLoadingProvider(null)
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as "login" | "register")
    setError(null)
    setSuccess(null)
    resetCaptcha()
  }

  const renderOAuthButton = (provider: "google" | "apple", label: string, icon: React.ReactNode) => (
    <Button
      variant="outline"
      type="button"
      onClick={() => void handleOAuthLogin(provider)}
      disabled={isLoading || oauthLoadingProvider !== null || !isSupabaseConfigured}
      className="bg-card border-border hover:bg-card/80 h-11 sm:h-10 text-sm"
    >
      {oauthLoadingProvider === provider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  )

  const renderAuthContent = () => (
    <>
      {!isSupabaseConfigured && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/20 bg-warning-soft p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-warning-text" />
          <p className="text-sm text-warning-text">{messages.auth.authDisabledConfig}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive-soft p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive-text" />
          <p className="text-sm text-destructive-text">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary-soft p-3">
          <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-primary">{success}</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="auth-theme-tabs mb-4 grid h-10 w-full grid-cols-2 rounded-full p-[3px] sm:mb-6">
          <TabsTrigger
            value="login"
            className="auth-theme-tab rounded-full text-sm sm:text-base"
          >
            {messages.auth.login}
          </TabsTrigger>
          <TabsTrigger
            value="register"
            className="auth-theme-tab rounded-full text-sm sm:text-base"
          >
            {messages.auth.register}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-0">
          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="login-email" className="text-sm">
                {messages.auth.identifierLabel}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="text"
                  placeholder={messages.auth.identifierPlaceholder}
                  value={loginIdentifier}
                  onChange={(event) => setLoginIdentifier(event.target.value)}
                  className="pl-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="login-password" className="text-sm">
                {messages.auth.passwordLabel}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  className="pl-10 pr-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(Boolean(checked))} />
                <Label htmlFor="remember" className="text-xs sm:text-sm font-normal cursor-pointer">
                  {messages.auth.rememberMe}
                </Label>
              </div>
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                disabled={!isSupabaseConfigured || (captchaEnabled && !captchaToken)}
                className="text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors"
              >
                {messages.auth.forgotPassword}
              </button>
            </div>

            {captchaEnabled && (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={onCaptchaSuccess}
                  onExpire={onCaptchaExpire}
                  options={{ size: "flexible", theme: "auto" }}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 sm:h-11 text-base sm:text-sm"
              disabled={isLoading || oauthLoadingProvider !== null || !isSupabaseConfigured || (captchaEnabled && !captchaToken)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {messages.auth.processing}
                </>
              ) : (
                <>
                  {messages.auth.login}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="relative my-3 sm:my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted-foreground">{messages.auth.continueWith}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {renderOAuthButton("google", "Google", <GoogleIcon className="mr-2 h-4 w-4" />)}
              {renderOAuthButton("apple", "Apple", <AppleIcon className="mr-2 h-4 w-4" />)}
            </div>
          </form>
        </TabsContent>

        <TabsContent value="register" className="mt-0">
          <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="register-name" className="text-sm">
                {messages.auth.fullName}
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-name"
                  type="text"
                  placeholder={messages.auth.fullNamePlaceholder}
                  value={registerName}
                  onChange={(event) => setRegisterName(event.target.value)}
                  className="pl-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="register-email" className="text-sm">
                {messages.auth.email}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-email"
                  type="email"
                  placeholder={messages.auth.emailPlaceholder}
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  className="pl-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="register-password" className="text-sm">
                {messages.auth.passwordLabel}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-password"
                  type={showRegisterPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  className="pl-10 pr-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="register-confirm-password" className="text-sm">
                {messages.auth.confirmPasswordLabel}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-confirm-password"
                  type={showRegisterConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={registerConfirmPassword}
                  onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                  className="pl-10 pr-10 bg-card border-border focus:border-primary h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
                <button
                  type="button"
                  aria-label={showRegisterConfirmPassword ? messages.auth.hidePassword : messages.auth.showPassword}
                  onClick={() => setShowRegisterConfirmPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {showRegisterConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(Boolean(checked))}
                className="mt-0.5"
              />
              <p className="min-w-0 flex-1 text-xs leading-relaxed sm:text-sm">
                <label htmlFor="terms" className="cursor-pointer">{messages.auth.termsPrefix}</label>{" "}
                <Link href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {messages.auth.terms}
                </Link>{" "}
                {messages.auth.and}{" "}
                <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {messages.auth.privacy}
                </Link>
              </p>
            </div>

            {captchaEnabled && (
              <div className="flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={onCaptchaSuccess}
                  onExpire={onCaptchaExpire}
                  options={{ size: "flexible", theme: "auto" }}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-12 sm:h-11 text-base sm:text-sm"
              disabled={isLoading || oauthLoadingProvider !== null || !acceptTerms || !isSupabaseConfigured || (captchaEnabled && !captchaToken)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {messages.auth.createAccountLoading}
                </>
              ) : (
                <>
                  {messages.auth.createAccount}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="relative my-3 sm:my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface px-2 text-muted-foreground">{messages.auth.signUpWith}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {renderOAuthButton("google", "Google", <GoogleIcon className="mr-2 h-4 w-4" />)}
              {renderOAuthButton("apple", "Apple", <AppleIcon className="mr-2 h-4 w-4" />)}
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="auth-floating-panel !bottom-[calc(0.75rem+env(safe-area-inset-bottom))] !left-3 !right-3 !top-auto !flex !h-[min(640px,calc(100dvh-env(safe-area-inset-top)-1.5rem-env(safe-area-inset-bottom)))] !max-h-none !w-auto !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !overflow-hidden !rounded-2xl !border !border-border !bg-background !p-0 sm:!bottom-auto sm:!left-[50%] sm:!right-auto sm:!top-[50%] sm:!h-[min(640px,calc(100dvh-2rem))] sm:!w-full sm:!max-w-[425px] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:!rounded-2xl"
      >
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-hidden sm:max-w-none">
          <div className="relative shrink-0 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
            <DialogHeader className="relative gap-0 p-0 text-left">
              <div className="flex items-center justify-between">
                <BrandLogo markClassName="size-9 rounded-none sm:size-10" textClassName="text-lg sm:text-xl" />
                <DialogClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
              <DialogTitle className="mt-3 text-left text-lg sm:text-xl">
                {activeTab === "login" ? messages.auth.loginWelcome : messages.auth.registerWelcome}
              </DialogTitle>
              <DialogDescription className="mt-1 text-left text-sm text-muted-foreground">
                {activeTab === "login"
                  ? messages.auth.loginDescription
                  : messages.auth.registerDescription}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="auth-modal-scroll min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-2 [-webkit-overflow-scrolling:touch] sm:px-6 sm:pb-6">{renderAuthContent()}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AppleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
    </svg>
  )
}
