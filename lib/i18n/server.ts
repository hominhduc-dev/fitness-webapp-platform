import { cookies } from "next/headers"
import { cache } from "react"

import { defaultLocale, isAppLocale, localeCookieName } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"

export const getServerLocale = cache(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(localeCookieName)?.value

  return isAppLocale(cookieLocale) ? cookieLocale : defaultLocale
})

export const getServerMessages = cache(async () => {
  return getMessages(await getServerLocale())
})
