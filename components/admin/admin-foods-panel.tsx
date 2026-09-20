"use client"

import { useState } from "react"
import { Check, Loader2, Search, X } from "lucide-react"

import { useToast } from "@/components/providers/toast-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={locale === "en" ? "Search food or creator…" : "Tìm món hoặc người tạo…"}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((value) => (
            <button
              key={value}
              className={`rounded px-3 py-1.5 font-mono text-xs transition-colors ${status === value ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}
              type="button"
              onClick={() => setStatus(value)}
            >
              {statusLabel(value)}
            </button>
          ))}
        </div>
      </div>

      {foodsQuery.isPending ? (
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">{locale === "en" ? "Loading foods…" : "Đang tải món ăn…"}</div>
      ) : foodsQuery.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive-soft p-4 text-sm text-destructive-text">{foodsQuery.error.message}</div>
      ) : foods.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{locale === "en" ? "No custom foods match this filter." : "Không có món tuỳ chỉnh phù hợp bộ lọc."}</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {foods.map((food) => (
            <article key={food.id} className="rounded-lg border border-border bg-card p-4">
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
