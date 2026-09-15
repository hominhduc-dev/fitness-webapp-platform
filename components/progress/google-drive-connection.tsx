"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { GoogleIcon } from "@/components/ui/brand-icons"
import { Button } from "@/components/ui/button"
import { authorizeGoogle, disconnectGoogle, fetchGoogleConnection, type GoogleConnectionStatus } from "@/lib/fitness/api"
import { queryKeys } from "@/lib/queries/keys"
import { userQueryKey, useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"

export function useGoogleDriveConnection() {
  return useUserQuery<GoogleConnectionStatus>({
    queryFn: async () => fetchGoogleConnection(await requireAccessToken()),
    queryKey: queryKeys.google.connection(),
    staleTime: 30_000,
  })
}

/**
 * The Google account a trainee's Sheets export writes into. Connecting leaves
 * the page for Google's consent screen and comes back to /progress.
 */
export function GoogleDriveConnection({ connection }: { connection: GoogleConnectionStatus }) {
  const { messages } = useLocale()
  const text = messages.workoutPage
  const { profile } = useAuth()
  const client = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const onError = (mutationError: Error) => setError(mutationError.message)

  const authorize = useMutation({
    mutationFn: async () => authorizeGoogle(await requireAccessToken()),
    onError,
    onSuccess: ({ url }) => window.location.assign(url),
  })
  const disconnect = useMutation({
    mutationFn: async () => disconnectGoogle(await requireAccessToken()),
    onError,
    onSuccess: () =>
      client.setQueryData<GoogleConnectionStatus>(userQueryKey(queryKeys.google.connection(), profile?.id), {
        ...connection,
        connected: false,
        email: null,
      }),
  })
  const pending = authorize.isPending || disconnect.isPending

  if (!connection.configured) return null

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2.5 text-sm">
        <GoogleIcon aria-hidden="true" className="size-4 shrink-0" />
        {connection.connected ? (
          <>
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{connection.email ?? "Google"}</span>
            <Button
              className="shrink-0 text-muted-foreground"
              disabled={pending}
              onClick={() => { setError(null); disconnect.mutate() }}
              size="sm"
              variant="ghost"
            >
              {text.googleDriveDisconnect}
            </Button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">{text.googleDriveConnectHelp}</p>
            <Button className="shrink-0" disabled={pending} onClick={() => { setError(null); authorize.mutate() }} size="sm">
              {text.googleDriveConnect}
            </Button>
          </>
        )}
      </div>
      {connection.connected ? <p className="text-xs text-muted-foreground">{text.googleDriveConnected}</p> : null}
      {error ? <p className="text-xs text-destructive-text" role="alert">{error}</p> : null}
    </div>
  )
}
