"use client"

import { useEffect } from "react"

/**
 * Freezes the page behind an overlay while `active` is true.
 *
 * The count is shared by every caller on purpose: an overlay that opens another
 * one (the program editor opening a routine sheet) must not have the inner one
 * restore scrolling on close while the outer is still up.
 */
let lockCount = 0
let restoreOverflow = ""

export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) {
      return
    }

    lockCount += 1

    if (lockCount === 1) {
      restoreOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
    }

    return () => {
      lockCount -= 1

      if (lockCount === 0) {
        document.body.style.overflow = restoreOverflow
      }
    }
  }, [active])
}
