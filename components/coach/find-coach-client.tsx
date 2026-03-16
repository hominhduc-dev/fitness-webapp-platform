"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { Check, Clock, Search, Users } from "lucide-react"

import { Header } from "@/components/layout/header"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Sidebar } from "@/components/layout/sidebar"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createCoachRequest } from "@/lib/fitness/api"
import type { DiscoverableCoach } from "@/lib/fitness/types"

function getInitials(name: string) {
  return name
    .split(" ")
    .map((value) => value[0])
    .join("")
}

export function FindCoachClient({ initialCoaches }: { initialCoaches: DiscoverableCoach[] }) {
  const { session } = useAuth()
  const { locale, messages } = useLocale()
  const [search, setSearch] = useState("")
  const [coaches, setCoaches] = useState(initialCoaches)
  const [pendingCoachId, setPendingCoachId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  const filteredCoaches = useMemo(() => {
    const normalizedQuery = deferredSearch.trim().toLowerCase()

    if (!normalizedQuery) {
      return coaches
    }

    return coaches.filter((coach) => {
      const haystack = [coach.name, coach.email, coach.fitnessGoals.join(" ")].join(" ").toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [coaches, deferredSearch])

  const connectedCoach = coaches.find((coach) => coach.requestStatus === "connected")

  const handleSendRequest = async (coachId: string) => {
    if (!session?.access_token) {
      return
    }

    setPendingCoachId(coachId)
    setError(null)

    try {
      const request = await createCoachRequest(session.access_token, coachId)
      setCoaches((current) =>
        current.map((coach) =>
          coach.id === coachId
            ? {
                ...coach,
                requestId: request.id,
                requestStatus: "pending",
              }
            : coach,
        ),
      )
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : locale === "en" ? "Unable to send the coach request." : "Không thể gửi coach request.")
    } finally {
      setPendingCoachId(null)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold md:text-3xl">{messages.coach.findCoachTitle}</h1>
              <p className="mt-1 text-muted-foreground">{messages.coach.findCoachSubtitle}</p>
            </div>

            <div className="mb-6 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={messages.coach.searchPlaceholder}
                className="pl-10"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {error ? (
              <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <div className="mb-8 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
              <h2 className="text-xl font-bold mb-2">{messages.coach.whyCoach}</h2>
              <div className="grid gap-4 sm:grid-cols-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{messages.coach.personalizedPrograms}</p>
                    <p className="text-sm text-muted-foreground">{messages.coach.personalizedProgramsCopy}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{messages.coach.accountability}</p>
                    <p className="text-sm text-muted-foreground">{messages.coach.accountabilityCopy}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{messages.coach.centralizedProgress}</p>
                    <p className="text-sm text-muted-foreground">{messages.coach.centralizedProgressCopy}</p>
                  </div>
                </div>
              </div>
            </div>

            {connectedCoach ? (
              <div className="mb-6 rounded-xl border border-success/30 bg-success/5 p-4">
                <p className="font-semibold">{messages.coach.currentCoach}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {messages.coach.currentCoachCopy(connectedCoach.name)}
                </p>
              </div>
            ) : null}

            <div>
              <h2 className="mb-4 text-lg font-semibold">{messages.coach.availableCoaches}</h2>
              {filteredCoaches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <p className="text-lg font-semibold">{messages.coach.noCoaches}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {messages.coach.noCoachesCopy}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCoaches.map((coach) => {
                    const isPending = pendingCoachId === coach.id
                    const isConnected = coach.requestStatus === "connected"
                    const isRequestPending = coach.requestStatus === "pending"
                    const disableSend = Boolean(connectedCoach && !isConnected)

                    return (
                      <div
                        key={coach.id}
                        className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-primary/30"
                      >
                        <div className="p-6">
                          <div className="flex items-start gap-4 mb-4">
                            <Avatar className="h-16 w-16 border-2 border-primary/20">
                              <AvatarImage src={coach.avatar || "/placeholder.svg"} />
                              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                                {getInitials(coach.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-lg truncate">{coach.name}</h3>
                              <p className="text-sm text-muted-foreground truncate">{coach.email}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {messages.coach.joined} {coach.createdAt.toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="rounded-lg bg-muted/50 p-3 text-center">
                              <p className="text-lg font-bold">{coach.activeTrainees}</p>
                              <p className="text-xs text-muted-foreground">{messages.coach.activeTraineesLabel}</p>
                            </div>
                            <div className="rounded-lg bg-muted/50 p-3 text-center">
                              <p className="text-lg font-bold">{coach.fitnessGoals.length || 1}</p>
                              <p className="text-xs text-muted-foreground">{messages.coach.focusAreas}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {coach.fitnessGoals.length > 0 ? (
                              coach.fitnessGoals.slice(0, 3).map((goal) => (
                                <span key={goal} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                  {goal}
                                </span>
                              ))
                            ) : (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {messages.coach.generalCoaching}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-border p-4 bg-muted/30">
                          {isConnected ? (
                            <Button disabled className="w-full gap-2 bg-transparent" variant="outline">
                              <Check className="h-4 w-4" />
                              {messages.coach.currentCoachButton}
                            </Button>
                          ) : isRequestPending ? (
                            <Button disabled className="w-full gap-2 bg-transparent" variant="outline">
                              <Clock className="h-4 w-4" />
                              {messages.coach.requestPending}
                            </Button>
                          ) : (
                            <Button
                              className="w-full gap-2 bg-primary hover:bg-primary/90"
                              onClick={() => void handleSendRequest(coach.id)}
                              disabled={isPending || disableSend}
                              variant={disableSend ? "outline" : "default"}
                            >
                              <Users className="h-4 w-4" />
                              {disableSend
                                ? messages.coach.alreadyConnected
                                : isPending
                                  ? messages.coach.sending
                                  : coach.requestStatus === "rejected"
                                    ? messages.coach.sendAgain
                                    : messages.coach.sendRequest}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
