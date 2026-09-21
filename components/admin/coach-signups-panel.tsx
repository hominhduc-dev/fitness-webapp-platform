"use client"

import { useState } from "react"
import { Check, Loader2, Search, ShieldCheck, X } from "lucide-react"

import { useToast } from "@/components/providers/toast-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FilterChip } from "@/components/ui/filter-chip"
import { Input } from "@/components/ui/input"
import type { AdminUserListItem } from "@/lib/admin/types"
import type { CoachApprovalStatus } from "@/lib/auth/types"
import { useAdminCoachSignups, useReviewAdminCoachSignupRequest } from "@/lib/queries/admin"

type StatusFilter = CoachApprovalStatus | "all"

const STATUS_FILTERS: StatusFilter[] = ["pending", "approved", "rejected", "all"]

function statusBadgeVariant(status?: CoachApprovalStatus | null) {
  if (status === "approved") {
    return "default" as const
  }

  return status === "rejected" ? ("destructive" as const) : ("secondary" as const)
}

/**
 * The queue behind /coach-signup. A coach who signs up is created locked, so
 * approving here is what lets them sign in for the first time.
 */
export function CoachSignupsPanel({ locale }: { locale: "en" | "vi" }) {
  const { toast } = useToast()
  const [status, setStatus] = useState<StatusFilter>("pending")
  const [search, setSearch] = useState("")
  const signupsQuery = useAdminCoachSignups({ status })
  const reviewSignup = useReviewAdminCoachSignupRequest()
  const [decidingUserId, setDecidingUserId] = useState<string | null>(null)
  const signups = signupsQuery.data ?? []
  const normalizedSearch = search.trim().toLowerCase()
  const visibleSignups = normalizedSearch
    ? signups.filter((signup) =>
        [signup.name, signup.email, signup.phone, signup.username]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
      )
    : signups

  const statusLabel = (value: StatusFilter) => {
    if (locale === "en") {
      return value
    }

    return value === "pending"
      ? "chờ duyệt"
      : value === "approved"
        ? "đã duyệt"
        : value === "rejected"
          ? "từ chối"
          : "tất cả"
  }

  const handleDecision = async (signup: AdminUserListItem, decision: "approved" | "rejected") => {
    setDecidingUserId(signup.id)

    try {
      await reviewSignup.mutateAsync([signup.id, decision])
      toast({
        title:
          decision === "approved"
            ? locale === "en"
              ? `${signup.name} can now sign in as a coach.`
              : `${signup.name} đã có thể đăng nhập với vai trò coach.`
            : locale === "en"
              ? `${signup.name}'s coach application was rejected.`
              : `Đã từ chối hồ sơ coach của ${signup.name}.`,
        tone: "success",
      })
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : locale === "en"
              ? "Unable to record the decision."
              : "Không thể ghi nhận quyết định.",
        tone: "error",
      })
    } finally {
      setDecidingUserId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 basis-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={locale === "en" ? "Search coach signups…" : "Tìm hồ sơ coach…"}
            value={search}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((value) => (
            <FilterChip
              key={value}
              active={status === value}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {statusLabel(value)}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {signupsQuery.isPending ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {locale === "en" ? "Loading coach signups…" : "Đang tải hồ sơ coach…"}
          </div>
        ) : visibleSignups.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <ShieldCheck aria-hidden="true" className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {status === "pending"
                ? locale === "en"
                  ? "No coach signups waiting for review."
                  : "Không có hồ sơ coach nào chờ duyệt."
                : locale === "en"
                  ? "No coach signups match."
                  : "Không có hồ sơ coach nào khớp."}
            </p>
          </div>
        ) : (
          visibleSignups.map((signup) => {
            const isDeciding = decidingUserId === signup.id

            return (
              <div
                key={signup.id}
                className="flex flex-wrap items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="font-mono text-xs font-semibold uppercase text-muted-foreground">
                    {signup.name
                      .split(" ")
                      .filter(Boolean)
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1 basis-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{signup.name}</span>
                    <Badge variant={statusBadgeVariant(signup.coachApprovalStatus)} className="shrink-0 text-micro">
                      {statusLabel((signup.coachApprovalStatus ?? "pending") as StatusFilter)}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {signup.email}
                    {signup.phone ? ` · ${signup.phone}` : ""}
                  </p>
                </div>

                <p className="font-mono text-xs text-muted-foreground tnum">
                  {signup.createdAt.toLocaleDateString(locale === "en" ? "en-US" : "vi-VN")}
                </p>

                {signup.coachApprovalStatus === "pending" ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      disabled={isDeciding}
                      onClick={() => void handleDecision(signup, "approved")}
                      size="sm"
                    >
                      {isDeciding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {locale === "en" ? "Approve" : "Duyệt"}
                    </Button>
                    <Button
                      disabled={isDeciding}
                      onClick={() => void handleDecision(signup, "rejected")}
                      size="sm"
                      variant="outline"
                    >
                      <X className="h-4 w-4" />
                      {locale === "en" ? "Reject" : "Từ chối"}
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
