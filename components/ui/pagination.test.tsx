import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { usePaginatedList } from "./pagination"

const rows = (count: number) => Array.from({ length: count }, (_, index) => index + 1)

describe("usePaginatedList", () => {
  it("slices the first page and reports an inclusive 1-based range", () => {
    const { result } = renderHook(() => usePaginatedList(rows(214), 25))

    expect(result.current.page).toBe(1)
    expect(result.current.pageCount).toBe(9)
    expect(result.current.pageItems).toHaveLength(25)
    expect(result.current.pageItems[0]).toBe(1)
    expect(result.current.from).toBe(1)
    expect(result.current.to).toBe(25)
    expect(result.current.total).toBe(214)
  })

  it("gives the final page only the remainder", () => {
    const { result } = renderHook(() => usePaginatedList(rows(214), 25))

    act(() => result.current.setPage(9))

    expect(result.current.pageItems).toHaveLength(214 - 8 * 25)
    expect(result.current.from).toBe(201)
    expect(result.current.to).toBe(214)
  })

  /**
   * The regression this guards: filtering while on a late page used to leave
   * the list showing an out-of-range slice — an empty pane with rows that do
   * exist, just not there.
   */
  it("clamps a page that the list has shrunk past", () => {
    const { rerender, result } = renderHook(({ items }) => usePaginatedList(items, 25), {
      initialProps: { items: rows(214) },
    })

    act(() => result.current.setPage(9))
    expect(result.current.page).toBe(9)

    rerender({ items: rows(10) })

    expect(result.current.page).toBe(1)
    expect(result.current.pageCount).toBe(1)
    expect(result.current.pageItems).toHaveLength(10)
  })

  it("stays on page 1 with a single empty page when the list is empty", () => {
    const { result } = renderHook(() => usePaginatedList(rows(0), 25))

    expect(result.current.page).toBe(1)
    expect(result.current.pageCount).toBe(1)
    expect(result.current.pageItems).toEqual([])
    // Both zero, so the status line reads "0–0 of 0" rather than "1–0".
    expect(result.current.from).toBe(0)
    expect(result.current.to).toBe(0)
  })

  it("refuses page numbers outside the range in either direction", () => {
    const { result } = renderHook(() => usePaginatedList(rows(60), 25))

    act(() => result.current.setPage(0))
    expect(result.current.page).toBe(1)

    act(() => result.current.setPage(99))
    expect(result.current.page).toBe(3)
  })

  it("keeps an exact multiple of the page size off a trailing empty page", () => {
    const { result } = renderHook(() => usePaginatedList(rows(50), 25))

    expect(result.current.pageCount).toBe(2)
  })
})
