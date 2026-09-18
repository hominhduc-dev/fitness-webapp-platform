"use client"

import Link from "next/link"
import type { ComponentProps, MouseEvent } from "react"

type WorkoutSessionLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string
}

/**
 * Next client navigation requests an RSC payload, which is deliberately not
 * cached because it can contain private data. Offline, force a document
 * navigation so the Service Worker can serve the warmed workout page shell.
 */
export function WorkoutSessionLink({ href, onClick, ...props }: WorkoutSessionLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      navigator.onLine !== false ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return

    event.preventDefault()
    window.location.assign(new URL(href, window.location.href).href)
  }

  return <Link href={href} onClick={handleClick} {...props} />
}
