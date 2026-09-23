"use client"

import { useState } from "react"
import { AlertCircle, Check, Loader2, Pencil, Search, Utensils, X } from "lucide-react"

import { useToast } from "@/components/providers/toast-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FilterChip } from "@/components/ui/filter-chip"
import { Input } from "@/components/ui/input"
import { InputWithIcon } from "@/components/ui/input-with-icon"
import { Textarea } from "@/components/ui/textarea"
import type { AdminCustomFoodItem } from "@/lib/admin/types"
import { useAdminCustomFoods, useReviewAdminCustomFoodRequest, useUpdateAdminCustomFoodRequest } from "@/lib/queries/admin"

type StatusFilter = AdminCustomFoodItem["reviewStatus"] | "all"

const STATUS_FILTERS: StatusFilter[] = ["pending", "approved", "rejected", "all"]

const FOOD_CATEGORIES = ["staple", "protein", "veg", "fruit", "dish", "drink", "other"] as const

const CATEGORY_LABELS: Record<(typeof FOOD_CATEGORIES)[number], { en: string; vi: string }> = {
  dish: { en: "Dishes", vi: "Món ăn" },
  drink: { en: "Drinks", vi: "Đồ uống" },
  fruit: { en: "Fruit", vi: "Trái cây" },
  other: { en: "Other", vi: "Khác" },
  protein: { en: "Protein", vi: "Đạm" },
  staple: { en: "Staples", vi: "Tinh bột" },
  veg: { en: "Vegetables", vi: "Rau củ" },
}

type FoodEdit = {
  calories: string
  carbs: string
  category: string
  fat: string
  name: string
  nameEn: string
  protein: string
  servingLabel: string
}

function editFrom(food: AdminCustomFoodItem): FoodEdit {
  return {
    calories: String(food.calories),
    carbs: String(food.carbs),
    category: food.category,
    fat: String(food.fat),
    name: food.name,
    nameEn: food.nameEn ?? "",
    protein: String(food.protein),
    servingLabel: food.servingLabel,
  }
}

/**
 * Correcting a submitted food in place before deciding on it. Saving does not
 * approve — the decision buttons below stay a separate step.
 */
function FoodEditor({
  food,
  locale,
  onCancel,
  onSaved,
}: {
  food: AdminCustomFoodItem
  locale: "en" | "vi"
  onCancel: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const updateFood = useUpdateAdminCustomFoodRequest()
  const [edit, setEdit] = useState<FoodEdit>(() => editFrom(food))
  const en = locale === "en"
  const set = (key: keyof FoodEdit) => (event: { target: { value: string } }) => setEdit((current) => ({ ...current, [key]: event.target.value }))
  const canSave = edit.name.trim() && edit.servingLabel.trim() && Number(edit.calories) > 0

  async function save() {
    try {
      await updateFood.mutateAsync([
        food.id,
        {
          calories: Number(edit.calories),
          carbs: edit.carbs ? Number(edit.carbs) : undefined,
          category: edit.category,
          fat: edit.fat ? Number(edit.fat) : undefined,
          name: edit.name.trim(),
          nameEn: edit.nameEn.trim() || undefined,
          protein: edit.protein ? Number(edit.protein) : undefined,
          servingLabel: edit.servingLabel.trim(),
        },
      ])
      toast({ title: en ? "Food updated. It still needs a decision." : "Đã lưu món. Món vẫn chờ bạn duyệt.", tone: "success" })
      onSaved()
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : en ? "Unable to save the food." : "Không thể lưu món.", tone: "error" })
    }
  }

  const field = (label: string, key: keyof FoodEdit, props: { inputMode?: "decimal"; placeholder?: string; type?: string } = {}) => (
    <label className="block min-w-0">
      <span className="label-micro mb-1 block">{label}</span>
      <Input className="h-9" value={edit[key]} onChange={set(key)} {...props} />
    </label>
  )

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {field(en ? "Name" : "Tên món", "name")}
        {field(en ? "English name" : "Tên tiếng Anh", "nameEn")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="label-micro mb-1 block">{en ? "Group" : "Nhóm"}</span>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
            value={edit.category}
            onChange={set("category")}
          >
            {FOOD_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category][locale]}
              </option>
            ))}
          </select>
        </label>
        {field(en ? "Serving" : "Khẩu phần", "servingLabel", { placeholder: en ? "e.g. 1 bowl (500 g)" : "VD: 1 tô (500 g)" })}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {field("kcal", "calories", { inputMode: "decimal", type: "number" })}
        {field("P", "protein", { inputMode: "decimal", type: "number" })}
        {field("C", "carbs", { inputMode: "decimal", type: "number" })}
        {field("F", "fat", { inputMode: "decimal", type: "number" })}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" type="button" variant="ghost" onClick={onCancel}>
          {en ? "Cancel" : "Huỷ"}
        </Button>
        <Button disabled={!canSave || updateFood.isPending} size="sm" type="button" onClick={() => void save()}>
          {updateFood.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {en ? "Save changes" : "Lưu thay đổi"}
        </Button>
      </div>
    </div>
  )
}

function statusVariant(status: AdminCustomFoodItem["reviewStatus"]) {
  return status === "approved" ? ("default" as const) : status === "rejected" ? ("destructive" as const) : ("secondary" as const)
}

export function AdminFoodsPanel({ locale }: { locale: "en" | "vi" }) {
  const { toast } = useToast()
  const [status, setStatus] = useState<StatusFilter>("pending")
  const [search, setSearch] = useState("")
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
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
              {food.nameEn ? <p className="mt-1 text-xs text-muted-foreground">{food.nameEn}</p> : null}
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="min-w-0 font-mono text-xs text-muted-foreground">
                  {food.servingLabel} · {Math.round(food.calories)} kcal · P{Math.round(food.protein)} C{Math.round(food.carbs)} F{Math.round(food.fat)}
                </p>
                {/* Approved foods live in the shared library; this queue only corrects submissions. */}
                {food.source === "user" && editingId !== food.id ? (
                  <Button className="shrink-0" size="sm" type="button" variant="ghost" onClick={() => setEditingId(food.id)}>
                    <Pencil className="size-3.5" />
                    {locale === "en" ? "Edit" : "Sửa"}
                  </Button>
                ) : null}
              </div>
              {editingId === food.id ? (
                <FoodEditor food={food} locale={locale} onCancel={() => setEditingId(null)} onSaved={() => setEditingId(null)} />
              ) : null}
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
