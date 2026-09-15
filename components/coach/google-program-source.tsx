"use client"
import { ExternalLink, FolderPlus, Link2, Sheet } from "lucide-react"
import { useCoachMutation } from "@/lib/queries/coach-data"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { userQueryKey } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { GoogleIcon } from "@/components/ui/brand-icons"
import { Button } from "@/components/ui/button"
import { IconTile } from "@/components/ui/icon-tile"
import { Input } from "@/components/ui/input"
import { InputWithIcon } from "@/components/ui/input-with-icon"
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
  const [folderOpen, setFolderOpen] = useState(false)
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
      // Prefill the existing-file row so the coach can load it straight away.
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

  if (!connection.connected) {
    return <div className="space-y-3">
      <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:p-4">
        <IconTile size="lg" tone="surface"><GoogleIcon /></IconTile>
        <p className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">{text.connectHelp}</p>
        <Button className="shrink-0" disabled={pending} onClick={() => void run(async () => { window.location.assign((await authorize.mutateAsync([])).url) })}>{text.connect}</Button>
      </div>
      {error ? <Alert role="alert" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    </div>
  }

  return <div className="space-y-5">
    <div className="flex items-center gap-2.5 border-b border-border pb-3 text-sm">
      <GoogleIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="sr-only">{text.account}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{connection.email ?? "Google"}</span>
      <Button size="sm" variant="ghost" className="shrink-0 text-muted-foreground" disabled={pending} onClick={() => void run(async () => { await disconnect.mutateAsync([]); onConnection({ ...connection, connected: false, email: null }) })}>{text.disconnect}</Button>
    </div>

    {/* Path one: start from a template the app builds. */}
    <section className="space-y-2.5">
      <p className="label-micro">{text.newTemplate}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Label htmlFor="google-template-name" className="sr-only">{text.templateName}</Label>
        <Input id="google-template-name" className="sm:flex-1" value={templateName} disabled={pending} placeholder={text.templateNamePlaceholder} onChange={(event) => setTemplateName(event.target.value)} />
        <Button className="shrink-0" disabled={pending} onClick={() => void handleCreateTemplate()}><Sheet />{text.createTemplate}</Button>
      </div>

      {folderOpen ? <div className="space-y-1.5">
        <Label htmlFor="google-template-folder" className="sr-only">{text.folder}</Label>
        <InputWithIcon id="google-template-folder" icon={<FolderPlus />} value={folder} disabled={pending} placeholder={text.folderPlaceholder} aria-describedby="google-template-folder-help" onChange={(event) => setFolder(event.target.value)} />
        <p id="google-template-folder-help" className="text-xs text-muted-foreground">{text.folderHelp}</p>
      </div> : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {!folderOpen ? <button type="button" className="inline-flex items-center gap-1 font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" disabled={pending} onClick={() => setFolderOpen(true)}><FolderPlus aria-hidden="true" className="size-3.5" />{text.chooseFolder}</button> : null}
        {createdUrl ? <a className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline" href={createdUrl} rel="noreferrer" target="_blank">{text.openTemplate}<ExternalLink aria-hidden="true" className="size-3.5" /></a> : null}
      </div>
    </section>

    <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />{text.or}<span className="h-px flex-1 bg-border" />
    </div>

    {/* Path two: a spreadsheet that already exists. */}
    <section className="space-y-2.5">
      <p className="label-micro">{text.existingFile}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="sm:flex-1">
          <InputWithIcon id="google-sheet-link" icon={<Link2 />} value={link} disabled={pending} placeholder="https://docs.google.com/spreadsheets/..." aria-label={text.link} onChange={(event) => { setLink(event.target.value); setSheets([]); setSheet("") }} />
        </div>
        <Button variant="outline" className="shrink-0" disabled={pending || !link.trim()} onClick={() => void run(async () => {
          const result = await client.fetchQuery({ queryKey: userQueryKey(["coach", "google-spreadsheet", link.trim()], profile?.id), queryFn: async () => fetchGoogleSpreadsheet(await requireAccessToken(), link.trim()), staleTime: 30_000 })
          setSheets(result.sheets); setSheet(result.sheets.find((name) => /^week\s*1$/i.test(name)) ?? result.sheets[0] ?? ""); setTitle(result.title)
        })}>{text.load}</Button>
      </div>

      {sheets.length > 0 ? <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_96px_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="google-week-sheet" className="text-xs text-muted-foreground">{text.sheet}</Label>
          <Select value={sheet} disabled={pending} onValueChange={setSheet}>
            <SelectTrigger id="google-week-sheet" className="w-full">
              <SelectValue placeholder={text.sheet} />
            </SelectTrigger>
            <SelectContent className="z-[100]">
              {sheets.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="google-program-weeks" className="text-xs text-muted-foreground">{text.weeks}</Label>
          <Input id="google-program-weeks" className="tnum" type="number" min={1} max={52} value={weeks} onChange={(event) => setWeeks(Number(event.target.value))} />
        </div>
        <Button disabled={pending || !sheet || !Number.isInteger(weeks) || weeks < 1 || weeks > 52} onClick={() => void run(async () => onImport(await preview.mutateAsync([link, sheet]), title, weeks))}>{text.read}</Button>
      </div> : null}

      <p className="text-xs leading-5 text-muted-foreground">{text.templateHelp}</p>
    </section>

    {error ? <Alert role="alert" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
  </div>
}
