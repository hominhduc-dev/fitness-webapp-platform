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

/**
 * Paints the question's key phrase in the accent colour, the way the reference
 * flow does. Falls back to plain text when a translation no longer contains the
 * phrase, so a copy edit degrades instead of breaking.
 */
function AccentedQuestion({ accent, text }: { accent: string; text: string }) {
  const start = text.indexOf(accent)
  if (start < 0) return <>{text}</>

  return (
    <>
      {text.slice(0, start)}
      <span className="text-primary">{accent}</span>
      {text.slice(start + accent.length)}
    </>
  )
}

function OptionButton({
  children,
  onClick,
  selected,
}: {
  children: ReactNode
  onClick: () => void
  selected: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group w-full rounded-2xl border px-5 py-4 text-left text-base font-semibold",
        "transition-all duration-150 active:scale-[0.99] pointer-coarse:min-h-14",
        selected
          ? "border-primary bg-primary-soft text-primary shadow-[0_8px_24px_-12px_var(--primary)]"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent",
      )}
    >
      {children}
    </button>
  )
}

/** The unit-aware number field shared by the height and weight steps. */
function MeasureField({
  label,
  onChange,
  suffix,
  value,
  ...inputProps
}: {
  label: string
  onChange: (value: string) => void
  suffix: string
  value: string
} & Pick<React.ComponentProps<"input">, "inputMode">) {
  return (
    <div className="flex items-end gap-2 border-b-2 border-border pb-2 focus-within:border-primary">
      <Input
        {...inputProps}
        type="number"
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-auto border-0 bg-transparent p-0 text-5xl font-bold tracking-tight shadow-none",
          "focus-visible:border-0 focus-visible:ring-0",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
      />
      <span className="pb-1.5 text-lg font-semibold text-muted-foreground">{suffix}</span>
    </div>
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
  const questions: Record<Step, { accent: string; text: string }> = {
    activity: { accent: copy.activityAccent, text: copy.activityQuestion },
    birthDate: { accent: copy.birthDateAccent, text: copy.birthDateQuestion },
    goals: { accent: copy.goalsAccent, text: copy.goalsQuestion },
    height: { accent: copy.heightAccent, text: copy.heightQuestion },
    sex: { accent: copy.sexAccent, text: copy.sexQuestion },
    weight: { accent: copy.weightAccent, text: copy.weightQuestion },
  }

  /** What the previous step answered, echoed as a chip the way a chat thread would. */
  const answers: Record<Step, string | null> = {
    activity: activityLevel ? messages.profile[ACTIVITY_LABEL_KEYS[activityLevel]] : null,
    birthDate: birthDateValid ? birthDate : null,
    goals: goals.length > 0 ? goals.map((goal) => messages.profile[GOAL_LABEL_KEYS[goal as keyof typeof GOAL_LABEL_KEYS]]).join(" · ") : null,
    height: heightValid ? `${heightCm} cm` : null,
    sex: sex ? (sex === "male" ? copy.sexMale : copy.sexFemale) : null,
    weight: weightValid ? `${weightValue} ${unit}` : null,
  }
  const previousAnswer = stepIndex > 0 ? answers[STEPS[stepIndex - 1]] : null

  const validationError = (step === "birthDate" && birthDate !== "" && !birthDateValid && copy.birthDateInvalid)
    || (step === "height" && height !== "" && !heightValid && copy.heightInvalid)
    || (step === "weight" && weight !== "" && !weightValid && copy.weightInvalid)
    || null

  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Ambient brand glow — the reference flow's signature, kept subtle enough
          for the light theme by riding on the primary token's own alpha. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[420px] opacity-60 blur-3xl"
        style={{ background: "radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--primary) 45%, transparent), transparent 70%)" }}
      />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
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

        <div className="mt-3 flex gap-1.5" role="presentation">
          {STEPS.map((id, index) => (
            <span
              key={id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                index <= stepIndex ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>

        <div className="mt-5 flex h-8 items-center justify-end">
          {previousAnswer ? (
            <span
              key={previousAnswer}
              className="animate-in fade-in slide-in-from-right-2 max-w-full truncate rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground duration-300"
            >
              {previousAnswer}
            </span>
          ) : null}
        </div>

        <div key={step} className="animate-in fade-in slide-in-from-bottom-3 mt-2 flex-1 duration-300">
          <p className="text-sm leading-5 text-muted-foreground">{titles[step]}</p>
          <h1 className="mt-1.5 text-[1.75rem] font-bold leading-9 tracking-tight text-foreground">
            <AccentedQuestion accent={questions[step].accent} text={questions[step].text} />
          </h1>

          <div className="mt-9 flex flex-col gap-3">
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
                className="h-14 rounded-2xl text-lg font-semibold"
              />
            )}

            {step === "height" && (
              <MeasureField
                label={copy.heightQuestion}
                inputMode="numeric"
                value={height}
                suffix="cm"
                onChange={setHeight}
              />
            )}

            {step === "weight" && (
              <>
                <div className="flex w-fit rounded-full border border-border bg-card p-1" role="group" aria-label={copy.weightQuestion}>
                  {(["kg", "lbs"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={unit === option}
                      onClick={() => setUnit(option)}
                      className={cn(
                        "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors",
                        unit === option ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <MeasureField
                  label={copy.weightQuestion}
                  inputMode="decimal"
                  value={weight}
                  suffix={unit}
                  onChange={setWeight}
                />
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

          {error ? <p className="mt-5 text-sm text-destructive-text">{error}</p> : null}
          {validationError ? <p className="mt-5 text-sm text-destructive-text">{validationError}</p> : null}
        </div>

        {step !== "sex" && step !== "activity" && (
          <Button
            size="lg"
            className="mt-8 h-14 w-full rounded-full text-base font-semibold shadow-[0_14px_32px_-16px_var(--primary)]"
            // An empty field means "skip this one"; only a filled-in bad value blocks.
            disabled={isSaving || Boolean(validationError)}
            onClick={() => (step === "goals" ? void handleFinish() : advance())}
          >
            {step === "goals" ? copy.finish : copy.next}
          </Button>
        )}
      </div>
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
