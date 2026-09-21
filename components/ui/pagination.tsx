"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Slices a client-side list into pages.
 *
 * The page is clamped on read rather than corrected in an effect, so filtering
 * a list down to fewer pages shows the last page immediately instead of
 * rendering an empty one for a frame and then re-rendering.
 */
export function usePaginatedList<T>(items: readonly T[], pageSize: number) {
  const [requestedPage, setPage] = useState(1)

  return useMemo(() => {
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
    const page = Math.min(Math.max(1, requestedPage), pageCount)
    const start = (page - 1) * pageSize

    return {
      page,
      pageCount,
      pageItems: items.slice(start, start + pageSize),
      setPage,
      total: items.length,
      // 1-based, inclusive; both 0 when the list is empty.
      from: items.length === 0 ? 0 : start + 1,
      to: Math.min(start + pageSize, items.length),
    }
  }, [items, pageSize, requestedPage])
}

/**
 * Previous/next pager with a live status line.
 *
 * Deliberately not a numbered page list: admin lists are scanned and filtered
 * rather than navigated by index, and a row of numbers costs height in a
 * workspace whose whole point is that it does not scroll.
 */
export function Pagination({
  className,
  labels,
  onPageChange,
  page,
  pageCount,
}: {
  className?: string
  labels: { next: string; previous: string; status: string }
  onPageChange: (page: number) => void
  page: number
  pageCount: number
}) {
  const atStart = page <= 1
  const atEnd = page >= pageCount

  return (
    <nav aria-label={labels.status} className={cn("flex items-center justify-between gap-3", className)}>
      {/* Page changes are a live region: without it the only feedback is rows
          swapping, which a screen reader never announces. */}
      <p aria-live="polite" className="min-w-0 truncate font-mono text-micro text-muted-foreground tnum">
        {labels.status}
      </p>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          aria-label={labels.previous}
          disabled={atStart}
          onClick={() => onPageChange(page - 1)}
          size="icon-sm"
          variant="outline"
        >
          <ChevronLeft />
        </Button>
        <Button
          aria-label={labels.next}
          disabled={atEnd}
          onClick={() => onPageChange(page + 1)}
          size="icon-sm"
          variant="outline"
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}
