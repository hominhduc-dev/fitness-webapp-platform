import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Filter, ChevronRight, Calendar, TrendingUp } from "lucide-react"
import { trainees } from "@/lib/mock-data"
import Link from "next/link"

export default function TraineesPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="coach" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">Trainees</h1>
                <p className="mt-1 text-muted-foreground">Manage and monitor your trainee progress</p>
              </div>
            </div>

            {/* Search and filter */}
            <div className="mb-6 flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search trainees..." className="pl-10" />
              </div>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>

            {/* Trainees grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trainees.map((trainee) => (
                <Link
                  key={trainee.id}
                  href={`/coach/trainees/${trainee.id}`}
                  className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="h-14 w-14 border-2 border-primary/20">
                      <AvatarImage src={trainee.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {trainee.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold group-hover:text-primary transition-colors">{trainee.name}</h3>
                      <p className="text-sm text-muted-foreground">{trainee.email}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>

                  {/* Goals */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {trainee.fitnessGoals?.map((goal) => (
                      <span key={goal} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {goal}
                      </span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">4/6</p>
                        <p className="text-xs text-muted-foreground">This week</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-success" />
                      <div>
                        <p className="text-sm font-medium text-success">+12%</p>
                        <p className="text-xs text-muted-foreground">Progress</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </main>

        <MobileNav role="coach" />
      </div>
    </div>
  )
}
