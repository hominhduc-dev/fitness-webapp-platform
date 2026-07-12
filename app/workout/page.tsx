import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Button } from "@/components/ui/button"
import { Plus, Play, Clock, Dumbbell } from "lucide-react"
import { sampleWorkouts } from "@/lib/mock-data"
import Link from "next/link"

export default function WorkoutPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">Workouts</h1>
                <p className="mt-1 text-muted-foreground">Choose a workout or create your own</p>
              </div>
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="h-4 w-4" />
                Create Workout
              </Button>
            </div>

            {/* Quick start */}
            <div className="mb-8">
              <h2 className="mb-4 text-lg font-semibold">Quick Start</h2>
              <Link href="/workout/quick">
                <div className="group rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20">
                        <Dumbbell className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Start Empty Workout</h3>
                        <p className="text-muted-foreground">Log exercises as you go</p>
                      </div>
                    </div>
                    <Button size="lg" className="gap-2 bg-primary hover:bg-primary/90">
                      <Play className="h-5 w-5" />
                      Start
                    </Button>
                  </div>
                </div>
              </Link>
            </div>

            {/* Workout templates */}
            <div>
              <h2 className="mb-4 text-lg font-semibold">Your Workouts</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sampleWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="group rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/30"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                            {workout.name}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {workout.duration} min
                            </span>
                            <span>{workout.exercises.length} exercises</span>
                          </div>
                        </div>
                      </div>

                      {/* Exercise preview */}
                      <div className="space-y-2 mb-4">
                        {workout.exercises.slice(0, 3).map((ex) => (
                          <div key={ex.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{ex.exercise.name}</span>
                            <span>
                              {ex.sets.length} × {ex.sets[0]?.targetReps}
                            </span>
                          </div>
                        ))}
                        {workout.exercises.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{workout.exercises.length - 3} more</p>
                        )}
                      </div>

                      {/* Muscle groups */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {[...new Set(workout.exercises.map((e) => e.exercise.muscleGroup))].map((group) => (
                          <span key={group} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {group}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-border p-3 bg-muted/30">
                      <Link href={`/workout/${workout.id}/start`}>
                        <Button className="w-full gap-2 bg-primary hover:bg-primary/90">
                          <Play className="h-4 w-4" />
                          Start Workout
                        </Button>
                      </Link>
                    </div>
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
