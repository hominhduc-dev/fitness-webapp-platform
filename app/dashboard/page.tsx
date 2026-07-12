import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { StatsCard } from "@/components/dashboard/stats-card"
import { TodayWorkout } from "@/components/dashboard/today-workout"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { NutritionSummary } from "@/components/dashboard/nutrition-summary"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { Flame, Target, TrendingUp, Calendar } from "lucide-react"
import { weeklySchedule, dailyNutrition, recentWorkoutLogs, currentUser } from "@/lib/mock-data"

export default function DashboardPage() {
  const today = new Date().getDay()
  const todayWorkout = weeklySchedule[today]

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            {/* Welcome section */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold md:text-3xl">
                Welcome back, <span className="text-primary">{currentUser.name.split(" ")[0]}</span>
              </h1>
              <p className="mt-1 text-muted-foreground">
                {todayWorkout ? "Ready to crush your workout today?" : "Rest day - recovery is key to progress!"}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="mb-6">
              <QuickActions />
            </div>

            {/* Stats Grid */}
            <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Weekly Streak"
                value="12 days"
                icon={Flame}
                variant="accent"
                trend={{ value: 20, positive: true }}
              />
              <StatsCard title="This Week" value="4/6" subtitle="workouts completed" icon={Target} variant="primary" />
              <StatsCard
                title="Total Volume"
                value="45,320"
                subtitle="lbs this week"
                icon={TrendingUp}
                trend={{ value: 8, positive: true }}
              />
              <StatsCard
                title="Next Workout"
                value={todayWorkout ? "Today" : "Tomorrow"}
                subtitle={todayWorkout?.name || "Push Day"}
                icon={Calendar}
              />
            </div>

            {/* Main content grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Today's Workout */}
              <TodayWorkout workout={todayWorkout} />

              {/* Nutrition Summary */}
              <NutritionSummary nutrition={dailyNutrition} />
            </div>

            {/* Recent Activity */}
            <div className="mt-6">
              <RecentActivity logs={recentWorkoutLogs} />
            </div>
          </div>
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
