"use client"

import { CheckCircle2, KeyRound, Loader2, PlugZap, RotateCcw, Save, XCircle } from "lucide-react"
import { useState } from "react"

import { useToast } from "@/components/providers/toast-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { AdminAIIntegration, AdminAIIntegrationInput, AdminIntegrationTestResult } from "@/lib/admin/api"
import { useAdminIntegrations, useResetAdminAIIntegration, useSaveAdminAIIntegration, useTestAdminAIIntegration } from "@/lib/queries/admin"

type Provider = AdminAIIntegrationInput["provider"]

/** Common OpenAI-compatible hosts, so admins pick instead of typing URLs. */
const PRESETS: Array<{ label: string; provider: Provider; baseUrl: string; models: string[] }> = [
  { label: "Anthropic", provider: "anthropic", baseUrl: "", models: ["claude-haiku-4-5-20251001", "claude-sonnet-4-5"] },
  { label: "OpenAI", provider: "openai", baseUrl: "", models: ["gpt-4.1-mini", "gpt-4o-mini"] },
  { label: "Google Gemini", provider: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", models: ["models/gemini-2.5-flash", "models/gemini-2.5-pro"] },
  { label: "OpenRouter", provider: "openai", baseUrl: "https://openrouter.ai/api/v1", models: ["anthropic/claude-haiku-4.5", "google/gemini-2.5-flash"] },
]

function presetFor(provider: Provider, baseUrl: string) {
  return PRESETS.find(preset => preset.provider === provider && preset.baseUrl === baseUrl)?.label ?? "custom"
}

export function AdminIntegrationsPanel({ locale }: { locale: "en" | "vi" }) {
  const en = locale === "en"
  const settings = useAdminIntegrations()
  const ai = settings.data?.ai
  if (settings.isLoading) return <Card className="p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />{en ? "Loading…" : "Đang tải…"}</Card>
  if (settings.isError || !ai) return <Card className="p-6 text-sm text-destructive-text" role="alert">{en ? "Could not load integration settings." : "Không tải được cấu hình tích hợp."}</Card>
  // Re-key on every server change (save/reset) so the form restarts from the active values.
  return <AIIntegrationForm key={`${ai.source}:${ai.updatedAt ?? ""}:${ai.provider}:${ai.model}`} ai={ai} encryptionReady={settings.data?.encryptionReady ?? false} en={en} />
}

function AIIntegrationForm({ ai, encryptionReady, en }: { ai: AdminAIIntegration; encryptionReady: boolean; en: boolean }) {
  const { toast } = useToast()
  const save = useSaveAdminAIIntegration()
  const reset = useResetAdminAIIntegration()
  const test = useTestAdminAIIntegration()

  const [provider, setProvider] = useState<Provider>(ai.provider)
  const [baseUrl, setBaseUrl] = useState(ai.baseUrl ?? "")
  const [model, setModel] = useState(ai.model)
  const [jsonMode, setJsonMode] = useState(ai.jsonMode)
  const [apiKey, setApiKey] = useState("")
  const [result, setResult] = useState<AdminIntegrationTestResult | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const preset = presetFor(provider, baseUrl)
  const models = PRESETS.find(item => item.label === preset)?.models ?? []
  const draft: AdminAIIntegrationInput = { provider, model: model.trim(), baseUrl: provider === "openai" ? baseUrl.trim() : "", jsonMode, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) }
  const busy = save.isPending || test.isPending || reset.isPending
  const providerChanged = ai.provider !== provider
  const needsKey = providerChanged ? !apiKey.trim() : !ai.hasApiKey && !apiKey.trim()

  const pickPreset = (label: string) => {
    const next = PRESETS.find(item => item.label === label)
    if (!next) return
    setProvider(next.provider); setBaseUrl(next.baseUrl); setModel(next.models[0] ?? ""); setResult(null)
  }
  const onTest = async () => {
    try { setResult(await test.mutateAsync([draft])) }
    catch (error) { toast({ title: error instanceof Error ? error.message : en ? "Test failed." : "Không kiểm tra được.", tone: "error" }) }
  }
  const onSave = async () => {
    try {
      await save.mutateAsync([draft])
      toast({ title: en ? "AI settings saved. New requests use them immediately." : "Đã lưu. Các lượt AI mới dùng cấu hình này ngay.", tone: "success" })
    } catch (error) { toast({ title: error instanceof Error ? error.message : en ? "Could not save." : "Không lưu được.", tone: "error" }) }
  }
  const onReset = async () => {
    try {
      await reset.mutateAsync([])
      setConfirmReset(false)
      toast({ title: en ? "Back to .env values." : "Đã quay về cấu hình .env.", tone: "success" })
    } catch (error) { toast({ title: error instanceof Error ? error.message : en ? "Could not reset." : "Không đặt lại được.", tone: "error" }) }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="size-5" />{en ? "AI provider" : "Nhà cung cấp AI"}</h2>
            <p className="text-sm text-muted-foreground">{en ? "Used by AI Coach, the agent, meal and program generators." : "Dùng cho AI Coach, Agent, tạo thực đơn và giáo án."}</p>
          </div>
          <Badge variant={ai.source === "database" ? "default" : "secondary"}>
            {ai.source === "database" ? (en ? "Set by admin" : "Admin đã thiết lập") : (en ? "From .env" : "Đang dùng .env")}
          </Badge>
        </div>

        {!encryptionReady && <p role="alert" className="rounded-lg border border-border bg-surface-subtle p-3 text-sm text-destructive-text">
          {en ? "GOOGLE_TOKEN_ENCRYPTION_KEY is missing on the server, so keys cannot be stored safely." : "Máy chủ thiếu GOOGLE_TOKEN_ENCRYPTION_KEY nên chưa thể lưu API key an toàn."}
        </p>}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-preset">{en ? "Service" : "Dịch vụ"}</Label>
            <select id="ai-preset" value={preset} disabled={busy} onChange={event => pickPreset(event.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
              {PRESETS.map(item => <option key={item.label} value={item.label}>{item.label}</option>)}
              {preset === "custom" && <option value="custom">{en ? "Custom (OpenAI-compatible)" : "Tuỳ chỉnh (tương thích OpenAI)"}</option>}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-model">Model</Label>
            <Input id="ai-model" list="ai-model-options" value={model} disabled={busy} onChange={event => { setModel(event.target.value); setResult(null) }} />
            <datalist id="ai-model-options">{models.map(item => <option key={item} value={item} />)}</datalist>
          </div>
          {provider === "openai" && <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ai-base-url">Base URL</Label>
            <Input id="ai-base-url" placeholder="https://api.openai.com/v1" value={baseUrl} disabled={busy} onChange={event => { setBaseUrl(event.target.value); setResult(null) }} />
          </div>}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ai-key">API key</Label>
            <Input id="ai-key" type="password" autoComplete="off" spellCheck={false} value={apiKey} disabled={busy}
              placeholder={ai.hasApiKey && !providerChanged ? (en ? `Saved ${ai.apiKeyHint ?? ""} — leave blank to keep` : `Đã lưu ${ai.apiKeyHint ?? ""} — để trống để giữ nguyên`) : (en ? "Paste the API key" : "Dán API key")}
              onChange={event => { setApiKey(event.target.value); setResult(null) }} />
            <p className="text-xs text-muted-foreground">{en ? "Encrypted on the server and never shown again." : "Được mã hoá trên máy chủ và không bao giờ hiển thị lại."}</p>
          </div>
          {provider === "openai" && <label className="flex items-center gap-3 text-sm md:col-span-2">
            <Switch checked={jsonMode} disabled={busy} onCheckedChange={value => { setJsonMode(value); setResult(null) }} />
            {en ? "JSON mode (turn off if the host rejects response_format)" : "Chế độ JSON (tắt nếu dịch vụ không hỗ trợ response_format)"}
          </label>}
        </div>

        {result && <div role="status" className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${result.ok ? "border-border bg-surface-subtle" : "border-destructive/40 text-destructive-text"}`}>
          {result.ok ? <CheckCircle2 className="mt-0.5 size-4 text-primary" /> : <XCircle className="mt-0.5 size-4" />}
          <span>{result.ok ? (en ? `Connected in ${result.latencyMs} ms.` : `Kết nối thành công (${result.latencyMs} ms).`) : `${result.message}${result.status ? ` (HTTP ${result.status})` : ""}`}</span>
        </div>}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy || !draft.model || needsKey} onClick={onTest}>
            {test.isPending ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}{en ? "Test connection" : "Kiểm tra kết nối"}
          </Button>
          <Button disabled={busy || !draft.model || needsKey || !encryptionReady} onClick={onSave}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{en ? "Save" : "Lưu"}
          </Button>
          {ai.source === "database" && <Button variant="ghost" disabled={busy} onClick={() => setConfirmReset(true)}>
            <RotateCcw className="size-4" />{en ? "Use .env values" : "Quay về .env"}
          </Button>}
        </div>
        {needsKey && <p className="text-xs text-muted-foreground">{en ? "Enter an API key for this provider." : "Cần nhập API key cho nhà cung cấp này."}</p>}
      </Card>

      <Card className="space-y-1 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{en ? ".env fallback" : "Cấu hình dự phòng trong .env"}</p>
        <p>{ai.env.provider} · {ai.env.model}{ai.env.baseUrl ? ` · ${ai.env.baseUrl}` : ""} · {ai.env.hasApiKey ? (en ? "key set" : "có key") : (en ? "no key" : "chưa có key")}</p>
      </Card>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{en ? "Use .env values again?" : "Quay về cấu hình .env?"}</DialogTitle>
            <DialogDescription>{en ? "The saved provider, model and API key are deleted. AI features switch back to the server's .env immediately." : "Nhà cung cấp, model và API key đã lưu sẽ bị xoá. Các tính năng AI chuyển về cấu hình .env của máy chủ ngay lập tức."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>{en ? "Cancel" : "Huỷ"}</Button>
            <Button variant="destructive" disabled={reset.isPending} onClick={onReset}>{en ? "Delete and use .env" : "Xoá và dùng .env"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
