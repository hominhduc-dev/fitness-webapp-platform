"use client"

import { useState, useEffect } from "react"
import { Play, Pause, RotateCcw, Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RestTimerProps {
  defaultTime?: number // in seconds
  onComplete?: () => void
}

export function RestTimer({ defaultTime = 90, onComplete }: RestTimerProps) {
  const [timeLeft, setTimeLeft] = useState(defaultTime)
  const [isRunning, setIsRunning] = useState(false)
  const [initialTime, setInitialTime] = useState(defaultTime)

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false)
            onComplete?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [isRunning, timeLeft, onComplete])

  const toggleTimer = () => setIsRunning(!isRunning)

  const resetTimer = () => {
    setIsRunning(false)
    setTimeLeft(initialTime)
  }

  const adjustTime = (amount: number) => {
    const newTime = Math.max(0, initialTime + amount)
    setInitialTime(newTime)
    if (!isRunning) {
      setTimeLeft(newTime)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const progress = (timeLeft / initialTime) * 100

  return (
    <div className="lg:sticky lg:top-24 lg:rounded-xl border border-border bg-card/95 backdrop-blur-sm py-3 px-4 md:px-6 md:border-b lg:border-b-0">
      <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-start">
        {/* Left: Timer Circle and Time */}
        <div className="flex items-center gap-3 flex-shrink-0 lg:flex-col lg:w-full">
          <div className="relative h-16 w-16 flex-shrink-0 lg:h-20 lg:w-20">
            <svg className="h-16 w-16 lg:h-20 lg:w-20 -rotate-90 transform">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                className="text-muted lg:r-36 lg:cx-40 lg:cy-40"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={`${progress * 1.76} 176`}
                className={cn("transition-all duration-1000", timeLeft <= 10 ? "text-accent" : "text-primary")}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn("text-lg font-bold tabular-nums", timeLeft <= 10 && "text-accent")}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1 lg:w-full">
            <h3 className="text-sm font-medium text-foreground">Rest Timer</h3>
            <div className="flex gap-1 lg:w-full">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => adjustTime(-15)}>
                <Minus className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => adjustTime(15)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 flex-shrink-0 lg:w-full lg:flex-col">
          <Button 
            className={cn(
              "h-10 px-4 gap-2 text-sm lg:w-full",
              isRunning ? "bg-accent hover:bg-accent/90" : "bg-primary hover:bg-primary/90",
            )}
            onClick={toggleTimer}
          >
            {isRunning ? (
              <>
                <Pause className="h-4 w-4" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span className="hidden sm:inline">Start</span>
              </>
            )}
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 bg-transparent lg:w-full lg:h-10" onClick={resetTimer}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
