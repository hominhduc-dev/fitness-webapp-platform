"use client"

import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import { useState } from "react"

import { PlannedMealsList } from "@/components/meals/planned-meals-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AI_MEAL_TYPE_LABELS } from "@/lib/nutrition/meal-plan"
import {
  useCoachTraineeMealPlan,
  useDeleteCoachTraineeMealItem,
  useReviewCoachTraineeMealPlan,
  useUpdateCoachTraineeMealItem,
} from "@/lib/queries/coach-meal-plan"

/** Lets a coach adjust and approve a trainee's planned meals before they are eaten. */
export function TraineeMealPlanPanel({ traineeId }: { traineeId: string }) {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const planQuery = useCoachTraineeMealPlan(traineeId, date)
  const updateItem = useUpdateCoachTraineeMealItem()
  const deleteItem = useDeleteCoachTraineeMealItem()
  const review = useReviewCoachTraineeMealPlan()

  const plannedMeals = planQuery.data?.plannedMeals ?? []
  const busy = updateItem.isPending || deleteItem.isPending || review.isPending
  const reviewedAt = plannedMeals.find((meal) => meal.coachReviewedAt)?.coachReviewedAt
  const plannedCalories = plannedMeals.reduce((sum, meal) => sum + meal.calories, 0)

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được thực đơn.")
    }
  }

  const submitReview = () =>
    run(async () => {
      await review.mutateAsync([traineeId, { date, note: note.trim() || undefined }])
      setSent(true)
      setNote("")
    })

  return (
    <div className="rounded-lg border border-border p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Thực đơn dự kiến</h2>
          <p className="mt-1 text-sm text-muted-foreground">Xem, chỉnh khẩu phần và duyệt thực đơn AI trước khi trainee ăn.</p>
        </div>
        <div className="w-full sm:w-44">
          <Label htmlFor="trainee-meal-plan-date" className="label-micro">
            Ngày
          </Label>
          <Input
            id="trainee-meal-plan-date"
            type="date"
            className="mt-1"
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              setSent(false)
            }}
          />
        </div>
      </div>

      {error ? <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive-text">{error}</div> : null}

      {planQuery.isPending ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Đang tải thực đơn...
        </p>
      ) : plannedMeals.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">Trainee chưa có thực đơn dự kiến cho ngày này.</p>
      ) : (
        <>
          <p className="mt-4 text-xs text-muted-foreground tnum">
            {Math.round(plannedCalories)} / {planQuery.data?.targets.calories ?? 0} kcal
            {reviewedAt ? ` · Đã duyệt lúc ${format(reviewedAt, "HH:mm dd/MM")}` : ""}
          </p>
          <div className="mt-3">
            <PlannedMealsList
              meals={plannedMeals}
              getMealLabel={(type) => AI_MEAL_TYPE_LABELS[type]}
              disabled={busy}
              onChangeAmount={(itemId, amountValue) => void run(() => updateItem.mutateAsync([traineeId, itemId, amountValue]))}
              onDeleteItem={(itemId) => void run(() => deleteItem.mutateAsync([traineeId, itemId]))}
            />
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="trainee-meal-plan-note">Ghi chú cho trainee</Label>
            <Textarea
              id="trainee-meal-plan-note"
              maxLength={500}
              placeholder="VD: thêm rau vào bữa tối, giảm cơm buổi tối..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="flex items-center justify-end gap-3">
              {sent ? <span className="text-xs text-success-text">Đã gửi duyệt cho trainee</span> : null}
              <Button disabled={busy} onClick={() => void submitReview()}>
                {review.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Duyệt thực đơn
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
