"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ApiError } from "@/lib/auth/api"
import { getFeedback, listFeedback, updateFeedback, type FeedbackCategory, type FeedbackItem, type FeedbackStatus } from "@/lib/feedback/api"
import { useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"

export function FeedbackPanel({ admin = false }: { admin?: boolean }) {
  const { messages, locale } = useLocale()
  const t = messages.feedback
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<FeedbackStatus | "all">("all")
  const [category, setCategory] = useState<FeedbackCategory | "all">("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nextStatus, setNextStatus] = useState<FeedbackStatus>("new")
  const list = useUserQuery({ queryKey: ["feedback", "list", admin, page, status, category], queryFn: async () => listFeedback(await requireAccessToken(), { admin, page, status: status === "all" ? undefined : status, category: category === "all" ? undefined : category }) })
  const detail = useUserQuery({ queryKey: ["feedback", "detail", selectedId], enabled: Boolean(selectedId), queryFn: async () => getFeedback(await requireAccessToken(), selectedId!) })
  const mutation = useMutation({
    mutationFn: async ({ item, status }: { item: FeedbackItem; status: FeedbackStatus }) => updateFeedback(await requireAccessToken(), item, status),
    onSuccess: async (_, variables) => { await queryClient.invalidateQueries({ queryKey: ["feedback"] }); setSelectedId((current) => current === variables.item.id ? null : current) },
    onError: async () => { await queryClient.invalidateQueries({ queryKey: ["feedback"] }) },
  })
  const errorText = mutation.error instanceof ApiError && mutation.error.status === 409 ? t.conflict : t.error
  return <section className="space-y-4" aria-label={admin ? t.adminTitle : t.recent}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{admin ? t.adminTitle : t.recent}</h2><Button variant="outline" onClick={() => void list.refetch()} disabled={list.isFetching}>{t.refresh}</Button></div>
    {admin && <><p className="text-sm text-muted-foreground">{t.adminDescription}</p><div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor="feedback-filter-status">{t.status}</Label><Select value={status} onValueChange={(v) => { setStatus(v as FeedbackStatus | "all"); setPage(1) }}><SelectTrigger id="feedback-filter-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t.all}</SelectItem>{(["new", "in_progress", "resolved"] as const).map((s) => <SelectItem key={s} value={s}>{t.statuses[s]}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="feedback-filter-category">{t.category}</Label><Select value={category} onValueChange={(v) => { setCategory(v as FeedbackCategory | "all"); setPage(1) }}><SelectTrigger id="feedback-filter-category"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t.all}</SelectItem><SelectItem value="bug">{t.bug}</SelectItem><SelectItem value="suggestion">{t.suggestion}</SelectItem></SelectContent></Select></div>
    </div></>}
    {list.isPending ? <p role="status">{messages.common.loading}</p> : list.isError ? <p role="alert" className="text-destructive-text">{t.error}</p> : !list.data?.items.length ? <p className="text-sm text-muted-foreground">{t.empty}</p> : <ul className="space-y-2">{list.data.items.map((item) => <li key={item.id} className="rounded-lg border border-border bg-card p-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{item.category === "bug" ? t.bug : t.suggestion} · {t.statuses[item.status]}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(locale)}</time></div><p className="mt-2 line-clamp-2 break-words text-sm">{item.message}</p>{item.reporter && <p className="mt-1 break-words text-xs text-muted-foreground">{item.reporter.name} · {item.reporter.email}</p>}<Button variant="ghost" className="mt-2" onClick={() => { mutation.reset(); setNextStatus(item.status); setSelectedId(item.id) }}>{t.details}</Button></li>)}</ul>}
    <div className="flex items-center justify-between gap-2"><Button variant="outline" disabled={page === 1 || list.isFetching} onClick={() => setPage(page - 1)}>{t.previous}</Button><span className="text-sm">{t.page} {page}</span><Button variant="outline" disabled={!list.data || page * list.data.limit >= list.data.total || list.isFetching} onClick={() => setPage(page + 1)}>{t.next}</Button></div>
    <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null) }}><DialogContent className="max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}><DialogHeader><DialogTitle>{t.details}</DialogTitle></DialogHeader>
      {detail.isPending ? <p role="status">{messages.common.loading}</p> : detail.isError ? <p role="alert">{t.error}</p> : detail.data && <div className="space-y-4"><p className="whitespace-pre-wrap break-words">{detail.data.message}</p><dl className="space-y-2 break-words text-sm text-muted-foreground"><dt>{t.pagePath}</dt><dd>{detail.data.pagePath}</dd><dt>{t.version}</dt><dd>{detail.data.appVersion ?? "—"}</dd><dt>{t.browser}</dt><dd>{detail.data.userAgent ?? "—"}</dd></dl>
      {detail.data.screenshot && /^data:image\/(png|jpeg|webp);base64,/.test(detail.data.screenshot) && <img src={detail.data.screenshot} alt={t.screenshot} className="max-h-96 w-full rounded-lg object-contain" />}
      {admin ? <div className="space-y-3"><Label htmlFor="feedback-edit-status">{t.status}</Label><Select value={nextStatus} onValueChange={(v) => setNextStatus(v as FeedbackStatus)}><SelectTrigger id="feedback-edit-status"><SelectValue /></SelectTrigger><SelectContent>{(["new", "in_progress", "resolved"] as const).map((s) => <SelectItem key={s} value={s}>{t.statuses[s]}</SelectItem>)}</SelectContent></Select><Button disabled={mutation.isPending || nextStatus === detail.data.status} onClick={() => mutation.mutate({ item: detail.data!, status: nextStatus })}>{mutation.isPending ? messages.common.loading : t.save}</Button>{mutation.isError && <p role="alert" className="text-destructive-text">{errorText}</p>}</div> : <p>{t.status}: {t.statuses[detail.data.status]}</p>}</div>}
    </DialogContent></Dialog>
  </section>
}
