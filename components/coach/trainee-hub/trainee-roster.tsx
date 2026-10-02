"use client"

import { ChevronRight, Loader2, Search, Send, UserPlus } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

import {
  deriveTraineeStatus,
  getInitials,
  TRAINEE_STATUS_DOT,
  TRAINEE_STATUSES,
  traineeStatusLabel,
  weekPercent,
  type TraineeStatus,
} from "@/components/coach/trainee-hub/trainee-status"
import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { fetchCoachTrainees } from "@/lib/fitness/api"
import type { CoachTrainee } from "@/lib/fitness/types"
import { useInviteTrainee } from "@/lib/queries/coach"
import { useCoachData } from "@/lib/queries/coach-data"
import { queryKeys } from "@/lib/queries/keys"
import { cn } from "@/lib/utils"

type Filter = "all" | TraineeStatus

function RosterRow({ active, trainee }: { active: boolean; trainee: CoachTrainee }) {
  const { messages } = useLocale()
  const copy = messages.traineeHub
  const status = deriveTraineeStatus(trainee)
  const percent = weekPercent(trainee)

  return (
    <Link
      href={`/coach/trainees/${trainee.id}`}
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl border-l-[3px] px-3 py-3 transition-colors",
        active ? "border-l-primary bg-primary-soft/60" : "border-l-transparent hover:bg-muted/50",
      )}
    >
      <Avatar className="size-11 shrink-0">
        <AvatarImage src={trainee.avatar ?? undefined} alt="" />
        <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">{getInitials(trainee.name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{trainee.name}</span>
          <span
            className={cn("size-2 shrink-0 rounded-full", TRAINEE_STATUS_DOT[status])}
            title={traineeStatusLabel(status, messages)}
          />
        </span>
        <span className="block truncate text-xs text-muted-foreground">{trainee.activeProgramName ?? copy.noProgram}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {percent === null ? copy.noSessionsThisWeek : copy.percentThisWeek(percent)}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}

/**
 * The coach's trainees, searchable and filterable by this week's status. Sits
 * beside the open trainee on large screens and is the whole page on a phone.
 */
export function TraineeRoster({ initialTrainees }: { initialTrainees?: CoachTrainee[] }) {
  const { locale, messages } = useLocale()
  const copy = messages.traineeHub
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const traineesQuery = useCoachData(queryKeys.coach.trainees(), fetchCoachTrainees, initialTrainees)
  const inviteTrainee = useInviteTrainee()
  const trainees = traineesQuery.data ?? []
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [manualInviteOpen, setManualInviteOpen] = useState(false)
  const [inviteIdentifier, setInviteIdentifier] = useState("")
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const inviteOpen = manualInviteOpen || searchParams.get("add") === "1"
  const activeId = pathname.match(/^\/coach\/trainees\/([^/]+)/)?.[1] ?? null

  const closeInvite = () => {
    setManualInviteOpen(false)
    setInviteError(null)
    if (searchParams.get("add")) router.replace(pathname)
  }

  const handleInvite = async () => {
    if (!inviteIdentifier.trim() || inviteTrainee.isPending) return
    setInviteError(null)
    setInviteSuccess(null)
    try {
      const request = await inviteTrainee.mutateAsync(inviteIdentifier.trim())
      setInviteIdentifier("")
      setInviteSuccess(locale === "en" ? `Invite sent to ${request.trainee.name}.` : `Đã gửi lời mời tới ${request.trainee.name}.`)
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : locale === "en" ? "Unable to send invite." : "Không thể gửi lời mời.")
    }
  }

  const normalizedQuery = query.trim().toLowerCase()
  const matching = trainees.filter((trainee) =>
    !normalizedQuery || [trainee.name, trainee.email, trainee.phone ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery)),
  )
  const countFor = (value: Filter) => (value === "all" ? matching.length : matching.filter((trainee) => deriveTraineeStatus(trainee) === value).length)
  const visible = filter === "all" ? matching : matching.filter((trainee) => deriveTraineeStatus(trainee) === filter)
  const filters: Array<{ label: string; value: Filter }> = [
    { label: copy.filterAll, value: "all" },
    ...TRAINEE_STATUSES.map((status) => ({ label: traineeStatusLabel(status, messages), value: status })),
  ]

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card shadow-sm lg:max-h-[calc(100dvh-8rem)]">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{copy.listTitle}</h2>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground tnum">{messages.coach.clientTotal(trainees.length)}</span>
            <Button size="icon-sm" variant="outline" onClick={() => setManualInviteOpen(true)} aria-label={messages.shell.addClient} title={messages.shell.addClient}>
              <UserPlus />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} className="rounded-xl pl-9" aria-label={copy.searchPlaceholder} />
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={copy.listTitle}>
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              onClick={() => setFilter(item.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === item.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {item.value !== "all" ? <span className={cn("size-1.5 rounded-full", TRAINEE_STATUS_DOT[item.value])} aria-hidden="true" /> : null}
              {item.label}
              <span className="font-mono tnum opacity-70">{countFor(item.value)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {traineesQuery.isPending ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {messages.common.loading}
          </div>
        ) : traineesQuery.isError ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-destructive-text">{locale === "en" ? "Unable to load clients." : "Không thể tải danh sách học viên."}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void traineesQuery.refetch()}>
              {locale === "en" ? "Try again" : "Thử lại"}
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            {trainees.length === 0 ? messages.coach.noTrainees : messages.coach.noClientsMatch}
          </p>
        ) : (
          <div className="space-y-0.5">
            {visible.map((trainee) => <RosterRow key={trainee.id} active={trainee.id === activeId} trainee={trainee} />)}
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
            {inviteError ? <p className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-text">{inviteError}</p> : null}
            {inviteSuccess ? <p className="rounded-md bg-ok-soft px-3 py-2 text-sm text-success-text">{inviteSuccess}</p> : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeInvite} disabled={inviteTrainee.isPending}>
              {messages.common.cancel}
            </Button>
            <Button className="gap-1.5" onClick={() => void handleInvite()} disabled={!inviteIdentifier.trim() || inviteTrainee.isPending}>
              {inviteTrainee.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {locale === "en" ? "Send invite" : "Gửi lời mời"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
