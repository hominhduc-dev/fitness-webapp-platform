"use client"

import { useState } from "react"
import { AlertCircle, Check, Loader2, Search, Utensils, X } from "lucide-react"

import { useToast } from "@/components/providers/toast-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FilterChip } from "@/components/ui/filter-chip"
import { InputWithIcon } from "@/components/ui/input-with-icon"
import { Textarea } from "@/components/ui/textarea"
import type { AdminCustomFoodItem } from "@/lib/admin/types"
import { useAdminCustomFoods, useReviewAdminCustomFoodRequest } from "@/lib/queries/admin"

type StatusFilter = AdminCustomFoodItem["reviewStatus"] | "all"

const STATUS_FILTERS: StatusFilter[] = ["pending", "approved", "rejected", "all"]

function statusVariant(status: AdminCustomFoodItem["reviewStatus"]) {
  return status === "approved" ? ("default" as const) : status === "rejected" ? ("destructive" as const) : ("secondary" as const)
}

export function AdminFoodsPanel({ locale }: { locale: "en" | "vi" }) {
  const { toast } = useToast()
  const [status, setStatus] = useState<StatusFilter>("pending")
  const [search, setSearch] = useState("")
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const foodsQuery = useAdminCustomFoods({ search, status })
  const reviewFood = useReviewAdminCustomFoodRequest()
  const foods = foodsQuery.data ?? []

  const statusLabel = (value: StatusFilter) =>
    locale === "en"
      ? value
      : value === "pending"
        ? "chờ duyệt"
        : value === "approved"
          ? "đã duyệt"
          : value === "rejected"
            ? "từ chối"
            : "tất cả"

  async function decide(food: AdminCustomFoodItem, decision: "approved" | "rejected") {
    setReviewingId(food.id)
    try {
      await reviewFood.mutateAsync([food.id, { decision, reviewNote: notes[food.id] }])
      toast({
        title:
          decision === "approved"
            ? locale === "en"
              ? `“${food.name}” is now available system-wide.`
              : `“${food.name}” đã hiển thị trên toàn hệ thống.`
            : locale === "en"
              ? `“${food.name}” remains private to its creator.`
              : `“${food.name}” vẫn chỉ hiển thị cho người tạo.`,
        tone: "success",
      })
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Không thể duyệt món ăn.", tone: "error" })
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <InputWithIcon
            icon={<Search />}
                        placeholder={locale === "en" ? "Search food or creator…" : "Tìm món hoặc người tạo…"}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((value) => (
            <FilterChip
              key={value}
              active={status === value}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {statusLabel(value)}
            </FilterChip>
          ))}
        </div>
      </div>

      {foodsQuery.isPending ? (
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">{locale === "en" ? "Loading foods…" : "Đang tải món ăn…"}</div>
      ) : foodsQuery.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{foodsQuery.error.message}</AlertDescription>
        </Alert>
      ) : foods.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-8 text-center">
          <Utensils aria-hidden className="size-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            {locale === "en" ? "No custom foods match this filter." : "Không có món tuỳ chỉnh phù hợp bộ lọc."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Each food stays an <article>: it is a standalone item in the
              queue, and Card is a plain div with no asChild slot to lend its
              styling to a semantic element. */}
          {foods.map((food) => (
            <article key={food.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-foreground">{food.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{food.createdBy?.name ?? "—"} · {food.createdBy?.email ?? "—"}</p>
                </div>
                <Badge variant={statusVariant(food.reviewStatus)}>{statusLabel(food.reviewStatus)}</Badge>
              </div>
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                {food.servingLabel} · {Math.round(food.calories)} kcal · P{Math.round(food.protein)} C{Math.round(food.carbs)} F{Math.round(food.fat)}
              </p>
              <Textarea
                className="mt-3 min-h-20"
                placeholder={locale === "en" ? "Review note (optional)" : "Ghi chú duyệt (không bắt buộc)"}
                value={notes[food.id] ?? food.reviewNote ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [food.id]: event.target.value }))}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={reviewingId === food.id} onClick={() => void decide(food, "approved")}>
                  {reviewingId === food.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {locale === "en" ? "Approve globally" : "Duyệt toàn hệ thống"}
                </Button>
                <Button size="sm" variant="outline" disabled={reviewingId === food.id} onClick={() => void decide(food, "rejected")}>
                  <X className="size-4" />
                  {locale === "en" ? "Reject" : "Từ chối"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
