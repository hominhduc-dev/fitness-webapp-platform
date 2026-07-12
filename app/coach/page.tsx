import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { StatsCard } from "@/components/dashboard/stats-card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, UserPlus, TrendingUp, Calendar, Check, X, ChevronRight } from "lucide-react"
import { trainees, pendingCoachRequests, coachUser } from "@/lib/mock-data"
import Link from "next/link"

export default function CoachDashboardPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="coach" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:px-6">
            {/* Welcome section */}
            <div className="mb-4 sm:mb-6">
              <h1 className="text-xl font-bold sm:text-2xl md:text-3xl">
                Welcome, <span className="text-primary">{coachUser.name}</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Manage your trainees and track their progress
              </p>
            </div>

            {/* Stats Grid */}
            <div className="mb-4 sm:mb-6 grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
              <StatsCard title="Active Trainees" value={trainees.length} icon={Users} variant="primary" />
              <StatsCard
                title="Pending Requests"
                value={pendingCoachRequests.length}
                icon={UserPlus}
                variant="accent"
              />
              <StatsCard title="Workouts This Week" value="24" subtitle="across all trainees" icon={Calendar} />
              <StatsCard title="Avg. Compliance" value="87%" icon={TrendingUp} trend={{ value: 5, positive: true }} />
            </div>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
              {/* Pending Requests */}
              {pendingCoachRequests.length > 0 && (
                <div className="lg:col-span-3 rounded-xl border border-accent/30 bg-accent/5 p-3 sm:p-6">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h3 className="text-base font-semibold sm:text-lg">Pending Requests</h3>
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                      {pendingCoachRequests.length} new
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pendingCoachRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-col gap-3 rounded-lg bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-accent/20">
                            <AvatarImage src="/fitness-person.png" />
                            <AvatarFallback>TR</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold sm:text-base">New Trainee Request</p>
                            <p className="text-xs text-muted-foreground sm:text-sm">Wants to connect with you</p>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 sm:flex-none gap-1 bg-transparent text-xs sm:text-sm"
                          >
                            <X className="h-3 w-3 sm:h-4 sm:w-4" />
                            Decline
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 sm:flex-none gap-1 bg-primary hover:bg-primary/90 text-xs sm:text-sm"
                          >
                            <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                            Accept
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trainee List */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card p-3 sm:p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-base font-semibold sm:text-lg">Your Trainees</h3>
                  <Link href="/coach/trainees">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs sm:text-sm">
                      View All
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {trainees.map((trainee) => (
                    <Link
                      key={trainee.id}
                      href={`/coach/trainees/${trainee.id}`}
                      className="flex items-center justify-between rounded-lg bg-muted/30 p-3 sm:p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 border-2 border-primary/20">
                          <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                            {trainee.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate sm:text-base">{trainee.name}</p>
                          <p className="text-xs text-muted-foreground truncate hidden xs:block sm:text-sm">
                            {trainee.fitnessGoals?.join(", ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-medium text-success">Active</p>
                          <p className="text-xs text-muted-foreground">Last workout: 2h ago</p>
                        </div>
                        <div className="h-2 w-2 rounded-full bg-success sm:hidden" title="Active" />
                        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-4 sm:space-y-6">
                <div className="rounded-xl border border-border bg-card p-3 sm:p-6">
                  <h3 className="mb-3 sm:mb-4 text-base font-semibold sm:text-lg">Quick Actions</h3>
                  <div className="space-y-2">
                    <Link href="/coach/programs/new">
                      <Button variant="outline" className="w-full justify-start gap-2 bg-transparent text-sm">
                        <Calendar className="h-4 w-4" />
                        Create Program
                      </Button>
                    </Link>
                    <Link href="/coach/trainees">
                      <Button variant="outline" className="w-full justify-start gap-2 bg-transparent text-sm">
                        <Users className="h-4 w-4" />
                        View All Trainees
                      </Button>
                    </Link>
                    <Link href="/coach/analytics">
                      <Button variant="outline" className="w-full justify-start gap-2 bg-transparent text-sm">
                        <TrendingUp className="h-4 w-4" />
                        Analytics Overview
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="rounded-xl border border-border bg-card p-3 sm:p-6">
                  <h3 className="mb-3 sm:mb-4 text-base font-semibold sm:text-lg">Recent Activity</h3>
                  <div className="space-y-3 sm:space-y-4">
                    {[
                      { trainee: "Sarah Chen", action: "completed workout", time: "2h ago" },
                      { trainee: "Marcus Williams", action: "logged meal", time: "4h ago" },
                      { trainee: "Emma Rodriguez", action: "started workout", time: "5h ago" },
                    ].map((activity, idx) => (
                      <div key={idx} className="flex items-start gap-2 sm:gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary mt-1.5 sm:mt-2 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm">
                            <span className="font-medium">{activity.trainee}</span>{" "}
                            <span className="text-muted-foreground">{activity.action}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <MobileNav role="coach" />
      </div>
    </div>
  )
}
