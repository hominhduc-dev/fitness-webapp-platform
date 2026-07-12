"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Save, User, Bell, Lock, Palette } from "lucide-react"
import { currentUser } from "@/lib/mock-data"

export default function ProfilePage() {
  const [name, setName] = useState(currentUser.name)
  const [email, setEmail] = useState(currentUser.email)
  const [notifications, setNotifications] = useState(true)
  const [restTimerSound, setRestTimerSound] = useState(true)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="trainee" />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
            {/* Page header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold md:text-3xl">Settings</h1>
              <p className="mt-1 text-muted-foreground">Manage your account and preferences</p>
            </div>

            {/* Profile Section */}
            <div className="rounded-xl border border-border bg-card p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <User className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Profile</h2>
              </div>

              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-4 border-primary/20">
                    <AvatarImage src={currentUser.avatar || "/placeholder.svg"} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {currentUser.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Fitness Goals */}
            <div className="rounded-xl border border-border bg-card p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <Palette className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Fitness Goals</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {["Build Muscle", "Lose Weight", "Increase Strength", "Improve Endurance", "Flexibility"].map(
                  (goal) => {
                    const isSelected = currentUser.fitnessGoals?.includes(goal)
                    return (
                      <button
                        key={goal}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {goal}
                      </button>
                    )
                  },
                )}
              </div>
            </div>

            {/* Notifications */}
            <div className="rounded-xl border border-border bg-card p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <Bell className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Notifications</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive workout reminders</p>
                  </div>
                  <Switch checked={notifications} onCheckedChange={setNotifications} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Rest Timer Sound</p>
                    <p className="text-sm text-muted-foreground">Play sound when rest is over</p>
                  </div>
                  <Switch checked={restTimerSound} onCheckedChange={setRestTimerSound} />
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="rounded-xl border border-border bg-card p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Security</h2>
              </div>

              <Button variant="outline" className="w-full bg-transparent">
                Change Password
              </Button>
            </div>

            {/* Save Button */}
            <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </main>

        <MobileNav role="trainee" />
      </div>
    </div>
  )
}
