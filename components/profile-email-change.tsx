"use client"

import { useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CurrentPasswordError, reloadToLogin, signOutEveryDevice, verifyCurrentPassword } from "@/lib/auth/account-security"
import { getAppBaseUrl } from "@/lib/supabase/config"

/**
 * Changes the sign-in email after re-checking the current password. Supabase
 * sends a confirmation link; the new address only takes effect once confirmed,
 * and the backend picks it up on the next profile load.
 */
export function ProfileEmailChange({ currentEmail, onCancel }: { currentEmail: string; onCancel?: () => void }) {
  const { messages } = useLocale()
  const [newEmail, setNewEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    const email = newEmail.trim().toLowerCase()
    if (!email || email === currentEmail.toLowerCase()) {
      setError(messages.profile.newEmailRequired)
      return
    }

    setSaving(true)
    try {
      const client = await verifyCurrentPassword(currentPassword)
      const redirect = new URL("/auth/callback", getAppBaseUrl())
      redirect.searchParams.set("next", "/profile")
      const { error: updateError } = await client.auth.updateUser(
        { email, current_password: currentPassword },
        { emailRedirectTo: redirect.toString() },
      )
      if (updateError) throw updateError
      await signOutEveryDevice()
      setCurrentPassword("")
      setNewEmail("")
      setSuccess(true)
      reloadToLogin(2500)
    } catch (rawError) {
      setError(rawError instanceof CurrentPasswordError ? messages.profile.currentPasswordIncorrect :
        rawError instanceof Error ? rawError.message : messages.profile.emailChangeFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="col-span-2 space-y-3 rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{messages.profile.changeEmailHelp}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-email">{messages.profile.newEmail}</Label>
          <Input id="new-email" type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email-current-password">{messages.profile.currentPassword}</Label>
          <Input id="email-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
      {success ? <p role="status" className="text-sm text-primary">{messages.profile.emailChangeRequested}</p> : null}
      <div className="flex gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" className="flex-1" disabled={saving || success} onClick={onCancel}>
            {messages.profile.cancel}
          </Button>
        ) : null}
        <Button type="submit" variant="outline" className="flex-1" disabled={saving || success}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {messages.profile.saveEmail}
        </Button>
      </div>
    </form>
  )
}
