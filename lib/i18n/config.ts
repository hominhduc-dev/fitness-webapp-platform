export const localeCookieName = "yeahbuddy-locale"

export const locales = ["en", "vi"] as const

export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = "en"

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "en" || value === "vi"
}
