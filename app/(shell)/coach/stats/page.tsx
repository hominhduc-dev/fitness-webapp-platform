import { requireAppSession } from "@/lib/auth/server"
import { getServerMessages } from "@/lib/i18n/server"
import { fetchCoachNavCounts } from "@/lib/fitness/api"
import { MetricCard } from "@/components/ui/metric-card"

export default async function CoachStatsPage() {
  const [{ accessToken }, messages] = await Promise.all([
    requireAppSession({ role: "coach" }),
    getServerMessages(),
  ])
  const counts = await fetchCoachNavCounts(accessToken)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6">
        <p className="label-micro text-muted-foreground">{messages.shell.coach}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{messages.shell.stats}</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard title={messages.shell.clients} value={counts.trainees} tone="primary" />
        <MetricCard title={messages.shell.programs} value={counts.programs} tone="success" />
      </div>
    </div>
  )
}
