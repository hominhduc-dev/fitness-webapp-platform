"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Check, GitMerge, Loader2, X } from "lucide-react"

import { VariationSearchPicker } from "@/components/admin/admin-exercises-panel"
import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail"
import { useToast } from "@/components/providers/toast-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AdminExerciseItem, AdminExerciseShareDecision, AdminExerciseShareRequest } from "@/lib/admin/types"
import { useAdminExerciseShareRequests, useReviewAdminExerciseShare } from "@/lib/queries/admin"
import { cn } from "@/lib/utils"

function getCopy(locale: "en" | "vi") {
  const en = locale === "en"
  return {
    approve: en ? "Approve" : "Duyệt",
    approved: (name: string) => (en ? `${name} is now in the shared library.` : `${name} đã vào thư viện chung.`),
    by: (coach: string) => (en ? `by ${coach}` : `của ${coach}`),
    cancel: en ? "Cancel" : "Hủy",
    heading: en ? "Coach exercises to review" : "Bài tập coach đề xuất",
    merge: en ? "Merge…" : "Gộp…",
    mergeConfirm: en ? "Merge" : "Gộp",
    mergeDescription: en
      ? "Every program and trainee swap using it moves to the library exercise you pick, then the coach's copy is deleted. This can't be undone."
      : "Mọi giáo án và lượt đổi bài đang dùng bài này sẽ chuyển sang bài trong thư viện bạn chọn, rồi bản của coach bị xoá. Không hoàn tác được.",
    mergeEmpty: en ? "No library exercise matches." : "Không có bài nào trong thư viện khớp.",
    mergeLabel: en ? "Library exercise" : "Bài trong thư viện",
    mergeTitle: (name: string) => (en ? `Merge "${name}" into a library exercise` : `Gộp "${name}" vào bài có sẵn`),
    merged: (name: string) => (en ? `${name} was merged.` : `Đã gộp ${name}.`),
    noteLabel: en ? "Note to the coach (optional)" : "Ghi chú cho coach (không bắt buộc)",
    pending: (count: number) => (en ? `${count} waiting` : `${count} đang chờ`),
    reject: en ? "Decline" : "Từ chối",
    rejectDescription: en
      ? "It stays in the coach's own library and keeps working in their programs."
      : "Bài vẫn nằm trong thư viện riêng của coach và vẫn dùng được trong giáo án của họ.",
    rejectTitle: (name: string) => (en ? `Decline "${name}"?` : `Từ chối "${name}"?`),
    rejected: (name: string) => (en ? `${name} stays private to its coach.` : `${name} vẫn là bài riêng của coach.`),
    reviewError: en ? "Unable to save the decision." : "Không lưu được quyết định.",
    selectedPrefix: en ? "Merge into" : "Gộp vào",
    uses: (count: number) => (en ? `${count} uses` : `${count} lượt dùng`),
  }
}

function RequestRow({
  busy,
  highlighted,
  item,
  locale,
  onApprove,
  onMerge,
  onReject,
}: {
  busy: boolean
  highlighted: boolean
  item: AdminExerciseShareRequest
  locale: "en" | "vi"
  onApprove: () => void
  onMerge: () => void
  onReject: () => void
}) {
  const copy = getCopy(locale)
  const lead = item.variations.find((variation) => variation.isDefault) ?? item.variations[0]
  const requested = item.requestedAt.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit" })

  return (
    <div
      id={`exercise-share-${item.id}`}
      className={cn(
        "flex flex-col gap-3 border-b border-border/60 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center",
        highlighted && "bg-primary-soft",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ExerciseThumbnail media={lead?.media} name={item.name} previewable />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[item.muscleGroup, lead?.equipment, lead?.primaryMuscles.join(", ")].filter(Boolean).join(" · ")}
            {item.variations.length > 1 ? ` · ${item.variations.map((variation) => variation.name).join(", ")}` : ""}
          </p>
          <p className="font-mono text-micro text-muted-foreground tnum">
            {item.coach ? `${copy.by(item.coach.name)} · ` : ""}{requested} · {copy.uses(item.usageCount)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onReject}>
          <X />{copy.reject}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onMerge}>
          <GitMerge />{copy.merge}
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={onApprove}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />}{copy.approve}
        </Button>
      </div>
    </div>
  )
}

/**
 * Coach exercises offered to the shared library. Approving shares one as is,
 * declining keeps it the coach's own, and merging folds a duplicate into the
 * library exercise it copies.
 */
export function ExerciseShareReviewPanel({
  libraryExercises,
  locale,
}: {
  /** The admin exercise list; only system and shared variations are merge targets. */
  libraryExercises: AdminExerciseItem[]
  locale: "en" | "vi"
}) {
  const copy = getCopy(locale)
  const { toast } = useToast()
  const requestsQuery = useAdminExerciseShareRequests()
  const review = useReviewAdminExerciseShare()
  const highlightedId = useSearchParams().get("share")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<AdminExerciseShareRequest | null>(null)
  const [merging, setMerging] = useState<AdminExerciseShareRequest | null>(null)
  const [note, setNote] = useState("")
  const [targetVariationId, setTargetVariationId] = useState("")
  const requests = requestsQuery.data ?? []

  const mergeCandidates = useMemo(
    () => libraryExercises.filter((item) => !item.createdBy || item.shareStatus === "shared"),
    [libraryExercises],
  )

  useEffect(() => {
    if (!highlightedId || requestsQuery.isPending) return
    document.getElementById(`exercise-share-${highlightedId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [highlightedId, requestsQuery.isPending])

  if (requests.length === 0) return null

  function closeDialogs() {
    setRejecting(null)
    setMerging(null)
    setNote("")
    setTargetVariationId("")
  }

  async function decide(item: AdminExerciseShareRequest, input: AdminExerciseShareDecision) {
    setBusyId(item.id)
    try {
      const result = await review.mutateAsync([item.id, input])
      const message = result.decision === "approved" ? copy.approved : result.decision === "merged" ? copy.merged : copy.rejected
      toast({ title: message(item.name), tone: "success" })
      closeDialogs()
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : copy.reviewError, tone: "error" })
    } finally {
      setBusyId(null)
    }
  }

  const trimmedNote = note.trim() || undefined
  const dialogBusy = Boolean(busyId)

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{copy.heading}</h3>
        <Badge variant="outline" className="font-mono text-micro">{copy.pending(requests.length)}</Badge>
      </div>
      {requests.map((item) => (
        <RequestRow
          key={item.id}
          busy={busyId === item.id}
          highlighted={item.id === highlightedId}
          item={item}
          locale={locale}
          onApprove={() => void decide(item, { decision: "approve" })}
          onMerge={() => setMerging(item)}
          onReject={() => setRejecting(item)}
        />
      ))}

      <Dialog open={rejecting !== null} onOpenChange={(open) => { if (!open && !dialogBusy) closeDialogs() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{rejecting ? copy.rejectTitle(rejecting.name) : ""}</DialogTitle>
            <DialogDescription>{copy.rejectDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="exercise-share-note">{copy.noteLabel}</Label>
            <Textarea id="exercise-share-note" rows={3} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={dialogBusy} onClick={closeDialogs}>{copy.cancel}</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={dialogBusy}
              onClick={() => rejecting && void decide(rejecting, { decision: "reject", note: trimmedNote })}
            >
              {dialogBusy ? <Loader2 className="animate-spin" /> : <X />}{copy.reject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={merging !== null} onOpenChange={(open) => { if (!open && !dialogBusy) closeDialogs() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{merging ? copy.mergeTitle(merging.name) : ""}</DialogTitle>
            <DialogDescription>{copy.mergeDescription}</DialogDescription>
          </DialogHeader>
          <VariationSearchPicker
            candidates={mergeCandidates}
            emptyLabel={copy.mergeEmpty}
            inputId="exercise-share-merge-search"
            label={copy.mergeLabel}
            locale={locale}
            selectedPrefix={copy.selectedPrefix}
            value={targetVariationId}
            onChange={setTargetVariationId}
          />
          <div className="space-y-1.5">
            <Label htmlFor="exercise-share-merge-note">{copy.noteLabel}</Label>
            <Textarea id="exercise-share-merge-note" rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={dialogBusy} onClick={closeDialogs}>{copy.cancel}</Button>
            <Button
              type="button"
              disabled={dialogBusy || !targetVariationId}
              onClick={() => merging && void decide(merging, { decision: "merge", note: trimmedNote, targetVariationId })}
            >
              {dialogBusy ? <Loader2 className="animate-spin" /> : <GitMerge />}{copy.mergeConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
