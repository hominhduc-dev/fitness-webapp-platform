"use client"

import { useState } from "react"
import { Copy, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { CoachProgram } from "@/lib/fitness/types"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((value) => value[0])
    .join("")
    .slice(0, 2)
}

interface ProgramCardProps {
  program: CoachProgram
  busy?: boolean
  onEdit: () => void
  onAssign: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function formatEditedAt(value: Date) {
  const diffMs = Date.now() - value.getTime()
  const diffDays = Math.max(0, Math.floor(diffMs / 86_400_000))

  if (diffDays === 0) return "today"
  if (diffDays === 1) return "yesterday"
  if (diffDays < 14) return `${diffDays} days ago`

  const diffWeeks = Math.floor(diffDays / 7)
  return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`
}

/**
 * Lift-styled program card: hairline border, no shadow, 10px radius.
 * Kebab (top-right) opens Edit / Assign / Duplicate / Delete.
 */
export function ProgramCard({ program, busy, onEdit, onAssign, onDuplicate, onDelete }: ProgramCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const assigned = program.assignedTrainees ?? []

  return (
    <div
      className={cn(
        "flex min-h-[276px] flex-col gap-3.5 rounded-[10px] border border-border bg-card p-5 transition-colors hover:border-input",
        busy && "pointer-events-none opacity-60",
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold leading-snug tracking-[-0.01em]">{program.name}</h3>
          <p className="label-micro mt-1 text-muted-foreground">
            {program.duration} weeks · {program.workoutsPerWeek} days/week
          </p>
        </div>

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1 text-muted-foreground hover:bg-muted" aria-label="Program actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit program
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAssign}>
              <UserPlus className="h-4 w-4" />
              Assign
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDuplicate}>
              <Copy className="h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Description */}
      <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
        {program.description || "No description added."}
      </p>

      {/* Assigned strip */}
      <div className="flex min-h-12 items-center gap-2.5 rounded-md bg-muted px-3 py-2.5">
        {assigned.length > 0 ? (
          <>
            <div className="flex -space-x-2">
              {assigned.slice(0, 4).map((trainee) => (
                <Avatar key={trainee.id} className="h-6 w-6 border-2 border-muted">
                  <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="bg-foreground text-[10px] font-semibold text-background">
                    {getInitials(trainee.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="font-mono text-[11px] tnum text-muted-foreground">
              {assigned.length} active client{assigned.length === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <span className="label-micro">Not assigned yet</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button className="flex-1 gap-1.5 bg-foreground text-background hover:bg-foreground/90" onClick={onAssign}>
          <UserPlus className="h-3.5 w-3.5" />
          Assign
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      <p className="label-micro">Edited {formatEditedAt(program.createdAt)}</p>
    </div>
  )
}
