"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { HeartPulse, RefreshCw } from "lucide-react"
import { useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { SettingsSection } from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import {
  authorizeHuawei,
  disconnectHuawei,
  fetchHuaweiConnection,
  syncHuaweiHealth,
  type HuaweiConnectionStatus,
} from "@/lib/fitness/api"
import { queryKeys } from "@/lib/queries/keys"
import { useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"

function browserTimezoneOffset() {
  const totalMinutes = -new Date().getTimezoneOffset()
  const sign = totalMinutes >= 0 ? "+" : "-"
  const absolute = Math.abs(totalMinutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0")
  const minutes = String(absolute % 60).padStart(2, "0")
  return `${sign}${hours}${minutes}`
}

export function HuaweiHealthConnection() {
  const { profile } = useAuth()
  const { locale } = useLocale()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const isTrainee = profile?.role === "trainee"

  const copy =
    locale === "vi"
      ? {
          connect: "Kết nối",
          connected: "Đã kết nối",
          description: "Đồng bộ giấc ngủ, nhịp tim, stress, hoạt động và workout từ Huawei Health.",
          disconnect: "Ngắt kết nối",
          lastSync: "Đồng bộ gần nhất",
          neverSynced: "Chưa đồng bộ dữ liệu",
          notConnected: "Kết nối Huawei Health để dùng dữ liệu wearable cho Recovery và Progress.",
          sync: "Đồng bộ",
          syncing: "Đang đồng bộ…",
          title: "Ứng dụng sức khỏe",
        }
      : {
          connect: "Connect",
          connected: "Connected",
          description: "Sync sleep, heart rate, stress, activity and workouts from Huawei Health.",
          disconnect: "Disconnect",
          lastSync: "Last synced",
          neverSynced: "No health data synced yet",
          notConnected: "Connect Huawei Health to use wearable data in Recovery and Progress.",
          sync: "Sync",
          syncing: "Syncing…",
          title: "Health apps",
        }

  const connectionQuery = useUserQuery<HuaweiConnectionStatus>({
    enabled: isTrainee,
    queryFn: async () => fetchHuaweiConnection(await requireAccessToken()),
    queryKey: queryKeys.healthIntegrations.huaweiConnection(),
    staleTime: 30_000,
  })

  const authorize = useMutation({
    mutationFn: async () => authorizeHuawei(await requireAccessToken()),
    onError: (mutationError: Error) => setError(mutationError.message),
    onSuccess: ({ url }) => window.location.assign(url),
  })

  const sync = useMutation({
    mutationFn: async () =>
      syncHuaweiHealth(await requireAccessToken(), {
        days: 7,
        timezoneOffset: browserTimezoneOffset(),
      }),
    onError: (mutationError: Error) => setError(mutationError.message),
    onSuccess: async () => {
      setError(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.healthIntegrations.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.progress.all }),
      ])
    },
  })

  const disconnect = useMutation({
    mutationFn: async () => disconnectHuawei(await requireAccessToken()),
    onError: (mutationError: Error) => setError(mutationError.message),
    onSuccess: async () => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.healthIntegrations.all })
    },
  })

  if (!isTrainee || connectionQuery.isLoading || !connectionQuery.data?.configured) return null

  const connection = connectionQuery.data
  const pending = authorize.isPending || sync.isPending || disconnect.isPending
  const lastSyncedAt = connection.lastSyncedAt
    ? new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(connection.lastSyncedAt))
    : null

  return (
    <SettingsSection
      collapsible
      description={copy.description}
      icon={HeartPulse}
      id="settings-health-apps"
      title={copy.title}
    >
      <div className="rounded-xl border border-border/70 bg-surface-subtle/35 p-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">Huawei Health</p>
              {connection.connected ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {copy.connected}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {connection.connected
                ? lastSyncedAt
                  ? `${copy.lastSync}: ${lastSyncedAt}`
                  : copy.neverSynced
                : copy.notConnected}
            </p>
          </div>

          {!connection.connected ? (
            <Button
              disabled={pending}
              onClick={() => {
                setError(null)
                authorize.mutate()
              }}
              size="sm"
            >
              {copy.connect}
            </Button>
          ) : null}
        </div>

        {connection.connected ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={() => {
                setError(null)
                sync.mutate()
              }}
              size="sm"
            >
              <RefreshCw aria-hidden="true" className={sync.isPending ? "animate-spin" : ""} />
              {sync.isPending ? copy.syncing : copy.sync}
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setError(null)
                disconnect.mutate()
              }}
              size="sm"
              variant="outline"
            >
              {copy.disconnect}
            </Button>
          </div>
        ) : null}

        {error ? (
          <p className="mt-2 text-xs text-destructive-text" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </SettingsSection>
  )
}
