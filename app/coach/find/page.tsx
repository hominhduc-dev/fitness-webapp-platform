"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Star, Users, Check, Clock } from "lucide-react"

const coaches = [
  {
    id: "1",
    name: "Coach Mike",
    specialty: "Strength & Powerlifting",
    experience: "8 years",
    trainees: 12,
    rating: 4.9,
    avatar: "/professional-male-fitness-coach.png",
  },
  {
    id: "2",
    name: "Sarah Thompson",
    specialty: "Weight Loss & Nutrition",
    experience: "6 years",
    trainees: 18,
    rating: 4.8,
    avatar: "/female-fitness-nutrition-coach.jpg",
  },
  {
    id: "3",
    name: "David Chen",
    specialty: "Bodybuilding & Hypertrophy",
    experience: "10 years",
    trainees: 8,
    rating: 5.0,
    avatar: "/asian-male-bodybuilding-coach.jpg",
  },
]

export default function FindCoachPage() {
  const [requestSent, setRequestSent] = useState<string | null>(null)

  const handleSendRequest = (coachId: string) => {
    setRequestSent(coachId)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            {/* Page header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold md:text-3xl">Find a Coach</h1>
              <p className="mt-1 text-muted-foreground">
                Connect with a professional coach to accelerate your progress
              </p>
            </div>

            {/* Search */}
            <div className="mb-6 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name, specialty, or location..." className="pl-10" />
            </div>

            {/* Benefits banner */}
            <div className="mb-8 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
              <h2 className="text-xl font-bold mb-2">Why work with a coach?</h2>
              <div className="grid gap-4 sm:grid-cols-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Personalized Programs</p>
                    <p className="text-sm text-muted-foreground">Custom workouts tailored to your goals</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Expert Guidance</p>
                    <p className="text-sm text-muted-foreground">Professional feedback and adjustments</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Accountability</p>
                    <p className="text-sm text-muted-foreground">Stay motivated and on track</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Coaches list */}
            <div>
              <h2 className="mb-4 text-lg font-semibold">Available Coaches</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {coaches.map((coach) => (
                  <div
                    key={coach.id}
                    className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/30"
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4 mb-4">
                        <Avatar className="h-16 w-16 border-2 border-primary/20">
                          <AvatarImage src={coach.avatar || "/placeholder.svg"} />
                          <AvatarFallback className="bg-primary/10 text-primary text-lg">
                            {coach.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-lg">{coach.name}</h3>
                          <p className="text-sm text-primary">{coach.specialty}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-4 w-4 fill-warning text-warning" />
                            <span className="text-sm font-medium">{coach.rating}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="text-lg font-bold">{coach.experience}</p>
                          <p className="text-xs text-muted-foreground">Experience</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3 text-center">
                          <p className="text-lg font-bold">{coach.trainees}</p>
                          <p className="text-xs text-muted-foreground">Active Trainees</p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border p-4 bg-muted/30">
                      {requestSent === coach.id ? (
                        <Button disabled className="w-full gap-2 bg-transparent" variant="outline">
                          <Clock className="h-4 w-4" />
                          Request Pending
                        </Button>
                      ) : (
                        <Button
                          className="w-full gap-2 bg-primary hover:bg-primary/90"
                          onClick={() => handleSendRequest(coach.id)}
                        >
                          <Users className="h-4 w-4" />
                          Send Request
                        </Button>
                      )}
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
