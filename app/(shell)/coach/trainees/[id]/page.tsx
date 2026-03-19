import Link from "next/link"
import { ArrowLeft, Calendar, Mail } from "lucide-react"

import { CoachTraineeDetailClient } from "@/components/coach/trainee-detail-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { requireAppSession } from "@/lib/auth/server"
import { fetchCoachPrograms, fetchCoachTraineeDetail } from "@/lib/fitness/api"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

export default async function TraineeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { accessToken } = await requireAppSession({ role: "coach" })
  const [detail, coachPrograms] = await Promise.all([
    fetchCoachTraineeDetail(accessToken, id),
    fetchCoachPrograms(accessToken),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/coach/trainees">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{detail.trainee.name}</h1>
          <p className="mt-1 text-muted-foreground">Coach workspace for progress, metrics, and feedback</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary/20">
              <AvatarImage src={detail.trainee.avatar || "/placeholder.svg"} />
              <AvatarFallback className="bg-primary/10 text-xl text-primary">
                {getInitials(detail.trainee.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-2xl font-semibold">{detail.trainee.name}</p>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{detail.trainee.email}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Joined {detail.trainee.createdAt.toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Goals</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.trainee.fitnessGoals.length > 0 ? (
                detail.trainee.fitnessGoals.map((goal) => (
                  <span key={goal} className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                    {goal}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">No goals added</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <CoachTraineeDetailClient coachPrograms={coachPrograms} initialDetail={detail} />
    </div>
  )
}
