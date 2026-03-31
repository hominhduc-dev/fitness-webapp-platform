"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Search } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { logMeal, searchFoods } from "@/lib/fitness/api"
import type { FoodSearchResult } from "@/lib/fitness/types"
import type { Meal } from "@/lib/types"

type RecentFoodOption = {
  fdcId: number
  lastMealType: Meal["type"]
  lastWeightGrams?: number
  name: string
  nutritionPreview?: FoodSearchResult["nutritionPreview"]
}

type LogFoodDialogProps = {
  defaultType?: Meal["type"]
  description?: string
  onLogged?: (meal: Meal) => Promise<void> | void
  onOpenChange?: (open: boolean) => void
  open?: boolean
  recentFoods?: RecentFoodOption[]
  title?: string
  trigger?: React.ReactNode
}

function formatResultSubtitle(result: FoodSearchResult) {
  return [result.dataType, result.brandOwner].filter(Boolean).join(" • ")
}

function formatNumber(value?: number, fractionDigits = 1) {
  if (value == null) {
    return undefined
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(fractionDigits)
}

function formatNutritionValue(value?: number, unit?: string, fractionDigits = 1) {
  const formatted = formatNumber(value, fractionDigits)
  return formatted == null ? "-" : `${formatted}${unit ?? ""}`
}

function SearchResultNutritionPreview({ result }: { result: FoodSearchResult }) {
  const { messages } = useLocale()

  if (!result.nutritionPreview) {
    return null
  }

  const { calories, carbs, fat, fiber, protein, sodium, sugar } = result.nutritionPreview
  const nutrientItems = [
    { label: messages.meals.protein, unit: "g", value: protein },
    { label: messages.meals.carbs, unit: "g", value: carbs },
    { label: messages.meals.fat, unit: "g", value: fat },
    { label: "Fiber", unit: "g", value: fiber },
    { label: "Sugar", unit: "g", value: sugar },
    { fractionDigits: 0, label: "Sodium", unit: "mg", value: sodium },
  ]

  return (
    <div className="mt-2 rounded-md bg-muted/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {messages.meals.nutritionPreviewPer100g}
        </span>
        {calories != null ? <Badge variant="secondary">{`${formatNumber(calories)} kcal`}</Badge> : null}
      </div>

      <div className="-mx-1 mt-2 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2 px-1">
          {nutrientItems.map((item) => (
            <div key={item.label} className="min-w-[88px] rounded-md bg-background px-2 py-1.5">
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
              <p className="text-xs font-medium text-foreground">
                {formatNutritionValue(item.value, item.unit, item.fractionDigits ?? 1)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LogFoodDialog({
  defaultType,
  description,
  onLogged,
  onOpenChange,
  open,
  recentFoods = [],
  title,
  trigger,
}: LogFoodDialogProps) {
  const { isLoading: authLoading, session } = useAuth()
  const { messages } = useLocale()
  const [internalOpen, setInternalOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<FoodSearchResult[]>([])
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null)
  const [weightGrams, setWeightGrams] = useState("")
  const [mealType, setMealType] = useState<Meal["type"]>(defaultType ?? "breakfast")
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isControlled = typeof open === "boolean"
  const resolvedOpen = isControlled ? open : internalOpen

  const canSubmit = useMemo(() => {
    const grams = Number(weightGrams)
    return Boolean(selectedFood) && Number.isFinite(grams) && grams > 0 && !isSubmitting
  }, [isSubmitting, selectedFood, weightGrams])

  const resetState = () => {
    setError(null)
    setHasSearched(false)
    setMealType(defaultType ?? "breakfast")
    setQuery("")
    setResults([])
    setSelectedFood(null)
    setWeightGrams("")
  }

  useEffect(() => {
    if (resolvedOpen) {
      resetState()
    }
  }, [defaultType, resolvedOpen])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }

  const handleSearch = async () => {
    if (!session?.access_token) {
      return
    }

    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setError(messages.meals.searchValidation)
      setHasSearched(false)
      setResults([])
      setSelectedFood(null)
      return
    }

    setError(null)
    setHasSearched(true)
    setIsSearching(true)
    setSelectedFood(null)

    try {
      const response = await searchFoods(session.access_token, trimmedQuery)
      setResults(response.results)
    } catch (searchError) {
      setResults([])
      setError(searchError instanceof Error ? searchError.message : messages.meals.searchError)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!session?.access_token || !selectedFood) {
      return
    }

    const parsedWeight = Number(weightGrams)

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setError(messages.meals.weightValidation)
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const meal = await logMeal(session.access_token, {
        fdcId: selectedFood.fdcId,
        mealType,
        weightGrams: parsedWeight,
      })

      await onLogged?.(meal)
      handleOpenChange(false)
      resetState()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : messages.meals.logMealError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
      {trigger === null ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              {messages.meals.addMeal}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
          <DialogTitle>{title ?? messages.meals.addMealTitle}</DialogTitle>
          <DialogDescription>{description ?? messages.meals.addMealDescription}</DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="food-query">{messages.meals.foodSearchLabel}</Label>
              <div className="flex gap-2">
                <Input
                  id="food-query"
                  placeholder={messages.meals.foodSearchPlaceholder}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Button
                  className="shrink-0"
                  disabled={authLoading || !session?.access_token || isSearching}
                  type="button"
                  variant="outline"
                  onClick={() => void handleSearch()}
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="sr-only">{messages.meals.searchAction}</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>{hasSearched ? messages.meals.searchResults : messages.meals.recentFoods}</Label>
                {isSearching ? <span className="text-sm text-muted-foreground">{messages.meals.searching}</span> : null}
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-muted/10 p-2">
                {!hasSearched && recentFoods.length > 0 ? (
                  <div className="space-y-2">
                    <p className="px-2 pb-1 text-sm text-muted-foreground">{messages.meals.recentFoodsHint}</p>
                    {recentFoods.map((food) => {
                      const selected = selectedFood?.fdcId === food.fdcId
                      const mealTypeLabel =
                        food.lastMealType === "breakfast"
                          ? messages.meals.breakfast
                          : food.lastMealType === "lunch"
                            ? messages.meals.lunch
                            : food.lastMealType === "dinner"
                              ? messages.meals.dinner
                              : messages.meals.snack

                      return (
                        <button
                          key={`recent-${food.fdcId}`}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                            selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"
                          }`}
                          type="button"
                          onClick={() => {
                            setSelectedFood({
                              fdcId: food.fdcId,
                              name: food.name,
                              nutritionPreview: food.nutritionPreview,
                            })

                            if (!defaultType) {
                              setMealType(food.lastMealType)
                            }

                            if (food.lastWeightGrams != null) {
                              setWeightGrams(String(food.lastWeightGrams))
                            }
                          }}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{food.name}</p>
                            <Badge variant="outline">{mealTypeLabel}</Badge>
                          </div>
                          {food.lastWeightGrams != null ? (
                            <p className="mt-1 text-sm text-muted-foreground">{`${formatNumber(food.lastWeightGrams)}g`}</p>
                          ) : null}
                          {food.nutritionPreview ? (
                            <SearchResultNutritionPreview
                              result={{
                                fdcId: food.fdcId,
                                name: food.name,
                                nutritionPreview: food.nutritionPreview,
                              }}
                            />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ) : !hasSearched ? (
                  <p className="px-2 py-4 text-sm text-muted-foreground">{messages.meals.searchHint}</p>
                ) : results.length === 0 ? (
                  <p className="px-2 py-4 text-sm text-muted-foreground">{messages.meals.noSearchResults}</p>
                ) : (
                  <div className="space-y-2">
                    {results.map((result) => {
                      const selected = selectedFood?.fdcId === result.fdcId

                      return (
                        <button
                          key={result.fdcId}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                            result.canLogByGram === false
                              ? "cursor-not-allowed border-border bg-muted/40 opacity-70"
                              : selected
                                ? "border-primary bg-primary/5"
                                : "border-border bg-background hover:border-primary/40"
                          }`}
                          disabled={result.canLogByGram === false}
                          type="button"
                          onClick={() => {
                            if (result.canLogByGram === false) {
                              return
                            }

                            setSelectedFood(result)
                          }}
                        >
                          <p className="font-medium text-foreground">{result.name}</p>
                          {formatResultSubtitle(result) ? (
                            <p className="mt-1 text-sm text-muted-foreground">{formatResultSubtitle(result)}</p>
                          ) : null}
                          <SearchResultNutritionPreview result={result} />
                          {result.logWarning ? <p className="mt-1 text-xs text-amber-700">{result.logWarning}</p> : null}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weight-grams">{messages.meals.weightGramsLabel}</Label>
                <Input
                  id="weight-grams"
                  min="1"
                  placeholder={messages.meals.weightGramsPlaceholder}
                  step="1"
                  type="number"
                  value={weightGrams}
                  onChange={(event) => setWeightGrams(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meal-type">{messages.meals.mealType}</Label>
                <Select value={mealType} onValueChange={(value) => setMealType(value as Meal["type"])}>
                  <SelectTrigger id="meal-type">
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
            </div>
          </div>

          <div className="shrink-0 border-t px-6 py-4">
            <p className="text-sm text-muted-foreground">{messages.meals.relogHint}</p>

            {error ? (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1 bg-transparent"
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {messages.meals.cancel}
              </Button>
              <Button className="flex-1" disabled={!canSubmit || authLoading || !session?.access_token} type="submit">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {messages.meals.addMeal}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
