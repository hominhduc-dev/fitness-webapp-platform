import { notFound } from "next/navigation"

import { CoachAlertDetailView } from "@/components/coach/trainee-alert/coach-alert-detail"
import { requireAppSession } from "@/lib/auth/server"
import { ApiError } from "@/lib/auth/api"
import { fetchCoachTraineeAlertDetail, type CoachAlertKind } from "@/lib/fitness/api"
import { getServerLocale, getServerMessages } from "@/lib/i18n/server"

export const dynamic = "force-dynamic"

const KINDS: readonly CoachAlertKind[] = ["low_readiness", "missed_workouts", "plateau"]

export default async function CoachTraineeAlertPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; kind: string }>
  searchParams: Promise<{ week?: string }>
}) {
  const [{ id, kind }, { week }] = await Promise.all([params, searchParams])
  if (!KINDS.includes(kind as CoachAlertKind) || !week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) notFound()

  const [{ accessToken }, locale, messages] = await Promise.all([
    requireAppSession({ role: "coach" }),
    getServerLocale(),
    getServerMessages(),
  ])
  const detail = await fetchCoachTraineeAlertDetail(accessToken, id, kind as CoachAlertKind, week).catch((error: unknown) => {
    // The alert is gone, or the trainee is no longer this coach's.
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  })

  return <CoachAlertDetailView detail={detail} locale={locale} messages={messages} />
}
