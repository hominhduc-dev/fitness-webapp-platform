"use client"

import { useCallback, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { GripVertical } from "lucide-react"
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
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"

import { cn } from "@/lib/utils"

/** Mouse and pen: a few pixels of travel, so a plain click still toggles the card. */
const POINTER_ACTIVATION = { distance: 8 }

/**
 * Touch: hold before the drag takes over, so a swipe still scrolls the list.
 * The tolerance lets a finger wobble during the hold without cancelling it.
 */
const TOUCH_ACTIVATION = { delay: 250, tolerance: 6 }

const DROP_ANIMATION = { duration: 160, easing: "cubic-bezier(.2,.7,.2,1)" }

/**
 * The list with the item at `from` moved to `to`, the others keeping their
 * order. Out-of-range or equal indexes return the list unchanged.
 */
export function moveListItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items as T[]
  }

  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

type SortableItemProps = {
  children: (dragHandle: ReactNode) => ReactNode
  disabled: boolean
  dropEdge: "before" | "after" | null
  handleLabel: string
  id: string
  isDragging: boolean
}

function SortableItem({ children, disabled, dropEdge, handleLabel, id, isDragging }: SortableItemProps) {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ disabled, id })
  const { setNodeRef: setDropRef } = useDroppable({ disabled, id })

  const dragHandle = disabled ? null : (
    <span
      {...attributes}
      {...listeners}
      aria-label={handleLabel}
      title={handleLabel}
      // touch-none keeps the browser from claiming the held gesture as a scroll.
      className="flex h-8 w-6 pointer-coarse:h-10 pointer-coarse:w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical aria-hidden className="h-4 w-4" />
    </span>
  )

  return (
    <div ref={setDropRef} className="relative">
      {dropEdge ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-primary",
            dropEdge === "before" ? "-top-[7px]" : "-bottom-[7px]",
          )}
        />
      ) : null}
      <div ref={setDragRef} className={cn("transition-opacity", isDragging && "opacity-40")}>
        {children(dragHandle)}
      </div>
    </div>
  )
}

/**
 * A vertical list whose items are reordered by dragging a grip handle, which
 * each item renders where it fits. Dropping on another item moves the dragged
 * one into that item's place; a line shows the side it will land on.
 */
export function SortableExerciseList<T extends { id: string }>({
  className,
  disabled = false,
  handleLabel,
  items,
  onReorder,
  renderItem,
  renderOverlay,
}: {
  className?: string
  disabled?: boolean
  handleLabel: string
  items: T[]
  onReorder: (from: number, to: number) => void
  renderItem: (item: T, index: number, dragHandle: ReactNode) => ReactNode
  /** What follows the pointer while an item is dragged. */
  renderOverlay: (item: T, index: number) => ReactNode
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: POINTER_ACTIVATION }),
    useSensor(TouchSensor, { activationConstraint: TOUCH_ACTIVATION }),
  )

  const reset = useCallback(() => {
    setActiveId(null)
    setOverId(null)
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => setActiveId(String(event.active.id)), [])
  const handleDragOver = useCallback((event: DragOverEvent) => setOverId(event.over ? String(event.over.id) : null), [])
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      reset()
      if (!event.over) return
      const from = items.findIndex((item) => item.id === event.active.id)
      const to = items.findIndex((item) => item.id === event.over?.id)
      if (from < 0 || to < 0 || from === to) return
      onReorder(from, to)
    },
    [items, onReorder, reset],
  )

  const activeIndex = activeId == null ? -1 : items.findIndex((item) => item.id === activeId)
  const overIndex = overId == null ? -1 : items.findIndex((item) => item.id === overId)

  return (
    <DndContext
      accessibility={{ announcements: undefined, screenReaderInstructions: { draggable: handleLabel } }}
      collisionDetection={closestCenter}
      onDragCancel={reset}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div className={className}>
        {items.map((item, index) => (
          <SortableItem
            key={item.id}
            disabled={disabled || items.length < 2}
            dropEdge={
              activeIndex < 0 || overIndex !== index || overIndex === activeIndex
                ? null
                : activeIndex < overIndex
                  ? "after"
                  : "before"
            }
            handleLabel={handleLabel}
            id={item.id}
            isDragging={item.id === activeId}
          >
            {(dragHandle) => renderItem(item, index, dragHandle)}
          </SortableItem>
        ))}
      </div>

      {/* Portalled: the list sits inside a scrolling, overflow-hidden dialog
          that would otherwise clip the dragged card. */}
      {typeof document === "undefined"
        ? null
        : createPortal(
            <DragOverlay dropAnimation={DROP_ANIMATION} zIndex={200}>
              {activeIndex >= 0 ? renderOverlay(items[activeIndex], activeIndex) : null}
            </DragOverlay>,
            document.body,
          )}
    </DndContext>
  )
}
