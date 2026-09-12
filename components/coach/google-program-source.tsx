"use client"
import { useCoachMutation } from "@/lib/queries/coach-data"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { userQueryKey } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/providers/toast-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { googleImportMessages } from "@/lib/i18n/messages/google-import"
import { authorizeGoogle, createGoogleProgramTemplate, disconnectGoogle, fetchGoogleSpreadsheet, importGoogleProgram, type GoogleConnectionStatus, type GoogleImportResult } from "@/lib/fitness/api"

export function GoogleProgramSource({ connection, onConnection, onImport }: {
  token?: string; connection: GoogleConnectionStatus
  onConnection: (connection: GoogleConnectionStatus) => void
  onImport: (result: GoogleImportResult, name: string, weeks: number) => void
}) {
  const { locale } = useLocale()
  const { profile } = useAuth()
  const client = useQueryClient()
  const disconnect = useCoachMutation(disconnectGoogle, ["coach"])
  const authorize = useCoachMutation(authorizeGoogle, [])
  const preview = useCoachMutation(importGoogleProgram, [])
  const createTemplate = useCoachMutation(createGoogleProgramTemplate, [])
  const { toast } = useToast()
  const text = googleImportMessages[locale]
  const [link, setLink] = useState("")
  const [sheets, setSheets] = useState<string[]>([])
  const [sheet, setSheet] = useState("")
  const [title, setTitle] = useState("")
  const [weeks, setWeeks] = useState(4)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [createdUrl, setCreatedUrl] = useState("")
  const [folder, setFolder] = useState("")
  const [templateName, setTemplateName] = useState("")

  async function run(action: () => Promise<void>) {
    setPending(true); setError("")
    try { await action() } catch (error) { setError(error instanceof Error ? error.message : text.failed) } finally { setPending(false) }
  }

  /**
   * Creating the sheet through the API is what keeps the exercise dropdown; a
   * Drive conversion of the .xlsx template silently drops it.
   *
   * Both outcomes report through the toast rather than the inline error line,
   * because a failure here can still have produced a usable sheet — the message
   * carries its link — and that is worth putting in front of the coach.
   */
  async function handleCreateTemplate() {
    setPending(true); setError("")
    try {
      const created = await createTemplate.mutateAsync([{
        folder: folder.trim() || undefined,
        title: templateName.trim() || undefined,
      }])
      setCreatedUrl(created.spreadsheetUrl)
      setLink(created.spreadsheetUrl); setSheets([]); setSheet("")
      toast({
        description: created.folderName ? text.savedTo(created.folderName) : created.title,
        title: text.createSucceeded,
        tone: "success",
      })
    } catch (createError) {
      toast({
        description: createError instanceof Error ? createError.message : text.failed,
        title: text.createFailed,
        tone: "error",
      })
    } finally {
      setPending(false)
    }
  }

  const sectionClass = "space-y-3 rounded-xl border border-border p-4"
  const headingClass = "text-sm font-semibold text-foreground"
  const hintClass = "text-xs leading-relaxed text-muted-foreground"

  return <div className="space-y-4">
    {connection.connected ? <>
      {/* Account, and the way out of it, on one line instead of stacked. */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
        <div className="min-w-0">
          <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">{text.account}</p>
          <p className="truncate text-sm font-medium text-foreground">{connection.email ?? "Google"}</p>
        </div>
        <Button size="sm" variant="ghost" className="shrink-0" disabled={pending} onClick={() => void run(async () => { await disconnect.mutateAsync([]); onConnection({ ...connection, connected: false, email: null }) })}>{text.disconnect}</Button>
      </div>

      {/* Path one: start from a template the app builds. */}
      <section className={sectionClass}>
        <div>
          <h3 className={headingClass}>{text.createTitle}</h3>
          <p className={`mt-1 ${hintClass}`}>{text.createTemplateHelp}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="google-template-name">{text.templateName}</Label>
          <Input id="google-template-name" value={templateName} disabled={pending} placeholder={text.templateNamePlaceholder} onChange={(event) => setTemplateName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="google-template-folder">{text.folder}</Label>
          <Input id="google-template-folder" value={folder} disabled={pending} placeholder={text.folderPlaceholder} onChange={(event) => setFolder(event.target.value)} />
          <p className={hintClass}>{text.folderHelp}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" disabled={pending} onClick={() => void handleCreateTemplate()}>{text.createTemplate}</Button>
          {createdUrl ? <a className="text-xs font-medium text-primary underline" href={createdUrl} rel="noreferrer" target="_blank">{text.openTemplate}</a> : null}
        </div>
      </section>

      {/* Path two: a spreadsheet that already exists. */}
      <section className={sectionClass}>
        <h3 className={headingClass}>{text.useExistingTitle}</h3>
        <div className="space-y-1.5">
          <Label htmlFor="google-sheet-link">{text.link}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="google-sheet-link" className="sm:flex-1" value={link} disabled={pending} onChange={(event) => { setLink(event.target.value); setSheets([]); setSheet("") }} />
            <Button className="shrink-0" disabled={pending || !link.trim()} onClick={() => void run(async () => {
              const result = await client.fetchQuery({ queryKey: userQueryKey(["coach", "google-spreadsheet", link.trim()], profile?.id), queryFn: async () => fetchGoogleSpreadsheet(await requireAccessToken(), link.trim()), staleTime: 30_000 })
              setSheets(result.sheets); setSheet(result.sheets.find((name) => /^week\s*1$/i.test(name)) ?? result.sheets[0] ?? ""); setTitle(result.title)
            })}>{text.load}</Button>
          </div>
        </div>
        {sheets.length > 0 ? <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="google-week-sheet">{text.sheet}</Label>
              <Select value={sheet} disabled={pending} onValueChange={setSheet}>
                <SelectTrigger id="google-week-sheet" className="w-full">
                  <SelectValue placeholder={text.sheet} />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="google-program-weeks">{text.weeks}</Label>
              <Input id="google-program-weeks" type="number" min={1} max={52} value={weeks} onChange={(event) => setWeeks(Number(event.target.value))} />
            </div>
          </div>
          <Button className="w-full sm:w-auto" disabled={pending || !sheet || !Number.isInteger(weeks) || weeks < 1 || weeks > 52} onClick={() => void run(async () => onImport(await preview.mutateAsync([link, sheet]), title, weeks))}>{text.read}</Button>
        </> : null}
      </section>
    </> : <Button disabled={pending} onClick={() => void run(async () => { window.location.assign((await authorize.mutateAsync([])).url) })}>{text.connect}</Button>}

    {error ? <Alert role="alert" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

  </div>
}
