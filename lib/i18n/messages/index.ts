import type { AppLocale } from "@/lib/i18n/config"
import { adminMessages } from "@/lib/i18n/messages/admin"
import { authMessages } from "@/lib/i18n/messages/auth"
import { coachMessages } from "@/lib/i18n/messages/coach"
import { commonMessages } from "@/lib/i18n/messages/common"
import { dashboardMessages } from "@/lib/i18n/messages/dashboard"
import { landingMessages } from "@/lib/i18n/messages/landing"
import { mealsMessages } from "@/lib/i18n/messages/meals"
import { notificationsMessages } from "@/lib/i18n/messages/notifications"
import { profileMessages } from "@/lib/i18n/messages/profile"
import { progressMessages } from "@/lib/i18n/messages/progress"
import { scheduleMessages } from "@/lib/i18n/messages/schedule"
import { workoutMessages } from "@/lib/i18n/messages/workout"
import { volumeRecoveryMessages } from "@/lib/i18n/messages/volume-recovery"

type WidenLiteral<T> =
  T extends string ? string
    : T extends number ? number
      : T extends boolean ? boolean
        : T extends (...args: infer A) => infer R ? (...args: A) => R
          : T extends object ? { [K in keyof T]: WidenLiteral<T[K]> }
            : T

const enMessages = {
  ...commonMessages.en,
  ...landingMessages.en,
  ...authMessages.en,
  ...dashboardMessages.en,
  ...scheduleMessages.en,
  ...workoutMessages.en,
  ...volumeRecoveryMessages.en,
  ...progressMessages.en,
  ...mealsMessages.en,
  ...profileMessages.en,
  ...coachMessages.en,
  ...adminMessages.en,
  ...notificationsMessages.en,
}

export type AppMessages = WidenLiteral<typeof enMessages>

const viMessages: AppMessages = {
  ...commonMessages.vi,
  ...landingMessages.vi,
  ...authMessages.vi,
  ...dashboardMessages.vi,
  ...scheduleMessages.vi,
  ...workoutMessages.vi,
  ...volumeRecoveryMessages.vi,
  ...progressMessages.vi,
  ...mealsMessages.vi,
  ...profileMessages.vi,
  ...coachMessages.vi,
  ...adminMessages.vi,
  ...notificationsMessages.vi,
}

export const messages = {
  en: enMessages,
  vi: viMessages,
}

export function getMessages(locale: AppLocale) {
  return messages[locale]
}
