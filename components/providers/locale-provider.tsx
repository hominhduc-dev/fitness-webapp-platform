"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { defaultLocale, localeCookieName, type AppLocale } from "@/lib/i18n/config"
import { getMessages, type AppMessages } from "@/lib/i18n/messages"

type LocaleContextValue = {
  locale: AppLocale
  messages: AppMessages
  setLocale: (nextLocale: AppLocale) => void
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

export function LocaleProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: React.ReactNode
  initialLocale?: AppLocale
}) {
  const router = useRouter()
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      messages: getMessages(locale),
      setLocale: (nextLocale) => {
        setLocaleState(nextLocale)
        document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`
        router.refresh()
      },
    }),
    [locale, router],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)

  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider")
  }

  return context
}
