"use client"

import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, Minus, Pencil, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ExerciseSyncPreview } from "@/lib/admin/types"

type Props = {
  locale: "en" | "vi"
  onApply: () => void
  onClose: () => void
  open: boolean
  preview: ExerciseSyncPreview | null
  applying: boolean
}

function ExerciseSyncReviewModal({ locale, onApply, onClose, open, preview, applying }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["added", "modified", "deleted"]))

  if (!preview) return null

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const actionableDeletes = preview.deleted.filter((d) => d.canDelete).length
  const skippedDeletes = preview.deleted.length - actionableDeletes
  const conflictCount = preview.modified.filter((m) => m.hasConflict).length
  const actionableModified = preview.modified.length - conflictCount
  const totalChanges = preview.added.length + actionableModified + actionableDeletes

  const t = locale === "en"
    ? {
        title: "Review sync changes",
        description: "Review the changes detected from your Excel file before applying.",
        added: "Added",
        modified: "Modified",
        deleted: "Deleted",
        unchanged: "unchanged",
        noChanges: "No changes detected.",
        cannotDelete: "In use — cannot delete",
        apply: `Apply ${totalChanges} change${totalChanges !== 1 ? "s" : ""}`,
        cancel: "Cancel",
        usages: "uses",
        inUseWarning: `${skippedDeletes} exercise${skippedDeletes !== 1 ? "s" : ""} in use will be skipped`,
      }
    : {
        title: "Xem lại thay đổi",
        description: "Xem lại các thay đổi từ file Excel trước khi áp dụng.",
        added: "Thêm mới",
        modified: "Sửa đổi",
        deleted: "Xoá",
        unchanged: "không đổi",
        noChanges: "Không có thay đổi nào.",
        cannotDelete: "Đang dùng — không thể xoá",
        apply: `Áp dụng ${totalChanges} thay đổi`,
        cancel: "Huỷ",
        usages: "lần dùng",
        inUseWarning: `${skippedDeletes} bài tập đang dùng sẽ bị bỏ qua`,
      }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-sm">
          {preview.added.length > 0 && (
            <Badge variant="default" className="bg-green-600">{t.added}: {preview.added.length}</Badge>
          )}
          {preview.modified.length > 0 && (
            <Badge variant="default" className="bg-blue-600">{t.modified}: {preview.modified.length}</Badge>
          )}
          {preview.deleted.length > 0 && (
            <Badge variant="default" className="bg-red-600">{t.deleted}: {preview.deleted.length}</Badge>
          )}
          {preview.unchangedCount > 0 && (
            <Badge variant="secondary">{preview.unchangedCount} {t.unchanged}</Badge>
          )}
        </div>

        {totalChanges === 0 && skippedDeletes === 0 ? (
          <p className="text-muted-foreground text-sm py-4">{t.noChanges}</p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {preview.added.length > 0 && (
              <SyncSection
                label={t.added}
                count={preview.added.length}
                color="text-green-600"
                icon={<Plus className="size-4" />}
                expanded={expandedSections.has("added")}
                onToggle={() => toggleSection("added")}
              >
                {preview.added.map((item, i) => (
                  <div key={i} className="text-sm py-1.5 border-b border-border/50 last:border-0">
                    <span className="font-medium">{item.exerciseName}</span>
                    {item.variationName !== "Default" && (
                      <span className="text-muted-foreground"> &middot; {item.variationName}</span>
                    )}
                    <span className="text-muted-foreground text-xs ml-2">({item.muscleGroup})</span>
                    {item.equipment && (
                      <span className="text-muted-foreground text-xs ml-1">— {item.equipment}</span>
                    )}
                  </div>
                ))}
              </SyncSection>
            )}

            {preview.modified.length > 0 && (
              <SyncSection
                label={`${t.modified}${conflictCount > 0 ? (locale === "en" ? ` (${conflictCount} conflict${conflictCount !== 1 ? "s" : ""} will be skipped)` : ` (${conflictCount} trùng tên sẽ bỏ qua)`) : ""}`}
                count={preview.modified.length}
                color="text-blue-600"
                icon={<Pencil className="size-4" />}
                expanded={expandedSections.has("modified")}
                onToggle={() => toggleSection("modified")}
              >
                {preview.modified.map((item) => (
                  <div key={item.id} className={`text-sm py-1.5 border-b border-border/50 last:border-0 ${item.hasConflict ? "opacity-50" : ""}`}>
                    <div className="font-medium flex items-start gap-2">
                      <span>
                        {item.exerciseName}
                        {item.variationName !== "Default" && (
                          <span className="text-muted-foreground font-normal"> &middot; {item.variationName}</span>
                        )}
                        {item.usageCount > 0 && (
                          <span className="text-muted-foreground text-xs ml-2">({item.usageCount} {t.usages})</span>
                        )}
                      </span>
                      {item.hasConflict && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 whitespace-nowrap shrink-0">
                          <AlertTriangle className="size-3.5" />
                          {locale === "en" ? "Name conflict" : "Trùng tên"}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 space-y-0.5">
                      {Object.entries(item.changes).map(([field, change]) => (
                        <div key={field} className="text-xs text-muted-foreground">
                          <span className="capitalize">{field === "exerciseName" ? "name" : field === "variationName" ? "variation" : field === "muscleGroup" ? "muscle group" : field}</span>
                          {": "}
                          <span className="line-through text-red-500/80">{change.from || "—"}</span>
                          {" → "}
                          <span className="text-green-600">{change.to || "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </SyncSection>
            )}

            {preview.deleted.length > 0 && (
              <SyncSection
                label={t.deleted}
                count={preview.deleted.length}
                color="text-red-600"
                icon={<Minus className="size-4" />}
                expanded={expandedSections.has("deleted")}
                onToggle={() => toggleSection("deleted")}
              >
                {preview.deleted.map((item) => (
                  <div key={item.id} className="text-sm py-1.5 border-b border-border/50 last:border-0 flex items-start gap-2">
                    <div className="flex-1">
                      <span className="font-medium">{item.exerciseName}</span>
                      {item.variationName !== "Default" && (
                        <span className="text-muted-foreground"> &middot; {item.variationName}</span>
                      )}
                      <span className="text-muted-foreground text-xs ml-2">({item.muscleGroup})</span>
                    </div>
                    {!item.canDelete && (
                      <div className="flex items-center gap-1 text-xs text-amber-600 whitespace-nowrap">
                        <AlertTriangle className="size-3.5" />
                        {t.cannotDelete} ({item.usageCount})
                      </div>
                    )}
                  </div>
                ))}
                {skippedDeletes > 0 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="size-3.5" />
                    {t.inUseWarning}
                  </p>
                )}
              </SyncSection>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={applying}>{t.cancel}</Button>
          <Button onClick={onApply} disabled={totalChanges === 0 || applying}>
            {applying
              ? (locale === "en" ? "Applying..." : "Đang áp dụng...")
              : t.apply}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SyncSection({
  label,
  count,
  color,
  icon,
  expanded,
  onToggle,
  children,
}: {
  label: string
  count: number
  color: string
  icon: React.ReactNode
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <span className={color}>{icon}</span>
        <span className={color}>{label}</span>
        <Badge variant="secondary" className="ml-auto">{count}</Badge>
      </button>
      {expanded && (
        <div className="px-3 pb-2">
          {children}
        </div>
      )}
    </div>
  )
}

export { ExerciseSyncReviewModal }
