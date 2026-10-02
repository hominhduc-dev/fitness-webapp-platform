import { ArrowLeft, CalendarPlus, ChevronRight, Mail } from "lucide-react"
import Link from "next/link"

import { CoachTraineeDetailClient } from "@/components/coach/trainee-detail-client"
import { deriveTraineeStatus, getInitials, TRAINEE_STATUS_DOT, traineeStatusLabel } from "@/components/coach/trainee-hub/trainee-status"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachPrograms, fetchCoachTraineeDetail } from "@/lib/fitness/api"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

/** Whole years since a `YYYY-MM-DD` birth date. */
function ageFrom(birthDate: string | null) {
  if (!birthDate) return null
  const [year, month, day] = birthDate.split("-").map(Number)
  const today = new Date()
  const hadBirthday = today.getUTCMonth() + 1 > month || (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day)
  const age = today.getUTCFullYear() - year - (hadBirthday ? 0 : 1)
  return age > 0 && age < 120 ? age : null
}

export default async function TraineeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ accessToken }, locale, messages] = await Promise.all([
    requireAppSession({ role: "coach" }),
    getServerLocale(),
    getServerMessages(),
  ])
  const [detail, coachPrograms] = await Promise.all([
    fetchCoachTraineeDetail(accessToken, id),
    fetchCoachPrograms(accessToken),
  ])

  const copy = messages.traineeHub
  const { trainee } = detail
  const status = deriveTraineeStatus(trainee)
  const activeProgram = detail.programs.find((program) => !program.archivedAt) ?? detail.programs[0]
  const age = ageFrom(detail.about.birthDate)
  const memberSince = trainee.createdAt.toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", { month: "short", year: "numeric" })
  const facts = [age ? copy.yearsOld(age) : null, copy.memberSince(memberSince)].filter(Boolean)

  return (
    <div className="space-y-4" data-tour="coach-client-overview">
      {/* Phones show one screen at a time, so the way back to the roster is here. */}
      <Link href="/coach/trainees" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground lg:hidden">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {copy.backToList}
      </Link>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm @lg:p-5">
        <div className="flex flex-col gap-4 @3xl:flex-row @3xl:items-center @3xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="relative shrink-0">
              <Avatar className="size-16 @lg:size-20">
                <AvatarImage src={trainee.avatar ?? undefined} alt="" />
                <AvatarFallback className="bg-primary-soft text-lg font-semibold text-primary">{getInitials(trainee.name)}</AvatarFallback>
              </Avatar>
              <span
                className={cn("absolute bottom-0.5 right-0.5 size-4 rounded-full border-2 border-card", TRAINEE_STATUS_DOT[status])}
                title={traineeStatusLabel(status, messages)}
              />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground @lg:text-2xl">{trainee.name}</h1>
              <p className="truncate text-sm text-muted-foreground">{trainee.email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground @lg:text-sm">
                <span className={cn("mr-2 inline-block font-medium", status === "on-track" ? "text-success-text" : status === "behind" ? "text-warning-text" : "")}>
                  {traineeStatusLabel(status, messages)}
                </span>
                {facts.join(" · ")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 @md:flex @md:flex-wrap @3xl:shrink-0 @3xl:justify-end">
            <Button asChild variant="outline" className="rounded-xl">
              <a href={`mailto:${trainee.email}`}>
                <Mail />
                {copy.message}
              </a>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <a href="#assigned-programs">
                <CalendarPlus />
                {copy.assignProgram}
              </a>
            </Button>
            {activeProgram ? (
              <Button asChild className="col-span-2 rounded-xl @md:col-span-1">
                <Link href={`/coach/programs/${activeProgram.id}?adjustTrainee=${trainee.id}`}>
                  {copy.adjustPlan}
                  <ChevronRight />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <CoachTraineeDetailClient coachPrograms={coachPrograms} initialDetail={detail} />
    </div>
  )
}
