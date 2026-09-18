"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AppActivityLevel, AppSex, UpdateProfileInput } from "@/lib/auth/types"
import { convertWeightToKg } from "@/lib/fitness/weight"
import { skipOnboarding } from "@/lib/onboarding/state"
import { useCreateWeightEntry } from "@/lib/queries/progress"
import { useUpdateProfile } from "@/lib/queries/profile"
import { cn } from "@/lib/utils"

const STEPS = ["sex", "birthDate", "height", "weight", "activity", "goals"] as const
type Step = (typeof STEPS)[number]

const ACTIVITY_LEVELS: readonly AppActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"]
/** The same strings `fitnessGoals` already stores, so Profile round-trips them unchanged. */
const GOAL_VALUES = ["Build Muscle", "Lose Weight", "Increase Strength", "Improve Endurance", "Flexibility"] as const

/** Translates the goal picked here into the vocabulary the AI generator expects. */
const AI_GOALS: Record<(typeof GOAL_VALUES)[number], string> = {
  "Build Muscle": "build_muscle",
  Flexibility: "general_fitness",
  "Improve Endurance": "endurance",
  "Increase Strength": "strength",
  "Lose Weight": "lose_weight",
}

const MIN_HEIGHT_CM = 50
const MAX_HEIGHT_CM = 300
const MIN_WEIGHT = 20
const MAX_WEIGHT = 500

function OptionButton({
  children,
  description,
  onClick,
  selected,
}: {
  children: ReactNode
  description?: string
  onClick: () => void
  selected: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-2xl border px-4 py-3.5 text-left transition-colors",
        "pointer-coarse:min-h-12",
        selected ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-accent",
      )}
    >
      <span className="block text-sm font-semibold leading-5">{children}</span>
      {description ? <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{description}</span> : null}
    </button>
  )
}

/**
 * Asks a new trainee for the profile fields the rest of the app reads back, one
 * question per screen, then hands the answers to the AI program generator.
 *
 * Every screen is skippable: an abandoned wizard costs an account, and each field
 * also has a home on the Profile page. Nothing is written until the last step, so
 * backing out leaves no half-filled profile behind.
 */
export function OnboardingWizard() {
  const { messages } = useLocale()
  const copy = messages.onboarding
  const router = useRouter()
  const { profile } = useAuth()
  const updateProfile = useUpdateProfile()
  const createWeightEntry = useCreateWeightEntry()

  const [stepIndex, setStepIndex] = useState(0)
  const [sex, setSex] = useState<AppSex | null>(profile?.sex ?? null)
  const [birthDate, setBirthDate] = useState(profile?.birthDate?.slice(0, 10) ?? "")
  const [height, setHeight] = useState(profile?.heightCm ? String(profile.heightCm) : "")
  const [unit, setUnit] = useState<"kg" | "lbs">(profile?.preferredWeightUnit ?? "kg")
  const [weight, setWeight] = useState("")
  const [activityLevel, setActivityLevel] = useState<AppActivityLevel | null>(profile?.activityLevel ?? null)
  const [goals, setGoals] = useState<string[]>(profile?.fitnessGoals ?? [])
  const [error, setError] = useState<string | null>(null)

  const step: Step = STEPS[stepIndex]
  const isSaving = updateProfile.isPending || createWeightEntry.isPending

  const heightCm = Number(height)
  const heightValid = height !== "" && Number.isFinite(heightCm) && heightCm >= MIN_HEIGHT_CM && heightCm <= MAX_HEIGHT_CM
  const weightValue = Number(weight)
  const weightValid = weight !== "" && Number.isFinite(weightValue) && weightValue >= MIN_WEIGHT && weightValue <= MAX_WEIGHT
  // A birth date in the future, or one typed as "20260-01-01", is a typo rather than an answer.
  const birthDateValid = birthDate !== "" && !Number.isNaN(Date.parse(birthDate)) && new Date(birthDate) < new Date()

  const advance = () => {
    setError(null)
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1))
  }

  const goBack = () => {
    setError(null)
    setStepIndex((current) => Math.max(current - 1, 0))
  }

  const handleSkip = () => {
    skipOnboarding()
    router.replace("/dashboard")
  }

  const toggleGoal = (goal: string) => {
    setGoals((current) => (current.includes(goal) ? current.filter((entry) => entry !== goal) : [...current, goal]))
  }

  const handleFinish = async () => {
    const payload: UpdateProfileInput = {}
    if (sex) payload.sex = sex
    if (birthDateValid) payload.birthDate = birthDate
    if (heightValid) payload.heightCm = heightCm
    if (activityLevel) payload.activityLevel = activityLevel
    if (goals.length > 0) payload.fitnessGoals = goals
    payload.preferredWeightUnit = unit

    try {
      await updateProfile.mutateAsync(payload)
    } catch {
      setError(copy.saveError)
      return
    }

    // Best effort: the profile is what gates the app, and a missing first weight
    // entry is something the Track weight screen can still collect later.
    if (weightValid) {
      await createWeightEntry.mutateAsync({ weightKg: convertWeightToKg(weightValue, unit) }).catch(() => undefined)
    }

    const goal = AI_GOALS[goals[0] as (typeof GOAL_VALUES)[number]] ?? "general_fitness"
    router.replace(`/workout/ai-generate?mode=program&goal=${goal}`)
  }

  const titles: Record<Step, string> = {
    activity: copy.activityTitle,
    birthDate: copy.birthDateTitle,
    goals: copy.goalsTitle,
    height: copy.heightTitle,
    sex: copy.sexTitle,
    weight: copy.weightTitle,
  }
  const questions: Record<Step, string> = {
    activity: copy.activityQuestion,
    birthDate: copy.birthDateQuestion,
    goals: copy.goalsQuestion,
    height: copy.heightQuestion,
    sex: copy.sexQuestion,
    weight: copy.weightQuestion,
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          disabled={stepIndex === 0}
          aria-label={copy.back}
          className={cn(stepIndex === 0 && "invisible")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <p className="font-mono text-micro uppercase tracking-[0.08em] text-muted-foreground">
          {copy.stepCounter(stepIndex + 1, STEPS.length)}
        </p>
        <Button variant="ghost" size="sm" onClick={handleSkip} disabled={isSaving}>
          {copy.skip}
        </Button>
      </div>

      <div className="mt-8 flex-1">
        <p className="text-sm leading-5 text-muted-foreground">{titles[step]}</p>
        <h1 className="mt-1 text-2xl font-bold leading-8 text-foreground">{questions[step]}</h1>

        <div className="mt-8 flex flex-col gap-2.5">
          {step === "sex" && (
            <>
              <OptionButton selected={sex === "male"} onClick={() => { setSex("male"); advance() }}>
                {copy.sexMale}
              </OptionButton>
              <OptionButton selected={sex === "female"} onClick={() => { setSex("female"); advance() }}>
                {copy.sexFemale}
              </OptionButton>
            </>
          )}

          {step === "birthDate" && (
            <Input
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              aria-label={copy.birthDateQuestion}
              onChange={(event) => setBirthDate(event.target.value)}
              className="h-12 text-base"
            />
          )}

          {step === "height" && (
            <div className="flex items-center gap-3">
              <Input
                type="number"
                inputMode="numeric"
                value={height}
                aria-label={copy.heightQuestion}
                onChange={(event) => setHeight(event.target.value)}
                className="h-12 text-base"
              />
              <span className="text-sm font-semibold text-muted-foreground">cm</span>
            </div>
          )}

          {step === "weight" && (
            <>
              <div className="flex w-fit rounded-full bg-muted p-1" role="group" aria-label={copy.weightQuestion}>
                {(["kg", "lbs"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={unit === option}
                    onClick={() => setUnit(option)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                      unit === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  aria-label={copy.weightQuestion}
                  onChange={(event) => setWeight(event.target.value)}
                  className="h-12 text-base"
                />
                <span className="text-sm font-semibold text-muted-foreground">{unit}</span>
              </div>
            </>
          )}

          {step === "activity" && ACTIVITY_LEVELS.map((level) => (
            <OptionButton
              key={level}
              selected={activityLevel === level}
              onClick={() => { setActivityLevel(level); advance() }}
            >
              {messages.profile[ACTIVITY_LABEL_KEYS[level]]}
            </OptionButton>
          ))}

          {step === "goals" && GOAL_VALUES.map((goal) => (
            <OptionButton key={goal} selected={goals.includes(goal)} onClick={() => toggleGoal(goal)}>
              {messages.profile[GOAL_LABEL_KEYS[goal]]}
            </OptionButton>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-destructive-text">{error}</p> : null}
        {step === "birthDate" && birthDate !== "" && !birthDateValid
          ? <p className="mt-4 text-sm text-destructive-text">{copy.birthDateInvalid}</p>
          : null}
        {step === "height" && height !== "" && !heightValid
          ? <p className="mt-4 text-sm text-destructive-text">{copy.heightInvalid}</p>
          : null}
        {step === "weight" && weight !== "" && !weightValid
          ? <p className="mt-4 text-sm text-destructive-text">{copy.weightInvalid}</p>
          : null}
      </div>

      {step !== "sex" && step !== "activity" && (
        <Button
          size="lg"
          className="mt-6 w-full"
          // An empty field means "skip this one"; only a filled-in bad value blocks.
          disabled={isSaving
            || (step === "birthDate" && birthDate !== "" && !birthDateValid)
            || (step === "height" && height !== "" && !heightValid)
            || (step === "weight" && weight !== "" && !weightValid)}
          onClick={() => (step === "goals" ? void handleFinish() : advance())}
        >
          {step === "goals" ? copy.finish : copy.next}
        </Button>
      )}
    </div>
  )
}

const ACTIVITY_LABEL_KEYS = {
  active: "activityActive",
  light: "activityLight",
  moderate: "activityModerate",
  sedentary: "activitySedentary",
  very_active: "activityVeryActive",
} as const

const GOAL_LABEL_KEYS = {
  "Build Muscle": "goalBuildMuscle",
  Flexibility: "goalFlexibility",
  "Improve Endurance": "goalImproveEndurance",
  "Increase Strength": "goalIncreaseStrength",
  "Lose Weight": "goalLoseWeight",
} as const
