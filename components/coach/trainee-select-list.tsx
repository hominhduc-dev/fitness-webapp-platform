"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import type { CoachTrainee } from "@/lib/fitness/types"
import { cn } from "@/lib/utils"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
}

/**
 * Searchable roster of the coach's trainees, one of whom can be picked: a
 * program belongs to a single trainee. Picking the selected row again clears it.
 * Purely a selection surface: the caller owns the id and decides what saving
 * means, which is what lets the assign dialog (existing program) and the import
 * review (program that does not exist yet) share the same list.
 */
export function TraineeSelectList({
  className,
  disabled,
  listClassName,
  onSelect,
  selectedId,
  trainees,
}: {
  className?: string
  disabled?: boolean
  listClassName?: string
  onSelect: (traineeId: string | null) => void
  selectedId: string | null
  trainees: CoachTrainee[]
}) {
  const { messages } = useLocale()
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      normalizedQuery
        ? trainees.filter((trainee) =>
            [trainee.name, trainee.email].some((value) => value?.toLowerCase().includes(normalizedQuery)),
          )
        : trainees,
    [normalizedQuery, trainees],
  )

  return (
    <div className={className}>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={messages.coach.searchClients}
          value={query}
        />
      </div>

      <div role="radiogroup" aria-label={messages.coach.assignClients} className={cn("mt-2 overflow-y-auto", listClassName)}>
        {visible.map((trainee) => {
          const isSelected = trainee.id === selectedId

          return (
            <button
              key={trainee.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelect(isSelected ? null : trainee.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60",
                isSelected && "bg-muted",
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={trainee.avatar || "/placeholder.svg"} alt="" />
                <AvatarFallback className="bg-primary-soft text-xs text-primary">
                  {getInitials(trainee.name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{trainee.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{trainee.email}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isSelected ? "border-primary" : "border-input",
                )}
              >
                {isSelected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
              </span>
            </button>
          )
        })}

        {visible.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            {trainees.length === 0 ? messages.coach.noTrainees : messages.coach.noClientsMatch}
          </p>
        ) : null}
      </div>
    </div>
  )
}
