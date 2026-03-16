import { cookies } from "next/headers"

import { defaultLocale, isAppLocale, localeCookieName } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"

export async function getServerLocale() {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(localeCookieName)?.value

  return isAppLocale(cookieLocale) ? cookieLocale : defaultLocale
}

export async function getServerMessages() {
  return getMessages(await getServerLocale())
}
