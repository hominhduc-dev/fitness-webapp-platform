"use client"
import { useCoachMutation } from "@/lib/queries/coach-data"
import { useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import { userQueryKey } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLocale } from "@/components/providers/locale-provider"
import { googleImportMessages } from "@/lib/i18n/messages/google-import"
import { authorizeGoogle, disconnectGoogle, fetchGoogleSpreadsheet, importGoogleProgram, type GoogleConnectionStatus, type GoogleImportResult } from "@/lib/fitness/api"

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
  const text = googleImportMessages[locale]
  const [link, setLink] = useState("")
  const [sheets, setSheets] = useState<string[]>([])
  const [sheet, setSheet] = useState("")
  const [title, setTitle] = useState("")
  const [weeks, setWeeks] = useState(4)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function run(action: () => Promise<void>) {
    setPending(true); setError("")
    try { await action() } catch (error) { setError(error instanceof Error ? error.message : text.failed) } finally { setPending(false) }
  }
  return <div className="space-y-3">
    {connection.connected ? <>
      <p className="text-sm text-muted-foreground">{text.account}: {connection.email ?? "Google"}</p>
      <Button variant="outline" disabled={pending} onClick={() => void run(async () => { await disconnect.mutateAsync([]); onConnection({ ...connection, connected: false, email: null }) })}>{text.disconnect}</Button>
      <Label htmlFor="google-sheet-link">{text.link}</Label>
      <Input id="google-sheet-link" value={link} disabled={pending} onChange={(event) => { setLink(event.target.value); setSheets([]); setSheet("") }} />
      <Button disabled={pending || !link.trim()} onClick={() => void run(async () => {
        const result = await client.fetchQuery({ queryKey: userQueryKey(["coach", "google-spreadsheet", link.trim()], profile?.id), queryFn: async () => fetchGoogleSpreadsheet(await requireAccessToken(), link.trim()), staleTime: 30_000 })
        setSheets(result.sheets); setSheet(result.sheets.find((name) => /^week\s*1$/i.test(name)) ?? result.sheets[0] ?? ""); setTitle(result.title)
      })}>{text.load}</Button>
      {sheets.length > 0 ? <>
        <Label htmlFor="google-week-sheet">{text.sheet}</Label>
        <Select value={sheet} disabled={pending} onValueChange={setSheet}>
          <SelectTrigger id="google-week-sheet" className="w-full">
            <SelectValue placeholder={text.sheet} />
          </SelectTrigger>
          <SelectContent>
            {sheets.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Label htmlFor="google-program-weeks">{text.weeks}</Label>
        <Input id="google-program-weeks" type="number" min={1} max={52} value={weeks} onChange={(event) => setWeeks(Number(event.target.value))} />
        <Button disabled={pending || !sheet || !Number.isInteger(weeks) || weeks < 1 || weeks > 52} onClick={() => void run(async () => onImport(await preview.mutateAsync([link, sheet]), title, weeks))}>{text.read}</Button>
      </> : null}
    </> : <Button disabled={pending} onClick={() => void run(async () => { window.location.assign((await authorize.mutateAsync([])).url) })}>{text.connect}</Button>}
    {error ? <p role="alert" className="text-sm text-destructive-text">{error}</p> : null}
  </div>
}
