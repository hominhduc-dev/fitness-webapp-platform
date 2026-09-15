"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Loader2, Lock } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  changePassword,
  CurrentPasswordError,
  hasActiveSession,
  isRecoverySession,
  MIN_PASSWORD_LENGTH,
  NotSignedInError,
  reloadToLogin,
  signOutEveryDevice,
} from "@/lib/auth/account-security"
import { hasSupabasePublicConfig } from "@/lib/supabase/config"

type PageMode = "loading" | "signed-out" | "change" | "recovery"

function PasswordField({
  autoComplete,
  id,
  label,
  onChange,
  value,
}: {
  autoComplete: string
  id: string
  label: string
  onChange: (value: string) => void
  value: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pl-10 pr-10"
          placeholder="••••••••"
          required
        />
        <button
          type="button"
          aria-label={label}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const { messages } = useLocale()
  const isSupabaseConfigured = hasSupabasePublicConfig()
  const [mode, setMode] = useState<PageMode>("loading")
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const signedIn = await hasActiveSession()
      const nextMode: PageMode = !signedIn ? "signed-out" : (await isRecoverySession()) ? "recovery" : "change"
      if (!cancelled) setMode(nextMode)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (mode === "change" && !currentPassword) {
      setError(messages.auth.currentPasswordRequired)
      return
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(messages.auth.passwordTooShort)
      return
    }

    if (password !== confirmPassword) {
      setError(messages.auth.passwordMismatch)
      return
    }

    if (mode === "change" && password === currentPassword) {
      setError(messages.auth.passwordSameAsCurrent)
      return
    }

    setIsSubmitting(true)

    try {
      await changePassword({ currentPassword: mode === "change" ? currentPassword : undefined, newPassword: password })
      await signOutEveryDevice()
      setSuccess(messages.auth.passwordUpdatedSignedOut)
      reloadToLogin(1800)
    } catch (rawError) {
      if (rawError instanceof NotSignedInError) {
        setMode("signed-out")
      }
      setError(
        rawError instanceof CurrentPasswordError
          ? messages.auth.currentPasswordIncorrect
          : rawError instanceof Error
            ? rawError.message
            : messages.auth.passwordUpdateFailed,
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">
            {mode === "change" ? messages.auth.changePasswordTitle : messages.auth.resetPasswordTitle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "change" ? messages.auth.changePasswordDescription : messages.auth.resetPasswordDescription}
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-lg border border-warning/20 bg-warning-soft p-3 text-sm text-warning-text">
            {messages.auth.resetPasswordConfigMissing}
          </div>
        )}
        {error && <div role="alert" className="mb-4 rounded-lg border border-destructive/20 bg-destructive-soft p-3 text-sm text-destructive-text">{error}</div>}
        {success && <div role="status" className="mb-4 rounded-lg border border-primary/20 bg-primary-soft p-3 text-sm text-primary">{success}</div>}

        {mode === "loading" ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : mode === "signed-out" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{messages.auth.resetSessionMissing}</p>
            <Button asChild className="w-full">
              <Link href="/?auth=login">{messages.auth.backToLogin}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "change" ? (
              <PasswordField
                id="reset-current-password"
                autoComplete="current-password"
                label={messages.auth.currentPassword}
                value={currentPassword}
                onChange={setCurrentPassword}
              />
            ) : null}
            <PasswordField
              id="reset-password"
              autoComplete="new-password"
              label={messages.auth.newPassword}
              value={password}
              onChange={setPassword}
            />
            <PasswordField
              id="reset-confirm-password"
              autoComplete="new-password"
              label={messages.auth.confirmNewPassword}
              value={confirmPassword}
              onChange={setConfirmPassword}
            />

            <p className="text-xs text-muted-foreground">{messages.auth.signOutAllDevicesNote}</p>

            <Button type="submit" className="w-full" disabled={isSubmitting || !isSupabaseConfigured || Boolean(success)}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {messages.auth.updatingPassword}
                </>
              ) : (
                messages.auth.updatePassword
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
