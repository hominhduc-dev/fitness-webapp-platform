"use client"

import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { StatsCard } from "@/components/dashboard/stats-card"
import { Flame, Target, TrendingUp, Calendar, Dumbbell } from "lucide-react"
import { progressionData, muscleGroupDistribution, weeklyCaloriesData } from "@/lib/mock-data"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts"

export default function ProgressPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            {/* Page header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold md:text-3xl">Progress & Analytics</h1>
              <p className="mt-1 text-muted-foreground">Track your fitness journey and see your improvements</p>
            </div>

            {/* Stats Overview */}
            <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Current Streak"
                value="12 days"
                icon={Flame}
                variant="accent"
                trend={{ value: 50, positive: true }}
              />
              <StatsCard title="This Month" value="18" subtitle="workouts completed" icon={Target} variant="primary" />
              <StatsCard
                title="Total Volume"
                value="186k"
                subtitle="lbs lifted this month"
                icon={TrendingUp}
                trend={{ value: 12, positive: true }}
              />
              <StatsCard title="Best Streak" value="21 days" subtitle="Personal record" icon={Calendar} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Strength Progression */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 text-lg font-semibold">Strength Progression</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressionData}>
                      <XAxis
                        dataKey="week"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#9CA3AF", fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#9CA3AF", fontSize: 12 }}
                        domain={[100, 300]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1F2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#F9FAFB" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="benchPress"
                        stroke="#22C55E"
                        strokeWidth={2}
                        dot={{ fill: "#22C55E", strokeWidth: 0 }}
                        name="Bench Press"
                      />
                      <Line
                        type="monotone"
                        dataKey="squat"
                        stroke="#2563EB"
                        strokeWidth={2}
                        dot={{ fill: "#2563EB", strokeWidth: 0 }}
                        name="Squat"
                      />
                      <Line
                        type="monotone"
                        dataKey="deadlift"
                        stroke="#F43F5E"
                        strokeWidth={2}
                        dot={{ fill: "#F43F5E", strokeWidth: 0 }}
                        name="Deadlift"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Bench</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-secondary" />
                    <span className="text-muted-foreground">Squat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-accent" />
                    <span className="text-muted-foreground">Deadlift</span>
                  </div>
                </div>
              </div>

              {/* Muscle Group Distribution */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="mb-4 text-lg font-semibold">Muscle Group Distribution</h3>
                <div className="h-72 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={muscleGroupDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {muscleGroupDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1F2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#F9FAFB" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
                  {muscleGroupDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Workout Volume */}
              <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
                <h3 className="mb-4 text-lg font-semibold">Weekly Workout Volume</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyCaloriesData}>
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1F2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#F9FAFB" }}
                      />
                      <Bar dataKey="calories" fill="#22C55E" radius={[4, 4, 0, 0]} name="Volume (lbs)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Personal Records */}
            <div className="mt-6">
              <h2 className="mb-4 text-lg font-semibold">Personal Records</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { exercise: "Bench Press", weight: 185, date: "Dec 15" },
                  { exercise: "Squat", weight: 265, date: "Dec 12" },
                  { exercise: "Deadlift", weight: 315, date: "Dec 10" },
                  { exercise: "Overhead Press", weight: 135, date: "Dec 8" },
                ].map((pr) => (
                  <div
                    key={pr.exercise}
                    className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Dumbbell className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{pr.exercise}</p>
                        <p className="text-xs text-muted-foreground">{pr.date}</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {pr.weight} <span className="text-sm font-normal text-muted-foreground">lbs</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
