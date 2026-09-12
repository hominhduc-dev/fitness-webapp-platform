import { requireAppSession } from "@/lib/auth/server"

export default async function CoachStatsPage() {
  await requireAppSession({ role: "coach" })

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="rounded-[10px] border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Coach Statistics</h1>
        <p className="mt-2 text-muted-foreground">This page is under construction.</p>
      </div>
    </div>
  )
}
