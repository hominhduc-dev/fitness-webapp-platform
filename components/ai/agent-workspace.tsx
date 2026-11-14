"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { Loader2, Send, Sparkles, Square } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { AIMessage } from "@/components/ai/ai-message"
import { quickActions } from "@/components/ai/agent-quick-actions"
import { useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"
import { agentMessages } from "@/lib/i18n/messages/agent"
import * as api from "@/lib/fitness/api"

const activeStates = new Set(["queued", "running", "waiting_approval"])
export function AgentWorkspace() {
  const { profile } = useAuth(), { locale } = useLocale(), client = useQueryClient()
  const copy = agentMessages[locale]
  const [selection, setSelection] = useState<string | undefined>()
  const [overrideRun, setOverrideRun] = useState<string>()
  const [input, setInput] = useState("")
  const [error, setError] = useState("")
  const [progress, setProgress] = useState("")
  const [memoryKey, setMemoryKey] = useState<api.AgentMemory["key"]>("report_format")
  const [memoryText, setMemoryText] = useState("")
  const isCoach = profile?.role === "coach"
  const [pickedSubject, setPickedSubject] = useState("")
  const [programId, setProgramId] = useState("")
  const subjectId = isCoach ? pickedSubject : profile?.id ?? ""
  const cursor = useRef({ runId: "", after: 0 })
  const conversations = useUserQuery({ queryKey: ["agent", "conversations"], queryFn: async () => api.fetchAgentConversations(await requireAccessToken()) })
  const conversationId = selection ?? conversations.data?.[0]?.id ?? ""
  const conversation = useUserQuery({ queryKey: ["agent", "conversation", conversationId], enabled: !!conversationId,
    queryFn: async () => api.fetchAgentConversation(await requireAccessToken(), conversationId) })
  const runId = overrideRun ?? conversation.data?.runs[0]?.id ?? ""
  const run = useUserQuery({ queryKey: ["agent", "run", runId], enabled: !!runId,
    queryFn: async () => api.fetchAgentRun(await requireAccessToken(), runId),
    refetchInterval: query => activeStates.has(query.state.data?.status ?? "") ? 5000 : false })
  const options = useUserQuery({ queryKey: ["agent", "context-options", subjectId], enabled: !!profile,
    queryFn: async () => api.fetchAgentContextOptions(await requireAccessToken(), isCoach ? subjectId || undefined : undefined) })
  const memories = useUserQuery({ queryKey: ["agent", "memories"], queryFn: async () => api.fetchAgentMemories(await requireAccessToken()) })
  const invalidate = () => client.invalidateQueries({ queryKey: ["agent"] })
  const create = useMutation({ mutationFn: async (message: string) => api.createAgentRun(await requireAccessToken(), { message, conversationId: conversationId || undefined, requestKey: crypto.randomUUID(),
      context: subjectId || programId ? { subjectId: subjectId || undefined, programId: programId || undefined } : undefined }),
    onSuccess: async result => { setSelection(result.conversationId); setOverrideRun(result.id); setInput(""); setProgress(""); await invalidate() }, onError: () => setError(copy.error) })
  const decide = useMutation({ mutationFn: async ({ approval, approve }: { approval: api.AgentApproval; approve: boolean }) => api.decideAgentApproval(await requireAccessToken(), approval.id, approval.payloadHash, approve),
    onSuccess: async () => { setError(""); await Promise.all([invalidate(), ...["workouts", "coach", "progress"].map(key => client.invalidateQueries({ queryKey: [key] }))]) }, onError: () => setError(copy.stale) })
  const cancel = useMutation({ mutationFn: async () => api.cancelAgentRun(await requireAccessToken(), runId), onSuccess: invalidate, onError: () => setError(copy.error) })
  const save = useMutation({ mutationFn: async () => api.saveAgentMemory(await requireAccessToken(), memoryKey, memoryText), onSuccess: async () => { setMemoryText(""); await invalidate() }, onError: () => setError(copy.error) })
  const remove = useMutation({ mutationFn: async (id: string) => api.deleteAgentMemory(await requireAccessToken(), id), onSuccess: invalidate, onError: () => setError(copy.error) })
  const weekly = useMutation({ mutationFn: async (enabled: boolean) => api.saveAgentMemory(await requireAccessToken(), "weekly_review_enabled", String(enabled)), onSuccess: invalidate, onError: () => setError(copy.error) })
  const status = run.data?.status ?? ""
  useEffect(() => {
    if (!runId || !["queued", "running"].includes(status)) return
    const controller = new AbortController()
    if (cursor.current.runId !== runId) cursor.current = { runId, after: 0 }
    const connect = async () => {
      // Resume event delivery after bounded server stream lifetime. Polling remains a fallback.
      while (!controller.signal.aborted) {
        try {
          await api.streamAgentEvents(await requireAccessToken(), runId, controller.signal, event => {
            cursor.current.after = event.id
            if (event.tool) setProgress(copy.tools[event.tool as keyof typeof copy.tools] ?? copy.states.running)
            if (["run.completed", "run.failed", "run.cancelled", "run.budget_exceeded", "approval.required"].includes(event.type)) void invalidate()
          }, cursor.current.after)
          if (controller.signal.aborted) return
          const fresh = await api.fetchAgentRun(await requireAccessToken(), runId)
          if (!["queued", "running"].includes(fresh.status)) { await invalidate(); return }
        } catch { return }
      }
    }
    void connect()
    return () => controller.abort()
    // Copy comes from locale; queryClient is stable. Reconnect when status or locale changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, status, locale, client])

  const isBusy = create.isPending || activeStates.has(status)
  const actions = quickActions({ role: profile?.role as "trainee" | "coach" | "admin" | undefined, hasSubject: isCoach ? !!pickedSubject : true, hasProgram: !!programId })
  const send = (message: string) => { if (message.trim() && !isBusy) { setError(""); create.mutate(message.trim()) } }
  const messages = conversation.isError ? [] : conversation.data?.messages ?? []
  return <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
    <div className="flex gap-2">
      <select aria-label={copy.history} value={conversationId} className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-sm"
        onChange={event => { setSelection(event.target.value); setOverrideRun(undefined); setError(""); setProgress("") }}>
        <option value="">{copy.newChat}</option>
        {conversations.data?.map(item => <option key={item.id} value={item.id}>{item.updatedAt ? `${format(new Date(item.updatedAt), "dd/MM")} · ` : ""}{item.title}</option>)}
      </select>
      <Button variant="outline" size="sm" onClick={() => { setSelection(""); setOverrideRun(undefined); setError(""); setProgress("") }}>{copy.newChat}</Button>
    </div>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto" aria-live="polite">
      {!messages.length && <div className="space-y-3 text-sm text-muted-foreground"><p>{copy.empty}</p><Button variant="secondary" className="h-auto whitespace-normal text-left" disabled={isBusy} onClick={() => send(isCoach ? copy.coachPrompt : copy.traineePrompt)}>{profile?.role === "coach" ? copy.coachPrompt : copy.traineePrompt}</Button></div>}
      {messages.map(message => <div key={message.id} className={message.role === "user" ? "ml-6 rounded-xl bg-primary p-3 text-sm text-primary-foreground" : "mr-2 rounded-xl bg-muted p-3 text-sm"}>
        {message.role === "user" ? <p className="whitespace-pre-wrap">{message.content}</p> : <AIMessage content={message.content} />}
      </div>)}
      {!run.isError && run.data?.reply && !messages.some(item => item.role === "assistant" && item.content === run.data?.reply) && <AIMessage content={run.data.reply} />}
      {!run.isError && run.data?.approvals.map(approval => <div key={approval.id} className="space-y-2 rounded-xl border border-border bg-surface-subtle p-3 text-sm">
        <p className="font-semibold">{approval.kind === "coach_note" ? copy.note : approval.payload.programName ?? copy.proposal}</p>
        <p className="whitespace-pre-wrap text-muted-foreground">{approval.payload.reason ?? approval.payload.body}</p>
        {approval.payload.setCountChanges?.map(change => <div key={change.workoutExerciseId} className="rounded-lg border border-border p-2"><p className="font-medium">{change.label}</p><div className="grid grid-cols-2 gap-2 text-xs"><p>{copy.before}: {change.beforeCount} {copy.sets}</p><p>{copy.after}: {change.afterCount} {copy.sets}</p></div></div>)}
        {approval.payload.changes?.map(change => <div key={change.setId} className="rounded-lg border border-border p-2">
          <p className="font-medium">{change.label}</p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
            <div><p>{copy.before}</p><p>{copy.reps}: {change.before.targetReps} · {copy.weight}: {change.before.weight ?? "—"} · {copy.rir}: {change.before.rir ?? "—"}</p></div>
            <div><p>{copy.after}</p><p>{copy.reps}: {change.after.targetReps} · {copy.weight}: {change.after.weight ?? "—"} · {copy.rir}: {change.after.rir ?? "—"}</p></div>
          </div>
        </div>)}
        <p className="text-xs text-muted-foreground">{copy[approval.status as "pending" | "approved" | "rejected" | "expired"] ?? approval.status}</p>
        {approval.status === "pending" && status === "waiting_approval" && <div className="flex gap-2"><Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ approval, approve: true })}>{copy.approve}</Button><Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ approval, approve: false })}>{copy.reject}</Button></div>}
        {approval.status === "approved" && approval.kind === "program_changes" && !activeStates.has(status) && <Button size="sm" variant="outline" disabled={create.isPending} onClick={() => create.mutate(copy.revertPrompt + approval.id)}>{copy.revert}</Button>}
      </div>)}
      {(error || conversations.isError || conversation.isError || run.isError) && <p role="alert" className="text-sm text-destructive-text">{error || copy.error}</p>}
    </div>
    {status && <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground" role="status">
      <span className="flex items-center gap-2">{["queued", "running"].includes(status) && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />}{copy.states[status as keyof typeof copy.states]}{status === "running" && progress ? ` · ${progress}` : ""}</span>
      {activeStates.has(status) && <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate()}><Square className="size-3" />{copy.cancel}</Button>}
    </div>}
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {isCoach && <select aria-label={copy.subject} value={pickedSubject} disabled={isBusy} className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-sm"
          onChange={event => { setPickedSubject(event.target.value); setProgramId("") }}>
          <option value="">{copy.anySubject}</option>
          {options.data?.subjects.map(item => <option key={item.id} value={item.id}>{item.name || "—"}</option>)}
        </select>}
        {(!isCoach || pickedSubject) && <select aria-label={copy.program} value={programId} disabled={isBusy || !options.data?.programs.length} className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-sm"
          onChange={event => setProgramId(event.target.value)}>
          <option value="">{copy.anyProgram}</option>
          {options.data?.programs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>}
      </div>
      {actions.length > 0 && <div className="flex flex-wrap gap-2">
        {actions.map(key => <Button key={key} type="button" variant="secondary" size="sm" className="h-auto rounded-full px-3 py-1 text-xs" disabled={isBusy} onClick={() => send(copy.actionPrompts[key])}>
          <Sparkles className="size-3" />{copy.actions[key]}
        </Button>)}
      </div>}
    </div>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); send(input) }}>
      <input aria-label={copy.placeholder} placeholder={copy.placeholder} value={input} maxLength={4000} disabled={isBusy} onChange={event => setInput(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-border bg-background p-2 text-sm" />
      <Button type="submit" size="icon" aria-label={copy.send} disabled={isBusy || !input.trim()}><Send className="size-4" /></Button>
    </form>
    <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">{copy.memory}</summary><div className="mt-2 space-y-2">
      <p className="text-muted-foreground">{copy.memoryHint}</p>
      {profile?.role === "coach" && <label className="flex items-start gap-2"><input type="checkbox" checked={memories.data?.some(memory => memory.key === "weekly_review_enabled" && memory.content === "true") ?? false} disabled={weekly.isPending} onChange={event => weekly.mutate(event.target.checked)} />{copy.weekly}</label>}
      {memories.data?.filter(memory => memory.key !== "weekly_review_enabled").map(memory => <div key={memory.id} className="flex items-center justify-between gap-2"><span>{memory.content}</span><Button variant="ghost" size="sm" disabled={remove.isPending} onClick={() => remove.mutate(memory.id)}>{copy.remove}</Button></div>)}
      <select aria-label={copy.memory} value={memoryKey} onChange={event => setMemoryKey(event.target.value as api.AgentMemory["key"])} className="rounded-lg border border-border bg-background p-2"><option value="report_format">{copy.report}</option><option value="training_preferences">{copy.preferences}</option><option value="equipment">{copy.equipment}</option></select>
      <div className="flex gap-2"><input aria-label={copy.preferences} maxLength={500} value={memoryText} onChange={event => setMemoryText(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2" /><Button size="sm" disabled={save.isPending || !memoryText.trim()} onClick={() => save.mutate()}>{copy.save}</Button></div>
    </div></details>
  </div>
}
