"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/providers/auth-provider"
import {
  fetchNotificationPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "@/lib/fitness/api"
import type {
  NotificationList,
  NotificationMealType,
  NotificationPreferences,
  NotificationPreferencesInput,
} from "@/lib/fitness/types"
import { queryKeys } from "./keys"
import { userQueryKey, useUserQuery } from "./scoped"
import { requireAccessToken } from "./token"

/** Only this user edits them, from one screen that writes the result back. */
const PREFERENCES_STALE_TIME_MS = 5 * 60_000
/** Scheduled reminders land on a one-minute tick, so the bell polls at the same pace. */
const NOTIFICATIONS_POLL_MS = 60_000
const BELL_LIMIT = 20

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

/** Applies a partial save to cached preferences, for an optimistic update. */
export function applyNotificationPreferencesInput(
  previous: NotificationPreferences,
  input: NotificationPreferencesInput,
): NotificationPreferences {
  const mealReminders = { ...previous.mealReminders }
  for (const meal of Object.keys(input.mealReminders ?? {}) as NotificationMealType[]) {
    mealReminders[meal] = { ...mealReminders[meal], ...input.mealReminders?.[meal] }
  }

  return {
    ...previous,
    coachProgramUpdates: input.coachProgramUpdates ?? previous.coachProgramUpdates,
    coachWeeklyReview: { ...previous.coachWeeklyReview, ...input.coachWeeklyReview },
    dailyCheckIn: { ...previous.dailyCheckIn, ...input.dailyCheckIn },
    mealReminders,
    weightReminder: { ...previous.weightReminder, ...input.weightReminder },
    workoutReminder: { ...previous.workoutReminder, ...input.workoutReminder },
    workoutSessionReminders: input.workoutSessionReminders ?? previous.workoutSessionReminders,
  }
}

export function useNotificationPreferences() {
  return useUserQuery<NotificationPreferences>({
    queryFn: async () => fetchNotificationPreferences(await requireAccessToken()),
    queryKey: queryKeys.notifications.preferences(),
    staleTime: PREFERENCES_STALE_TIME_MS,
  })
}

/**
 * Saves a partial change. The device's current zone rides along on every save,
 * so reminders follow the user after they travel and change a setting.
 */
export function useUpdateNotificationPreferences() {
  const client = useQueryClient()
  const { profile } = useAuth()
  const key = userQueryKey(queryKeys.notifications.preferences(), profile?.id)

  return useMutation({
    mutationFn: async (input: NotificationPreferencesInput) =>
      updateNotificationPreferences(await requireAccessToken(), { timeZone: browserTimeZone(), ...input }),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<NotificationPreferences>(key)

      if (previous) {
        client.setQueryData<NotificationPreferences>(key, applyNotificationPreferencesInput(previous, input))
      }

      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(key, context.previous)
    },
    onSuccess: (preferences) => {
      client.setQueryData(key, preferences)
    },
  })
}

export function useNotifications() {
  return useUserQuery<NotificationList>({
    queryFn: async () => fetchNotifications(await requireAccessToken(), BELL_LIMIT),
    queryKey: queryKeys.notifications.list(BELL_LIMIT),
    refetchInterval: NOTIFICATIONS_POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  })
}

function useNotificationListCache() {
  const client = useQueryClient()
  const { profile } = useAuth()
  const key = userQueryKey(queryKeys.notifications.list(BELL_LIMIT), profile?.id)

  return {
    client,
    key,
    /** Marks rows read in the cached list; returns the previous list for rollback. */
    markRead: async (isTarget: ((id: string) => boolean) | "all") => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<NotificationList>(key)

      if (previous) {
        const readAt = new Date()
        let newlyRead = 0
        const notifications = previous.notifications.map((notification) => {
          if (notification.readAt || (isTarget !== "all" && !isTarget(notification.id))) return notification
          newlyRead += 1
          return { ...notification, readAt }
        })

        client.setQueryData<NotificationList>(key, {
          notifications,
          // "All" also covers unread rows older than the cached page.
          unreadCount: isTarget === "all" ? 0 : Math.max(0, previous.unreadCount - newlyRead),
        })
      }

      return previous
    },
  }
}

export function useMarkNotificationRead() {
  const cache = useNotificationListCache()

  return useMutation({
    mutationFn: async (notificationId: string) => markNotificationRead(await requireAccessToken(), notificationId),
    onMutate: async (notificationId) => ({ previous: await cache.markRead((id) => id === notificationId) }),
    onError: (_error, _id, context) => {
      if (context?.previous) cache.client.setQueryData(cache.key, context.previous)
    },
    onSettled: () => cache.client.invalidateQueries({ queryKey: cache.key }),
  })
}

export function useMarkAllNotificationsRead() {
  const cache = useNotificationListCache()

  return useMutation({
    mutationFn: async () => markAllNotificationsRead(await requireAccessToken()),
    onMutate: async () => ({ previous: await cache.markRead("all") }),
    onError: (_error, _input, context) => {
      if (context?.previous) cache.client.setQueryData(cache.key, context.previous)
    },
    onSettled: () => cache.client.invalidateQueries({ queryKey: cache.key }),
  })
}
