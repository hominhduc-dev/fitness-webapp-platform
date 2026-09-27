"use client"

import { useState } from "react"

import { useCoachData } from "@/lib/queries/coach-data"
import { fetchCoachDashboard } from "@/lib/fitness/api"
import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useCancelCoachRequest, useUpdateCoachRequestStatus } from "@/lib/queries/coach"
import type { CoachRequestSummary } from "@/lib/fitness/types"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

export function PendingRequestsPanel({ initialRequests }: { initialRequests: CoachRequestSummary[] }) {
  const { locale, messages } = useLocale()
  const updateRequestStatus = useUpdateCoachRequestStatus()
  const cancelRequest = useCancelCoachRequest()
  const { data: requests = initialRequests, setData: setRequests } = useCoachData(["coach", "pending-requests"], async (token) => (await fetchCoachDashboard(token)).pendingRequests, initialRequests, true, 30_000)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRequest = async (requestId: string, status: "approved" | "rejected") => {

    setPendingId(requestId)
    setError(null)

    try {
      await updateRequestStatus.mutateAsync({ requestId, status })
      setRequests((current) => current.filter((request) => request.id !== requestId))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : locale === "en" ? "Unable to update the coach request." : "Không thể cập nhật coach request.")
    } finally {
      setPendingId(null)
    }
  }

  const handleCancel = async (requestId: string) => {
    setPendingId(requestId)
    setError(null)

    try {
      await cancelRequest.mutateAsync(requestId)
      setRequests((current) => current.filter((request) => request.id !== requestId))
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : locale === "en" ? "Unable to cancel the invitation." : "Không thể huỷ lời mời.")
    } finally {
      setPendingId(null)
    }
  }

  // A coach answers trainees' requests; their own invitations only wait or get cancelled.
  const incoming = requests.filter((request) => request.initiatedBy !== "coach")
  const sent = requests.filter((request) => request.initiatedBy === "coach")
  const copy = messages.coach.connection

  if (requests.length === 0) {
    return null
  }

  return (
    <div className="lg:col-span-3 rounded-xl border border-accent/30 bg-accent/5 p-3 sm:p-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-base font-semibold sm:text-lg">{messages.coach.pendingRequests}</h3>
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
          {messages.coach.pendingNew(incoming.length || sent.length)}
        </span>
      </div>

      {error ? <div className="mb-3 rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive-text">{error}</div> : null}

      {incoming.length > 0 && sent.length > 0 ? <p className="label-micro mb-2">{copy.requestsToYou}</p> : null}
      <div className="space-y-3">
        {incoming.map((request) => (
          <div
            key={request.id}
            className="flex flex-col gap-3 rounded-lg bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-accent/20">
                <AvatarImage src={request.trainee.avatar || "/placeholder.svg"} />
                <AvatarFallback>{getInitials(request.trainee.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold sm:text-base">{request.trainee.name}</p>
                <p className="text-xs text-muted-foreground sm:text-sm">{request.trainee.email}</p>
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none bg-transparent"
                disabled={pendingId === request.id}
                onClick={() => void handleRequest(request.id, "rejected")}
              >
                {messages.coach.reject}
              </Button>
              <Button
                size="sm"
                className="flex-1 sm:flex-none bg-primary hover:bg-primary/90"
                disabled={pendingId === request.id}
                onClick={() => void handleRequest(request.id, "approved")}
              >
                {pendingId === request.id ? messages.coach.saving : messages.coach.approve}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {sent.length > 0 ? (
        <>
          <p className="label-micro mb-2 mt-4">{copy.invitesSent}</p>
          <div className="space-y-3">
            {sent.map((request) => (
              <div key={request.id} className="flex items-center justify-between gap-3 rounded-lg bg-card p-3 sm:p-4">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <Avatar className="h-10 w-10 border-2 border-accent/20 sm:h-12 sm:w-12">
                    <AvatarImage src={request.trainee.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{getInitials(request.trainee.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold sm:text-base">{request.trainee.name}</p>
                    <p className="truncate text-xs text-muted-foreground sm:text-sm">{copy.waitingOnTrainee}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 bg-transparent"
                  disabled={pendingId === request.id}
                  onClick={() => void handleCancel(request.id)}
                >
                  {pendingId === request.id ? messages.coach.saving : copy.cancel}
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : null}

    </div>
  )
}
