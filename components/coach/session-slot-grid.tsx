"use client"

import { memo, useCallback, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Bed, GripVertical, Pencil, Plus, X } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"

import { useLocale } from "@/components/providers/locale-provider"
import { TAG_DOT_COLOR, type RoutineTag } from "@/lib/fitness/routine-tag"
import type { AppMessages } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

export type SessionTag = Exclude<RoutineTag, "all">

/**
 * What one day of the week shows. Deliberately the smallest shape the card can
 * render from: the cards re-render on every pointer move that changes a drop
 * target, so they must not carry whole routines with their exercise arrays.
 */
export type SessionSlotView =
  | { kind: "rest" }
  | { kind: "empty" }
  | { exerciseCount: number; exerciseNames?: string[]; kind: "session"; name: string; tag: SessionTag }

/** Mouse and pen: a few pixels of travel, so a plain click still opens the day. */
const POINTER_ACTIVATION = { distance: 8 }

/**
 * Touch: hold before the drag takes over. Without the delay the browser cannot
 * tell "scroll the dialog" from "move this session" and the list judders; the
 * tolerance lets a finger wobble during the hold without cancelling it.
 */
const TOUCH_ACTIVATION = { delay: 250, tolerance: 6 }

const DROP_ANIMATION = { duration: 160, easing: "cubic-bezier(.2,.7,.2,1)" }

function getTagLabel(tag: SessionTag, messages: AppMessages) {
  const keyByTag: Record<SessionTag, keyof AppMessages["workoutPage"]> = {
    full: "tagFull",
    legs: "tagLegs",
    lower: "tagLower",
    pull: "tagPull",
    push: "tagPush",
    upper: "tagUpper",
  }

  return messages.workoutPage[keyByTag[tag]] as string
}

/**
 * The visual card for one day. Memoised because a drag re-renders the grid on
 * every change of drop target: without this, seven cards (and their icons) would
 * rebuild for each one, which is what costs frames on a phone.
 */
const SessionSlotCard = memo(function SessionSlotCard({
  dayLabel,
  dragHandle,
  isDragging,
  isOver,
  isOverlay,
  onClick,
  onEdit,
  onToggleRest,
  view,
}: {
  dayLabel: string
  dragHandle?: React.ReactNode
  isDragging?: boolean
  isOver?: boolean
  isOverlay?: boolean
  onClick?: () => void
  onEdit?: () => void
  onToggleRest?: () => void
  view: SessionSlotView
}) {
  const { messages } = useLocale()
  const isRest = view.kind === "rest"
  const isSession = view.kind === "session"

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        // Transitions are listed rather than `all`: animating every property
        // would fight the transform dnd-kit drives while a card is in hand.
        "group relative flex h-full min-h-[180px] flex-col overflow-hidden rounded-2xl border bg-card p-4 text-left shadow-sm transition-[border-color,background-color,box-shadow,opacity,transform] duration-200 ease-[cubic-bezier(.2,.7,.2,1)] lg:min-h-[190px]",
        isRest
          ? "border-dashed border-border/80 bg-background/35 hover:border-foreground/25 hover:bg-background/50"
          : "border-border/80 bg-background/65 hover:border-foreground/20 hover:bg-background/85 hover:shadow-md",
        isSession && "border-l-4 border-l-primary",
        !isRest && !isOverlay && !isDragging && "hover:-translate-y-0.5",
        isOver && "border-primary/70 bg-primary-soft/40 ring-2 ring-primary/40",
        isDragging && "opacity-40",
        isOverlay && "cursor-grabbing border-primary/60 bg-card shadow-2xl",
      )}
    >
      {view.kind === "session" ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 opacity-90"
          style={{ backgroundColor: TAG_DOT_COLOR[view.tag] }}
        />
      ) : null}

      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {dragHandle}
          <span className="rounded-full bg-muted/70 px-2 py-1 font-mono text-micro font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {dayLabel}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {view.kind === "session" && onEdit ? (
            <button
              type="button"
              aria-label={messages.coach.editRoutineExercises}
              title={messages.coach.editRoutineExercises}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground/80 transition-all hover:border-border hover:bg-background hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
            >
              <Pencil className="h-3 w-3" />
            </button>
          ) : null}
          {view.kind === "session" && onToggleRest ? (
            <button
              type="button"
              aria-label={messages.coach.markAsRestDay}
              title={messages.coach.markAsRestDay}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground/80 transition-all hover:border-destructive-border hover:bg-destructive-soft hover:text-destructive-text"
              onClick={(event) => {
                event.stopPropagation()
                onToggleRest()
              }}
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
          {view.kind === "empty" && onToggleRest ? (
            <span
              role="button"
              tabIndex={0}
              title={messages.coach.markAsRestDay}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-all hover:border-border hover:bg-background hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation()
                onToggleRest()
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  event.stopPropagation()
                  onToggleRest()
                }
              }}
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
        </span>
      </span>

      {view.kind === "session" ? (
        <span className="mt-5 flex min-w-0 flex-1 flex-col">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-[0.04em] text-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: TAG_DOT_COLOR[view.tag] }} />
            {getTagLabel(view.tag, messages)} ({view.name})
          </span>
          <span className="mt-3 block font-mono text-sm text-muted-foreground tnum">
            {messages.coach.exerciseCount(view.exerciseCount)}
          </span>
          <span className="mt-3 block space-y-1 text-xs text-muted-foreground">
            {(view.exerciseNames ?? []).slice(0, 3).map((exerciseName, index) => (
              <span key={`${exerciseName}-${index}`} className="block truncate">
                {index + 1}. {exerciseName}
              </span>
            ))}
          </span>
          <span className="mt-auto pt-3">
            <span className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/70 text-sm font-medium text-foreground transition-colors group-hover:bg-background">
              <Plus className="h-4 w-4" />
              Add exercise
            </span>
          </span>
        </span>
      ) : isRest ? (
        <span className="flex flex-1 flex-col items-center justify-center text-center text-muted-foreground">
          <Bed className="mb-3 h-7 w-7 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{messages.coach.rest} day</span>
          <span className="mt-1 max-w-[9rem] text-xs leading-relaxed">Recovery and come back stronger.</span>
          <span className="mt-auto w-full pt-3">
            <span className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/70 text-sm font-medium text-foreground transition-colors group-hover:bg-background">
              <Plus className="h-4 w-4" />
              Add note
            </span>
          </span>
        </span>
      ) : (
        <span className="flex flex-1 items-center justify-center text-muted-foreground">
          <Plus className="h-4 w-4" />
        </span>
      )}
    </div>
  )
})

function SessionSlotCell({
  dayIndex,
  dayLabel,
  disabled,
  onEdit,
  onOpen,
  onToggleRest,
  view,
}: {
  dayIndex: number
  dayLabel: string
  disabled: boolean
  onEdit: (dayIndex: number) => void
  onOpen: (dayIndex: number) => void
  onToggleRest: (dayIndex: number) => void
  view: SessionSlotView
}) {
  const { messages } = useLocale()
  const id = String(dayIndex)
  const isSession = view.kind === "session"
  const { attributes, isDragging, listeners, setNodeRef: setDragRef } = useDraggable({
    disabled: disabled || !isSession,
    id,
  })
  const { isOver, setNodeRef: setDropRef } = useDroppable({ disabled, id })

  const handleClick = useCallback(() => onOpen(dayIndex), [dayIndex, onOpen])
  const handleEdit = useCallback(() => onEdit(dayIndex), [dayIndex, onEdit])
  const handleToggleRest = useCallback(() => onToggleRest(dayIndex), [dayIndex, onToggleRest])

  const dragHandle = isSession && !disabled ? (
    <span
      {...attributes}
      {...listeners}
      title={messages.coach.moveSessionHint}
      // touch-none stops the browser from claiming the gesture as a scroll once
      // the hold has started, which is what makes the drag feel stuck otherwise.
      className="flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-full border border-transparent text-muted-foreground transition-all hover:border-border hover:bg-background hover:text-foreground active:cursor-grabbing"
      onClick={(event) => event.stopPropagation()}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </span>
  ) : null

  return (
    <div ref={setDropRef} className="h-full">
      <div ref={setDragRef} className="h-full">
        <SessionSlotCard
          dayLabel={dayLabel}
          dragHandle={dragHandle}
          isDragging={isDragging}
          isOver={isOver && !isDragging}
          onClick={disabled ? undefined : handleClick}
          onEdit={isSession ? handleEdit : undefined}
          onToggleRest={handleToggleRest}
          view={view}
        />
      </div>
    </div>
  )
}

/**
 * Drop semantics: the two days trade places whole. Moving a session onto a rest
 * day therefore makes that day a training day and the day it left a rest day, so
 * the program keeps the number of training days the coach picked.
 */
export function swapDaySlots<T>(slots: T[], fromDayIndex: number, toDayIndex: number): T[] {
  if (
    fromDayIndex === toDayIndex ||
    fromDayIndex < 0 ||
    toDayIndex < 0 ||
    fromDayIndex >= slots.length ||
    toDayIndex >= slots.length
  ) {
    return slots
  }

  const next = [...slots]
  const moved = next[fromDayIndex]
  next[fromDayIndex] = next[toDayIndex]
  next[toDayIndex] = moved
  return next
}

/**
 * The week's seven day cards, with a session draggable from one day onto another.
 *
 * Dropping swaps the two days whole, so moving a session onto a rest day trades
 * places with it and the program keeps the same number of training days.
 */
export function SessionSlotGrid({
  className,
  dayLabels,
  disabled = false,
  onEdit,
  onMove,
  onOpen,
  onToggleRest,
  views,
}: {
  className?: string
  dayLabels: string[]
  disabled?: boolean
  onEdit: (dayIndex: number) => void
  onMove: (fromDayIndex: number, toDayIndex: number) => void
  onOpen: (dayIndex: number) => void
  onToggleRest: (dayIndex: number) => void
  views: SessionSlotView[]
}) {
  const { messages } = useLocale()
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: POINTER_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDayIndex(Number(event.active.id))
  }, [])

  const handleDragCancel = useCallback(() => setActiveDayIndex(null), [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDayIndex(null)
      const from = Number(event.active.id)
      const to = event.over ? Number(event.over.id) : null

      if (to == null || Number.isNaN(from) || Number.isNaN(to) || from === to) {
        return
      }

      // Straight to local state: the schedule is only persisted when the coach
      // saves the program, so the grid never waits on the network to redraw.
      onMove(from, to)
    },
    [onMove],
  )

  const activeView = activeDayIndex == null ? null : views[activeDayIndex] ?? null
  const overlay = useMemo(() => {
    if (!activeView || activeDayIndex == null) {
      return null
    }

    return (
      <SessionSlotCard
        dayLabel={dayLabels[activeDayIndex] ?? ""}
        isOverlay
        view={activeView}
      />
    )
  }, [activeDayIndex, activeView, dayLabels])

  return (
    <DndContext
      accessibility={{ announcements: undefined, screenReaderInstructions: { draggable: messages.coach.moveSessionHint } }}
      collisionDetection={closestCenter}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-7", className)}>
        {views.map((view, dayIndex) => (
          <SessionSlotCell
            key={dayIndex}
            dayIndex={dayIndex}
            dayLabel={dayLabels[dayIndex] ?? ""}
            disabled={disabled}
            onEdit={onEdit}
            onOpen={onOpen}
            onToggleRest={onToggleRest}
            view={view}
          />
        ))}
      </div>

      {/* Portalled: the editor sits inside backdrop-filtered, overflow-hidden
          panels, which would otherwise clip the dragged card. */}
      {typeof document === "undefined"
        ? null
        : createPortal(<DragOverlay dropAnimation={DROP_ANIMATION}>{overlay}</DragOverlay>, document.body)}
    </DndContext>
  )
}
