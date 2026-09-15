"use client"

import { useEffect } from "react"

import { getBrowserTimeZone, TIME_ZONE_COOKIE } from "@/lib/time-zone"

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

function readCookie(name: string) {
  const entry = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined
}

/**
 * Mirrors the browser's time zone into a cookie so server renders can ask the
 * backend for the user's "today" too. Rewrites it only when the zone changes,
 * e.g. after the user travels.
 */
export function TimeZoneCookieSync() {
  useEffect(() => {
    const timeZone = getBrowserTimeZone()

    if (!timeZone || readCookie(TIME_ZONE_COOKIE) === timeZone) return

    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
  }, [])

  return null
}
