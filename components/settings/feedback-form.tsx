"use client"

import { useRef, useState, type FormEvent } from "react"
import { MessageSquare, Paperclip, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useLocale } from "@/components/providers/locale-provider"
import { FeedbackPanel } from "@/components/admin/feedback-panel"
import { SettingsSection } from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createFeedback, type FeedbackCategory } from "@/lib/feedback/api"
import { requireAccessToken } from "@/lib/queries/token"
import { usePathname } from "next/navigation"
import { version } from "@/package.json"

export function FeedbackForm() {
  const { messages } = useLocale()
  const t = messages.feedback
  const client = useQueryClient()
  const pathname = usePathname()
  const [pagePath, setPagePath] = useState(pathname)
  const fileRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<FeedbackCategory>("bug")
  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(""); setSuccess(false)
    const cleanPath = pagePath.trim().split(/[?#]/)[0]
    if (!/^\/(?!\/)/.test(cleanPath) || cleanPath.includes("\\") || Array.from(cleanPath).some((char) => char.charCodeAt(0) < 32) || cleanPath.length > 512) { setError(t.invalidPath); return }
    if (message.trim().length < 10 || message.trim().length > 3000) { setError(t.invalid); return }
    if (file && (file.size > 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type))) { setError(t.invalidFile); return }
    setPending(true)
    try {
      const screenshot = file ? await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) }) : undefined
      await createFeedback(await requireAccessToken(), { category, message: message.trim(), pagePath: cleanPath, appVersion: process.env.NEXT_PUBLIC_APP_VERSION || version, screenshot })
      setMessage(""); setFile(null); if (fileRef.current) fileRef.current.value = ""; setSuccess(true)
      await client.invalidateQueries({ queryKey: ["feedback"] })
    } catch { setError(t.error) } finally { setPending(false) }
  }
  return <SettingsSection id="settings-feedback" title={t.title} description={t.description} descriptionWhenClosed={false} icon={MessageSquare} collapsible>
    <form onSubmit={(event) => void submit(event)} className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)] gap-2">
        <div className="min-w-0 space-y-1"><Label htmlFor="feedback-page">{t.affectedPage}</Label><Input id="feedback-page" value={pagePath} onChange={(event) => setPagePath(event.target.value)} maxLength={512} disabled={pending} required className="min-h-11" /></div>
        <div className="min-w-0 space-y-1"><Label htmlFor="feedback-category">{t.category}</Label><Select value={category} disabled={pending} onValueChange={(v) => setCategory(v as FeedbackCategory)}><SelectTrigger id="feedback-category" className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bug">{t.bug}</SelectItem><SelectItem value="suggestion">{t.suggestion}</SelectItem></SelectContent></Select></div>
      </div>
      <div className="space-y-1"><Label htmlFor="feedback-message">{t.message}</Label><Textarea id="feedback-message" required minLength={10} maxLength={3000} disabled={pending} value={message} onChange={(event) => { setMessage(event.target.value); setSuccess(false) }} placeholder={t.placeholder} className="min-h-24 leading-5 placeholder:text-sm placeholder:leading-5" aria-describedby="feedback-context" /></div>
      <div className="space-y-1.5">
        <Label htmlFor="feedback-screenshot">{t.screenshot}</Label>
        <input ref={fileRef} id="feedback-screenshot" type="file" className="sr-only" tabIndex={-1} accept="image/png,image/jpeg,image/webp" disabled={pending} aria-describedby="feedback-file-hint" onChange={(event) => { const next = event.target.files?.[0] ?? null; if (next && (next.size > 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(next.type))) { event.target.value = ""; setFile(null); setError(t.invalidFile) } else { setFile(next); setError("") } }} />
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={pending} onClick={() => fileRef.current?.click()} aria-describedby="feedback-file-hint"><Paperclip aria-hidden="true" className="size-4" />{file ? t.changeScreenshot : t.chooseScreenshot}</Button>
          {file && <><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={file.name}>{file.name}</span><Button type="button" size="icon" variant="ghost" className="size-11 shrink-0" aria-label={t.removeScreenshot} disabled={pending} onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = "" }}><X aria-hidden="true" className="size-4" /></Button></>}
        </div>
        <p id="feedback-file-hint" className="text-xs leading-4 text-muted-foreground">{t.attachmentHint}</p>
      </div>
      <p id="feedback-context" className="text-xs leading-4 text-muted-foreground">{t.context}</p>{error && <p role="alert" className="text-sm text-destructive-text">{error}</p>}{success && <p role="status" className="text-sm text-success-text">{t.success}</p>}<Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>{pending ? t.sending : t.send}</Button>
    </form><div className="mt-4 border-t border-border pt-3"><FeedbackPanel /></div>
  </SettingsSection>
}
