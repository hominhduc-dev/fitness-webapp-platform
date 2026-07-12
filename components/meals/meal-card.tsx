"use client"

import { useState } from "react"
import { Clock, Edit2, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { Meal } from "@/lib/types"

interface MealCardProps {
  meal: Meal
  onEdit?: () => void
  onDelete?: () => void
}

const mealTypeColors = {
  breakfast: "bg-warning/10 text-warning border-warning/20",
  lunch: "bg-info/10 text-info border-info/20",
  dinner: "bg-accent/10 text-accent border-accent/20",
  snack: "bg-primary/10 text-primary border-primary/20",
}

const mealTypeIcons = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
}

export function MealCard({ meal, onEdit, onDelete }: MealCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl border text-xl",
              mealTypeColors[meal.type],
            )}
          >
            {mealTypeIcons[meal.type]}
          </div>
          <div className="text-left">
            <p className="font-semibold">{meal.name}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{format(meal.time, "h:mm a")}</span>
              <span>·</span>
              <span className="capitalize">{meal.type}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-bold text-lg">{meal.calories}</p>
            <p className="text-xs text-muted-foreground">kcal</p>
          </div>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 bg-muted/20">
          {/* Macros */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-info">{meal.protein || 0}g</p>
              <p className="text-xs text-muted-foreground">Protein</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">{meal.carbs || 0}g</p>
              <p className="text-xs text-muted-foreground">Carbs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-accent">{meal.fat || 0}g</p>
              <p className="text-xs text-muted-foreground">Fat</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2 bg-transparent" onClick={onEdit}>
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 bg-transparent"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
