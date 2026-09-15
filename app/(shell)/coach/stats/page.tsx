import { CoachStatsCards } from "@/components/coach/coach-stats-cards"
import { getServerMessages } from "@/lib/i18n/server"

// The coach role is enforced by ./layout.tsx; the counts come from the client cache.
export default async function CoachStatsPage() {
  const messages = await getServerMessages()

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6">
        <p className="label-micro text-muted-foreground">{messages.shell.coach}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{messages.shell.stats}</h1>
      </div>
      <CoachStatsCards />
    </div>
  )
}
