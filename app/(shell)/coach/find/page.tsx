import { FindCoachClient } from "@/components/coach/find-coach-client"
import { requireAppSession } from "@/lib/auth/server"
import { fetchDiscoverableCoaches } from "@/lib/fitness/api"

export default async function FindCoachPage() {
  const { accessToken } = await requireAppSession({ role: "trainee" })
  const coaches = await fetchDiscoverableCoaches(accessToken)

  return <FindCoachClient initialCoaches={coaches} />
}
