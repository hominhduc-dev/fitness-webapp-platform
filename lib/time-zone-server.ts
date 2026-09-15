import { cookies } from "next/headers"

import { isValidTimeZone, registerServerTimeZoneReader, TIME_ZONE_COOKIE } from "@/lib/time-zone"

/** The zone the browser last reported, for server renders. Undefined until the cookie exists. */
export async function getServerTimeZone() {
  const cookieStore = await cookies()
  const value = cookieStore.get(TIME_ZONE_COOKIE)?.value
  return isValidTimeZone(value) ? value : undefined
}

// Importing this module is what lets server-side API calls send the user's zone.
registerServerTimeZoneReader(getServerTimeZone)
