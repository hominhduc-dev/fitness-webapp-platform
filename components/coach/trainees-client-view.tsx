"use client"

import { useCoachData } from "@/lib/queries/coach-data"
import { useInviteTrainee } from "@/lib/queries/coach"
import { queryKeys } from "@/lib/queries/keys"
import { fetchCoachTrainees } from "@/lib/fitness/api"
import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Loader2, Search, Send, UserPlus } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { CoachTrainee } from "@/lib/fitness/types"
import type { AppMessages } from "@/lib/i18n/messages"

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
}

type Status = "on-track" | "behind" | "rest"

function deriveStatus(t: CoachTrainee): Status {
  const planned = t.plannedSessionsPerWeek ?? 0
  if (planned <= 0) return "rest"
  return t.thisWeekWorkouts / planned >= 0.8 ? "on-track" : "behind"
}

const STATUS_COLOR: Record<Status, string> = {
  "on-track": "var(--success)",
  behind: "var(--warning)",
  rest: "color-mix(in srgb, var(--muted-foreground) 40%, transparent)",
}

const KANBAN_STATUSES = ["on-track", "behind", "rest"] as const

function getStatusLabel(status: Status, messages: AppMessages) {
  if (status === "on-track") return messages.coach.statusOnTrack
  if (status === "behind") return messages.coach.statusBehind
  return messages.coach.statusRestWeek
}

/* ------------------------------------------------------------------ */
/* ClientCard                                                           */
/* ------------------------------------------------------------------ */

function ClientCard({ trainee }: { trainee: CoachTrainee & { _status: Status } }) {
  const { locale, messages } = useLocale()
  const dateLocale = locale === "vi" ? "vi-VN" : "en-US"
  const program = trainee.programCount > 0
    ? messages.coach.traineeProgramCount(trainee.programCount)
    : messages.coach.noProgram
  const planned = trainee.plannedSessionsPerWeek ?? 0
  const done = trainee.thisWeekWorkouts ?? 0
  const workload =
    planned > 0
      ? locale === "en"
        ? `${done}/${planned} sessions this week`
        : `${done}/${planned} buổi tuần này`
      : locale === "en"
        ? "No planned sessions this week"
        : "Tuần này không có lịch tập"
  const lastSeen = trainee.lastCheckInAt
    ? trainee.lastCheckInAt.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })
    : trainee.createdAt.toLocaleDateString(dateLocale, { month: "short", day: "numeric" })

  return (
    <Link
      href={`/coach/trainees/${trainee.id}`}
      className="group block rounded-lg border border-border bg-background px-2.5 py-2.5 transition-colors hover:border-ring/40 hover:bg-muted/35 sm:px-3 sm:py-3"
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0 sm:h-9 sm:w-9">
          <AvatarImage src={trainee.avatar ?? undefined} />
          <AvatarFallback className="bg-muted text-sm font-medium text-foreground">
            {getInitials(trainee.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{trainee.name}</span>
            <span
              className="h-[6px] w-[6px] flex-shrink-0 rounded-full"
              style={{ background: STATUS_COLOR[trainee._status] }}
              title={getStatusLabel(trainee._status, messages)}
            />
          </div>
          {trainee.email ? (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{trainee.email}</div>
          ) : null}
          <div className="mt-2 hidden flex-wrap gap-x-2 gap-y-1 font-mono text-micro text-muted-foreground sm:flex">
            <span>{program}</span>
            <span aria-hidden="true">·</span>
            <span>{workload}</span>
            <span aria-hidden="true">·</span>
            <span>{lastSeen}</span>
          </div>
        </div>

        <ChevronRight className="mt-1 h-[14px] w-[14px] flex-shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* TraineesClientView (main export)                                     */
/* ------------------------------------------------------------------ */

type Props = {
  initialTrainees?: CoachTrainee[]
}

export function TraineesClientView({ initialTrainees }: Props) {
  const { locale, messages } = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const traineesQuery = useCoachData(queryKeys.coach.trainees(), fetchCoachTrainees, initialTrainees)
  const inviteTrainee = useInviteTrainee()
  const trainees = traineesQuery.data ?? []
  const [q, setQ] = useState("")
  const [manualInviteOpen, setManualInviteOpen] = useState(false)
  const [inviteIdentifier, setInviteIdentifier] = useState("")
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const inviteOpen = manualInviteOpen || searchParams.get("add") === "1"

  const closeInvite = () => {
    setManualInviteOpen(false)
    setInviteError(null)
    router.replace(pathname)
  }

  const handleInvite = async () => {
    if (!inviteIdentifier.trim() || inviteTrainee.isPending) return

    setInviteError(null)
    setInviteSuccess(null)

    try {
      const request = await inviteTrainee.mutateAsync(inviteIdentifier.trim())
      setInviteIdentifier("")
      setInviteSuccess(
        locale === "en"
          ? `Invite sent to ${request.trainee.name}.`
          : `Đã gửi lời mời tới ${request.trainee.name}.`,
      )
    } catch (inviteErrorValue) {
      setInviteError(
        inviteErrorValue instanceof Error
          ? inviteErrorValue.message
          : locale === "en"
            ? "Unable to send invite."
            : "Không thể gửi lời mời.",
      )
    }
  }

  const statusedTrainees = trainees.map((t) => ({ ...t, _status: deriveStatus(t) }))
  const normalizedQuery = q.trim().toLowerCase()
  const visible = statusedTrainees.filter((t) => {
    if (!normalizedQuery) return true
    return [t.name, t.email, t.phone ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery))
  })
  const kanbanColumns = KANBAN_STATUSES.map((status) => ({
    status,
    items: visible.filter((t) => t._status === status),
    title: getStatusLabel(status, messages),
    description:
      status === "on-track"
        ? locale === "en"
          ? "Completed at least 80% of this week's plan."
          : "Hoàn thành ít nhất 80% kế hoạch tuần này."
        : status === "behind"
          ? locale === "en"
            ? "Has a weekly plan but progress is below 80%."
            : "Có lịch trong tuần nhưng tiến độ dưới 80%."
          : locale === "en"
            ? "No planned sessions assigned for this week."
            : "Tuần này chưa có buổi tập được giao.",
  }))

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-4 pt-page md:px-6 md:pb-6">
      {/* Header */}
      <div className="border-b border-border px-2 pb-3 pt-2 sm:px-6 sm:pb-4 sm:pt-5">
        <div className="mb-3 flex items-baseline justify-end">
          <div className="flex items-center gap-3">
            <span className="label-micro text-muted-foreground tnum">
              {messages.coach.clientTotal(trainees.length)}
            </span>
            <Button size="sm" className="hidden h-8 gap-1.5 rounded-lg px-3 sm:inline-flex" onClick={() => setManualInviteOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              {messages.shell.addClient}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-[11px] h-[14px] w-[14px] text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={messages.coach.searchClients}
            className="pl-9"
          />
        </div>
      </div>

      {/* Client kanban */}
      <div>
        {traineesQuery.isPending ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {messages.common.loading}
          </div>
        ) : traineesQuery.isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-destructive-text">
              {locale === "en" ? "Unable to load clients." : "Không thể tải danh sách khách hàng."}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void traineesQuery.refetch()}>
              {locale === "en" ? "Try again" : "Thử lại"}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 px-2 py-3 sm:gap-4 sm:px-6 sm:py-5">
            {kanbanColumns.map((column) => (
              <section
                key={column.status}
                className="min-h-0 rounded-xl border border-border bg-muted/20"
                aria-label={column.title}
              >
                <div className="border-b border-border px-2 py-2 sm:px-4 sm:py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ background: STATUS_COLOR[column.status] }}
                        aria-hidden="true"
                      />
                      <h2 className="truncate text-xs font-semibold text-foreground sm:text-sm">{column.title}</h2>
                    </div>
                    <span className="rounded-full bg-background px-2 py-0.5 font-mono text-micro text-muted-foreground">
                      {column.items.length}
                    </span>
                  </div>
                  <p className="mt-1.5 hidden text-xs leading-relaxed text-muted-foreground sm:block">{column.description}</p>
                </div>

                <div className="max-h-[calc(100dvh-235px)] space-y-2 overflow-y-auto p-1.5 sm:max-h-none sm:p-3">
                  {column.items.length > 0 ? (
                    column.items.map((trainee) => <ClientCard key={trainee.id} trainee={trainee} />)
                  ) : (
                    <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                      {visible.length === 0 ? messages.coach.noClientsMatch : locale === "en" ? "No clients here." : "Chưa có học viên."}
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Dialog open={inviteOpen} onOpenChange={(open) => (open ? setManualInviteOpen(true) : closeInvite())}>
        <DialogContent className="max-w-[min(92vw,440px)]">
          <DialogHeader className="text-left">
            <DialogTitle>{messages.shell.addClient}</DialogTitle>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {locale === "en"
                ? "Find a trainee by email or phone number and send a connection invite."
                : "Tìm trainee bằng email hoặc số điện thoại rồi gửi lời mời kết nối."}
            </p>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              autoFocus
              value={inviteIdentifier}
              onChange={(event) => setInviteIdentifier(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void handleInvite()
                }
              }}
              placeholder={locale === "en" ? "Email or phone number" : "Email hoặc số điện thoại"}
            />

            {inviteError ? (
              <p className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-text">{inviteError}</p>
            ) : null}
            {inviteSuccess ? (
              <p className="rounded-md bg-ok-soft px-3 py-2 text-sm text-success-text">{inviteSuccess}</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeInvite} disabled={inviteTrainee.isPending}>
              {messages.common.cancel}
            </Button>
            <Button className="gap-1.5" onClick={() => void handleInvite()} disabled={!inviteIdentifier.trim() || inviteTrainee.isPending}>
              {inviteTrainee.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {locale === "en" ? "Send invite" : "Gửi lời mời"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
