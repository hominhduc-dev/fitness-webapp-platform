"use client"

import { Sparkles } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import type { MicronutrientLine, NutrientCoverage } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"

const GROUP_ORDER: Array<MicronutrientLine["kind"]> = ["mineral", "vitamin", "macro_detail"]

function formatAmount(value: number) {
  if (value >= 100) return Math.round(value).toLocaleString("en-US")
  if (value >= 10) return String(Math.round(value * 10) / 10)
  return String(Math.round(value * 100) / 100)
}

/**
 * The micronutrient panel under the day's summary: one bar per nutrient,
 * grouped. "Reach" nutrients fill toward their target; "limit" nutrients fill
 * toward a ceiling and turn to the warning colour once past it.
 */
export function NutritionDetails({ coverage, lines }: { coverage?: NutrientCoverage; lines: MicronutrientLine[] }) {
  const { locale, messages } = useLocale()
  const labels = messages.meals

  if (!coverage || coverage.items === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{labels.nutrientEmpty}</p>
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{labels.nutrientCoverage(coverage.itemsWithData, coverage.items)}</p>
        {coverage.aiEstimated ? (
          <p className="flex items-center gap-1.5">
            <Sparkles className="size-3 shrink-0 text-primary" />
            {labels.nutrientAiEstimated}
          </p>
        ) : null}
      </div>

      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        {GROUP_ORDER.map((kind) => {
          const group = lines.filter((line) => line.kind === kind)
          if (group.length === 0) return null
          return (
            <section key={kind} className="min-w-0">
              <p className="label-micro mb-2.5">{labels.nutrientGroups[kind]}</p>
              <ul className="space-y-2.5">
                {group.map((line) => (
                  <NutrientRow key={line.code} line={line} name={locale === "en" ? line.nameEn : line.nameVi} labels={labels} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function NutrientRow({
  labels,
  line,
  name,
}: {
  labels: { nutrientLimit: string; nutrientNoData: string; nutrientNoTarget: string }
  line: MicronutrientLine
  name: string
}) {
  const target = line.target?.amount ?? 0
  const share = line.amount != null && target > 0 ? line.amount / target : 0
  const overLimit = line.target?.kind === "limit" && share > 1
  const barClass = line.target?.kind === "limit" ? (overLimit ? "bg-warning" : "bg-success") : "bg-primary"

  return (
    <li className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-foreground">{name}</span>
        <span className={cn("shrink-0 font-mono text-[0.6875rem] tnum", overLimit ? "text-warning-text" : "text-muted-foreground")}>
          {line.amount == null ? (
            labels.nutrientNoData
          ) : (
            <>
              <span className="font-semibold text-foreground">{formatAmount(line.amount)}</span>
              {line.target ? (
                <>
                  {" / "}
                  {line.target.kind === "limit" ? `${labels.nutrientLimit} ` : ""}
                  {formatAmount(line.target.amount)}
                </>
              ) : null}{" "}
              {line.unit}
            </>
          )}
        </span>
      </div>
      {line.target ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", barClass)} style={{ width: `${Math.min(share * 100, 100)}%` }} />
        </div>
      ) : (
        <p className="text-micro text-muted-foreground">{labels.nutrientNoTarget}</p>
      )}
    </li>
  )
}
