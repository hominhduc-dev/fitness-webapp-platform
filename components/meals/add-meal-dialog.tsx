"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { useLocale } from "@/components/providers/locale-provider"

interface AddMealDialogProps {
  description?: string
  initialMeal?: {
    calories: number
    carbs?: number
    fat?: number
    name: string
    protein?: number
    type: "breakfast" | "lunch" | "dinner" | "snack"
  }
  onAdd?: (meal: {
    name: string
    type: "breakfast" | "lunch" | "dinner" | "snack"
    calories: number
    protein?: number
    carbs?: number
    fat?: number
  }) => void
  onOpenChange?: (open: boolean) => void
  open?: boolean
  submitLabel?: string
  title?: string
  trigger?: React.ReactNode
}

export function AddMealDialog({
  description,
  initialMeal,
  onAdd,
  onOpenChange,
  open,
  submitLabel,
  title,
  trigger,
}: AddMealDialogProps) {
  const { messages } = useLocale()
  const [internalOpen, setInternalOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("breakfast")
  const [calories, setCalories] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const isControlled = typeof open === "boolean"
  const resolvedOpen = isControlled ? open : internalOpen

  const resetForm = () => {
    setName(initialMeal?.name ?? "")
    setType(initialMeal?.type ?? "breakfast")
    setCalories(initialMeal?.calories?.toString() ?? "")
    setProtein(initialMeal?.protein?.toString() ?? "")
    setCarbs(initialMeal?.carbs?.toString() ?? "")
    setFat(initialMeal?.fat?.toString() ?? "")
  }

  useEffect(() => {
    if (resolvedOpen) {
      resetForm()
    }
  }, [initialMeal, resolvedOpen])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onAdd?.({
      name,
      type,
      calories: Number.parseInt(calories) || 0,
      protein: Number.parseInt(protein) || undefined,
      carbs: Number.parseInt(carbs) || undefined,
      fat: Number.parseInt(fat) || undefined,
    })
    handleOpenChange(false)
    resetForm()
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {trigger === null ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4" />
              {messages.meals.addMeal}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title ?? messages.meals.addMealTitle}</DialogTitle>
          <DialogDescription>{description ?? messages.meals.addMealDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{messages.meals.mealName}</Label>
            <Input
              id="name"
              placeholder={messages.meals.mealNamePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">{messages.meals.mealType}</Label>
            <Select value={type} onValueChange={(v: typeof type) => setType(v)}>
              <SelectTrigger>
                <SelectValue placeholder={messages.meals.mealTypePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">🌅 {messages.meals.breakfast}</SelectItem>
                <SelectItem value="lunch">☀️ {messages.meals.lunch}</SelectItem>
                <SelectItem value="dinner">🌙 {messages.meals.dinner}</SelectItem>
                <SelectItem value="snack">🍎 {messages.meals.snack}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="calories">{messages.meals.caloriesLabel}</Label>
            <Input
              id="calories"
              type="number"
              placeholder={messages.meals.caloriesPlaceholder}
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="protein">Protein (g)</Label>
              <Input
                id="protein"
                type="number"
                placeholder="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carbs">Carbs (g)</Label>
              <Input
                id="carbs"
                type="number"
                placeholder="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fat">Fat (g)</Label>
              <Input id="fat" type="number" placeholder="0" value={fat} onChange={(e) => setFat(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => handleOpenChange(false)}
            >
              {messages.meals.cancel}
            </Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
              {submitLabel ?? messages.meals.addMeal}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
