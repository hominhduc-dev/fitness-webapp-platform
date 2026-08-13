import { cookies, headers } from "next/headers"
import { cache } from "react"

import { defaultLocale, isAppLocale, localeCookieName } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"

export const getServerLocale = cache(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(localeCookieName)?.value

  if (isAppLocale(cookieLocale)) {
    return cookieLocale
  }

  const acceptLanguage = (await headers()).get("accept-language")?.toLowerCase()

  if (acceptLanguage) {
    const preferredLocale = acceptLanguage
      .split(",")
      .map((entry) => entry.trim().split(";")[0]?.split("-")[0])
      .find(isAppLocale)

    if (preferredLocale) {
      return preferredLocale
    }
  }

  return defaultLocale
})

export const getServerMessages = cache(async () => {
  return getMessages(await getServerLocale())
})
