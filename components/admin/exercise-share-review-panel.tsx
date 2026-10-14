"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Check, ChevronDown, Eye, GitMerge, Loader2, X } from "lucide-react"

import { ExerciseFormModal, VariationSearchPicker, type ExerciseSaveData } from "@/components/admin/admin-exercises-panel"
import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail"
import { useToast } from "@/components/providers/toast-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AdminExerciseItem, AdminExerciseMediaFiles, AdminExerciseShareDecision, AdminExerciseShareRequest } from "@/lib/admin/types"
import { useAdminExerciseShareRequests, useReviewAdminExerciseShare } from "@/lib/queries/admin"
import { cn } from "@/lib/utils"

function getCopy(locale: "en" | "vi") {
  const en = locale === "en"
  return {
    approve: en ? "Approve" : "Duyệt",
    preview: en ? "Preview and edit" : "Xem trước và sửa",
    previewMissing: en ? "This exercise is no longer in the library list. Reload the page." : "Không tìm thấy bài này trong danh sách. Hãy tải lại trang.",
    saveAndApprove: en ? "Save & approve" : "Lưu & duyệt",
    saveError: en ? "Unable to save the exercise." : "Không lưu được bài tập.",
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
    showFewer: en ? "Show fewer" : "Thu gọn",
    showMore: (count: number) => (en ? `Show ${count} more` : `Xem thêm ${count}`),
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
  onPreview,
  onReject,
}: {
  busy: boolean
  highlighted: boolean
  item: AdminExerciseShareRequest
  locale: "en" | "vi"
  onApprove: () => void
  onMerge: () => void
  /** Opens the exercise in the edit form; absent when the console cannot save exercises. */
  onPreview?: () => void
  onReject: () => void
}) {
  const copy = getCopy(locale)
  const lead = item.variations.find((variation) => variation.isDefault) ?? item.variations[0]
  const requested = item.requestedAt.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN", { day: "2-digit", month: "2-digit" })

  const details = [
    item.muscleGroup,
    lead?.equipment,
    lead?.primaryMuscles.join(", "),
    item.variations.length > 1 ? item.variations.map((variation) => variation.name).join(", ") : null,
  ].filter(Boolean).join(" · ")
  const meta = [item.coach ? copy.by(item.coach.name) : null, requested, copy.uses(item.usageCount)].filter(Boolean).join(" · ")

  return (
    <div
      id={`exercise-share-${item.id}`}
      className={cn(
        "flex items-center gap-3 border-b border-border/60 px-4 py-2 last:border-b-0",
        highlighted && "bg-primary-soft",
      )}
    >
      <ExerciseThumbnail className="size-8" media={lead?.media} name={item.name} previewable />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground" title={`${details} · ${meta}`}>
          {details}
          <span className="font-mono text-micro tnum"> · {meta}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onPreview ? (
          <Button type="button" size="icon-sm" variant="ghost" disabled={busy} onClick={onPreview} aria-label={`${copy.preview}: ${item.name}`} title={copy.preview}>
            <Eye />
          </Button>
        ) : null}
        <Button type="button" size="icon-sm" variant="ghost" disabled={busy} onClick={onReject} aria-label={copy.reject} title={copy.reject}>
          <X />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" disabled={busy} onClick={onMerge} aria-label={copy.merge} title={copy.merge}>
          <GitMerge />
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={onApprove} aria-label={copy.approve}>
          {busy ? <Loader2 className="animate-spin" /> : <Check />}<span className="hidden sm:inline">{copy.approve}</span>
        </Button>
      </div>
    </div>
  )
}

/** Rows shown before "Show more"; the rest stay one click away. */
const COLLAPSED_ROWS = 3

/**
 * Coach exercises offered to the shared library. Approving shares one as is,
 * declining keeps it the coach's own, and merging folds a duplicate into the
 * library exercise it copies.
 */
export function ExerciseShareReviewPanel({
  libraryExercises,
  locale,
  onRemoveMedia,
  onSaveExercise,
  onSaveMedia,
  savingExerciseId,
}: {
  /** The admin exercise list; only system and shared variations are merge targets. */
  libraryExercises: AdminExerciseItem[]
  locale: "en" | "vi"
  /**
   * With these, each request gets a preview that opens the edit form, so an
   * admin can fill what the coach left out (media, pattern) before approving.
   */
  onSaveExercise?: (data: ExerciseSaveData) => Promise<void>
  onSaveMedia?: (variationId: string, files: AdminExerciseMediaFiles) => Promise<void>
  onRemoveMedia?: (variationId: string) => Promise<void>
  /** The variation the console is saving, to show the form as busy. */
  savingExerciseId?: string | null
}) {
  const copy = getCopy(locale)
  const { toast } = useToast()
  const requestsQuery = useAdminExerciseShareRequests()
  const review = useReviewAdminExerciseShare()
  const highlightedId = useSearchParams().get("share")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<AdminExerciseShareRequest | null>(null)
  const [merging, setMerging] = useState<AdminExerciseShareRequest | null>(null)
  const [previewing, setPreviewing] = useState<AdminExerciseShareRequest | null>(null)
  const [note, setNote] = useState("")
  const [targetVariationId, setTargetVariationId] = useState("")
  const [expanded, setExpanded] = useState(false)
  const requests = requestsQuery.data ?? []
  // A notification link to a request past the fold opens the full list.
  const highlightHidden = requests.findIndex((item) => item.id === highlightedId) >= COLLAPSED_ROWS
  const showAll = expanded || highlightHidden
  const visible = showAll ? requests : requests.slice(0, COLLAPSED_ROWS)
  const hiddenCount = requests.length - COLLAPSED_ROWS

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

  // The library list's row, read on every render so an upload made in the form shows at once.
  const previewLead = previewing ? (previewing.variations.find((variation) => variation.isDefault) ?? previewing.variations[0]) : undefined
  const previewExercise = previewLead ? libraryExercises.find((exercise) => exercise.id === previewLead.id) ?? null : null

  function openPreview(item: AdminExerciseShareRequest) {
    const lead = item.variations.find((variation) => variation.isDefault) ?? item.variations[0]
    if (!lead || !libraryExercises.some((exercise) => exercise.id === lead.id)) {
      toast({ title: copy.previewMissing, tone: "error" })
      return
    }
    setPreviewing(item)
  }

  async function savePreview(item: AdminExerciseShareRequest, data: ExerciseSaveData, approve: boolean) {
    if (!onSaveExercise) return
    try {
      await onSaveExercise(data)
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : copy.saveError, tone: "error" })
      return
    }
    setPreviewing(null)
    // The console already confirms the save; approving adds its own message.
    if (approve) await decide(item, { decision: "approve" })
  }

  return (
    <Card className="mb-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">{copy.heading}</h3>
        <Badge variant="outline" className="font-mono text-micro">{copy.pending(requests.length)}</Badge>
      </div>
      {visible.map((item) => (
        <RequestRow
          key={item.id}
          busy={busyId === item.id}
          highlighted={item.id === highlightedId}
          item={item}
          locale={locale}
          onApprove={() => void decide(item, { decision: "approve" })}
          onMerge={() => setMerging(item)}
          onPreview={onSaveExercise ? () => openPreview(item) : undefined}
          onReject={() => setRejecting(item)}
        />
      ))}
      {hiddenCount > 0 && !highlightHidden ? (
        <button
          type="button"
          aria-expanded={showAll}
          className="flex w-full items-center justify-center gap-1 border-t border-border/60 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          onClick={() => setExpanded((value) => !value)}
        >
          {showAll ? copy.showFewer : copy.showMore(hiddenCount)}
          <ChevronDown className={cn("size-3.5 transition-transform", showAll && "rotate-180")} />
        </button>
      ) : null}

      {previewing && previewExercise ? (
        <ExerciseFormModal
          allowMedia={false}
          approveLabel={copy.saveAndApprove}
          initial={previewExercise}
          locale={locale}
          media={onSaveMedia && onRemoveMedia ? {
            onRemove: () => onRemoveMedia(previewExercise.id),
            onSave: (files) => onSaveMedia(previewExercise.id, files),
          } : undefined}
          saving={savingExerciseId === previewExercise.id || busyId === previewing.id}
          onClose={() => setPreviewing(null)}
          onSave={(data, options) => void savePreview(previewing, data, options?.approve === true)}
        />
      ) : null}

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
