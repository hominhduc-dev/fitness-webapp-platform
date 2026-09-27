"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useToast } from "@/components/providers/toast-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useCoachInvites, useRespondToCoachInvite } from "@/lib/queries/coach"

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/**
 * A coach's invitation to connect, on top of the trainee dashboard until the
 * trainee answers it. Accepting links them straight away; no admin step.
 */
export function CoachInviteCard() {
  const { messages } = useLocale()
  const copy = messages.coach.connection
  const router = useRouter()
  const { toast } = useToast()
  const invites = useCoachInvites(true)
  const respond = useRespondToCoachInvite()
  const [answering, setAnswering] = useState<string | null>(null)

  const invite = invites.data?.[0]
  if (!invite) return null

  const answer = async (status: "approved" | "rejected") => {
    setAnswering(status)
    try {
      await respond.mutateAsync({ requestId: invite.id, status })
      toast({ title: status === "approved" ? copy.accepted(invite.coach.name) : copy.declined, tone: "success" })
      // The dashboard's coach-dependent parts come from the server.
      if (status === "approved") router.refresh()
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : copy.declined, tone: "error" })
    } finally {
      setAnswering(null)
    }
  }

  return (
    <section
      aria-label={copy.inviteFrom(invite.coach.name)}
      className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4"
    >
      <div className="flex items-center gap-3">
        <Avatar className="size-11 shrink-0">
          <AvatarImage src={invite.coach.avatar || undefined} alt="" />
          <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">{initials(invite.coach.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{copy.inviteFrom(invite.coach.name)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[invite.coach.fitnessGoals.slice(0, 2).join(" · "), copy.traineeCount(invite.coach.activeTrainees)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{copy.consent}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={answering !== null} onClick={() => void answer("rejected")} className="pointer-coarse:h-11">
          {answering === "rejected" ? messages.coach.saving : copy.declineInvite}
        </Button>
        <Button type="button" disabled={answering !== null} onClick={() => void answer("approved")} className="pointer-coarse:h-11">
          {answering === "approved" ? messages.coach.saving : copy.acceptInvite}
        </Button>
      </div>
    </section>
  )
}
