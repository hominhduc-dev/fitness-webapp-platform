import { CoachStatsCards } from "@/components/coach/coach-stats-cards"

// The coach role is enforced by ./layout.tsx; the counts come from the client cache.
export default function CoachStatsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-6 pt-page md:px-6">
      <CoachStatsCards />
    </div>
  )
}
