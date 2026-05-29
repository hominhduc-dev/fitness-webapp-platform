import { TraineesClientView } from "@/components/coach/trainees-client-view"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachPrograms, fetchCoachTrainees } from "@/lib/fitness/api"

export const dynamic = "force-dynamic"

export default async function TraineesPage() {
  const { accessToken } = await requireAppSession({ role: "coach" })
  const [trainees, programs] = await Promise.all([
    fetchCoachTrainees(accessToken),
    fetchCoachPrograms(accessToken),
  ])

  return <TraineesClientView initialTrainees={trainees} programs={programs} />
}
