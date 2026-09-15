"use client"

import type { ChangeEvent } from "react"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Bell,
  Camera,
  Flame,
  KeyRound,
  Loader2,
  Lock,
  Phone,
  Ruler,
  Save,
  Scale,
  SlidersHorizontal,
  Target,
  Trash2,
  Trophy,
  User,
} from "lucide-react"

import { ProfileEmailChange } from "@/components/profile-email-change"

import { LanguageToggle } from "@/components/layout/language-toggle"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { useToast } from "@/components/providers/toast-provider"
import { SettingsField, SettingsFieldGrid, SettingsSection } from "@/components/settings/settings-section"
import { SettingsNav, type SettingsSectionLink } from "@/components/settings/settings-nav"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { forgotPasswordRequest } from "@/lib/auth/api"
import type { AppActivityLevel, AppProfile, AppSex } from "@/lib/auth/types"
import { useResetTraineeData } from "@/lib/queries/profile"
import { useCreateWeightEntry, useWeightEntries } from "@/lib/queries/progress"
import type { BodyMetricEntry } from "@/lib/fitness/types"
import { getAppBaseUrl } from "@/lib/supabase/config"
import { cn } from "@/lib/utils"

const availableGoalValues = ["Build Muscle", "Lose Weight", "Increase Strength", "Improve Endurance", "Flexibility"] as const
const DEFAULT_DAILY_CALORIE_GOAL = 2500
const MIN_DAILY_CALORIE_GOAL = 500
const MAX_DAILY_CALORIE_GOAL = 10000
const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MIN_HEIGHT_CM = 50
const MAX_HEIGHT_CM = 300
const MIN_TARGET_WEIGHT_KG = 20
const MAX_TARGET_WEIGHT_KG = 500
const KG_TO_LBS = 2.20462

const SECTION_IDS = {
  body: "settings-body",
  goals: "settings-goals",
  notifications: "settings-notifications",
  preferences: "settings-preferences",
  profile: "settings-profile",
  resetData: "settings-reset-data",
  security: "settings-security",
} as const

function convertWeightFromKg(weightKg: number, unit: "kg" | "lbs") {
  return unit === "lbs" ? weightKg * KG_TO_LBS : weightKg
}

function convertWeightToKg(weight: number, unit: "kg" | "lbs") {
  return unit === "lbs" ? weight / KG_TO_LBS : weight
}

function formatNumericInput(value: number, fractionDigits = 1) {
  const rounded = Number(value.toFixed(fractionDigits))
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }

      reject(new Error("avatar_read_failed"))
    }

    reader.onerror = () => {
      reject(new Error("avatar_read_failed"))
    }

    reader.readAsDataURL(file)
  })
}

export type ProfileClientInitialData = {
  profile: AppProfile
  weightEntries: BodyMetricEntry[]
}

export function ProfileClient({ initialData }: { initialData: ProfileClientInitialData }) {
  const { messages } = useLocale()
  const { toast } = useToast()
  const { isLoading, profile: authProfile, session, updateProfile, uploadAvatar } = useAuth()
  const profile = authProfile ?? initialData.profile
  const resetData = useResetTraineeData()
  const weightQuery = useWeightEntries(365, { initialData: initialData.weightEntries })
  const createWeightEntry = useCreateWeightEntry()
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const previousWeightUnitRef = useRef<"kg" | "lbs">("kg")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [preferredWeightUnit, setPreferredWeightUnit] = useState<"kg" | "lbs">("kg")
  const [heightCm, setHeightCm] = useState("")
  const [currentWeight, setCurrentWeight] = useState("")
  const [targetWeight, setTargetWeight] = useState("")
  const [syncedWeightKg, setSyncedWeightKg] = useState<number | null>(null)
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState(String(DEFAULT_DAILY_CALORIE_GOAL))
  const [birthDate, setBirthDate] = useState("")
  const [sex, setSex] = useState<AppSex | "">("")
  const [activityLevel, setActivityLevel] = useState<AppActivityLevel | "">("")
  const [notifications, setNotifications] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [isResettingData, setIsResettingData] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState("")
  const goalLabels: Record<(typeof availableGoalValues)[number], string> = {
    "Build Muscle": messages.profile.goalBuildMuscle,
    Flexibility: messages.profile.goalFlexibility,
    "Improve Endurance": messages.profile.goalImproveEndurance,
    "Increase Strength": messages.profile.goalIncreaseStrength,
    "Lose Weight": messages.profile.goalLoseWeight,
  }

  // Saving is driven from the sticky header now, so an inline banner would sit
  // offscreen for anyone editing a field further down. Toasts follow the reader.
  const notifyError = (message: string) => {
    toast({ title: message, tone: "error" })
  }

  const notifySuccess = (message: string) => {
    toast({ title: message, tone: "success" })
  }

  useEffect(() => {
    if (!profile) {
      return
    }

    const nextWeightUnit = profile.preferredWeightUnit ?? "kg"
    previousWeightUnitRef.current = nextWeightUnit
    setName(profile.name)
    setPhone(profile.phone ?? "")
    setSelectedGoals(profile.fitnessGoals ?? [])
    setPreferredWeightUnit(nextWeightUnit)
    setHeightCm(profile.heightCm != null ? formatNumericInput(profile.heightCm) : "")
    setTargetWeight(
      profile.targetWeightKg != null ? formatNumericInput(convertWeightFromKg(profile.targetWeightKg, nextWeightUnit)) : "",
    )
    setDailyCalorieGoal(String(profile.dailyCalorieGoal ?? DEFAULT_DAILY_CALORIE_GOAL))
    setBirthDate(profile.birthDate ? profile.birthDate.slice(0, 10) : "")
    setSex(profile.sex ?? "")
    setActivityLevel(profile.activityLevel ?? "")
  }, [profile])

  // The SSR seed replaces the hasConsumedInitialWeight ref: the query renders the
  // seeded entries on the first pass and only goes to the network once they age
  // past staleTime, so the "use the seed exactly once" bookkeeping disappears.
  const weightEntries = weightQuery.data ?? []
  const latestWeightKg =
    weightEntries.find((entry) => typeof entry.weightKg === "number" && Number.isFinite(entry.weightKg))?.weightKg ?? null

  // The weight field is editable, so it cannot simply be derived — but it does
  // have to follow the server value when that changes. Adjusting during render
  // is React's documented answer; an effect here would render once with the
  // stale value and cost a second pass.
  if (syncedWeightKg !== latestWeightKg) {
    setSyncedWeightKg(latestWeightKg)
    setCurrentWeight(
      latestWeightKg != null
        // Read the unit from the profile rather than previousWeightUnitRef:
        // touching a ref during render is impure, and the profile is the source
        // that ref is tracking anyway.
        ? formatNumericInput(convertWeightFromKg(latestWeightKg, profile.preferredWeightUnit ?? "kg"))
        : "",
    )
  }

  useEffect(() => {
    const previousUnit = previousWeightUnitRef.current

    if (previousUnit === preferredWeightUnit) {
      return
    }

    setTargetWeight((currentValue) => {
      const parsedValue = Number.parseFloat(currentValue)

      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return currentValue
      }

      const convertedValue = previousUnit === "kg" ? parsedValue * KG_TO_LBS : parsedValue / KG_TO_LBS
      return formatNumericInput(convertedValue)
    })
    setCurrentWeight((currentValue) => {
      const parsedValue = Number.parseFloat(currentValue)

      if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return currentValue
      }

      const convertedValue = previousUnit === "kg" ? parsedValue * KG_TO_LBS : parsedValue / KG_TO_LBS
      return formatNumericInput(convertedValue)
    })
    previousWeightUnitRef.current = preferredWeightUnit
  }, [preferredWeightUnit])

  const toggleGoal = (goal: string) => {
    setSelectedGoals((currentGoals) =>
      currentGoals.includes(goal) ? currentGoals.filter((currentGoal) => currentGoal !== goal) : [...currentGoals, goal],
    )
  }

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ""

    if (!file) {
      return
    }

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      notifyError(messages.profile.avatarInvalidType)
      return
    }

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      notifyError(messages.profile.avatarTooLarge)
      return
    }

    setIsUploadingAvatar(true)

    try {
      const dataUrl = await readFileAsDataUrl(file)
      await uploadAvatar({
        dataUrl,
        fileName: file.name,
      })

      notifySuccess(messages.profile.avatarUpdated)
    } catch (rawError) {
      notifyError(
        rawError instanceof Error && rawError.message !== "avatar_read_failed"
          ? rawError.message
          : messages.profile.avatarUploadFailed,
      )
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    if (!profile) {
      return
    }

    const parsedDailyCalorieGoal = Number.parseInt(dailyCalorieGoal.trim(), 10)
    const parsedHeightCm = heightCm.trim() === "" ? null : Number.parseFloat(heightCm.trim())
    const parsedCurrentWeight = currentWeight.trim() === "" ? null : Number.parseFloat(currentWeight.trim())
    const parsedTargetWeight = targetWeight.trim() === "" ? null : Number.parseFloat(targetWeight.trim())
    const parsedCurrentWeightKg =
      parsedCurrentWeight == null ? null : Number(convertWeightToKg(parsedCurrentWeight, preferredWeightUnit).toFixed(2))
    const parsedTargetWeightKg =
      parsedTargetWeight == null ? null : Number(convertWeightToKg(parsedTargetWeight, preferredWeightUnit).toFixed(2))

    if (
      !Number.isFinite(parsedDailyCalorieGoal) ||
      parsedDailyCalorieGoal < MIN_DAILY_CALORIE_GOAL ||
      parsedDailyCalorieGoal > MAX_DAILY_CALORIE_GOAL
    ) {
      notifyError(messages.profile.invalidDailyCalorieGoal)
      return
    }

    if (
      parsedHeightCm != null &&
      (!Number.isFinite(parsedHeightCm) || parsedHeightCm < MIN_HEIGHT_CM || parsedHeightCm > MAX_HEIGHT_CM)
    ) {
      notifyError(messages.profile.invalidHeight)
      return
    }

    if (
      parsedCurrentWeightKg != null &&
      (!Number.isFinite(parsedCurrentWeightKg) ||
        parsedCurrentWeightKg < MIN_TARGET_WEIGHT_KG ||
        parsedCurrentWeightKg > MAX_TARGET_WEIGHT_KG)
    ) {
      notifyError(messages.profile.invalidCurrentWeight)
      return
    }

    if (
      parsedTargetWeightKg != null &&
      (!Number.isFinite(parsedTargetWeightKg) ||
        parsedTargetWeightKg < MIN_TARGET_WEIGHT_KG ||
        parsedTargetWeightKg > MAX_TARGET_WEIGHT_KG)
    ) {
      notifyError(messages.profile.invalidTargetWeight)
      return
    }

    const trimmedBirthDate = birthDate.trim()
    if (trimmedBirthDate !== "") {
      const parsedBirthDate = new Date(`${trimmedBirthDate}T00:00:00.000Z`)
      const now = new Date()
      if (Number.isNaN(parsedBirthDate.getTime()) || parsedBirthDate > now) {
        notifyError(messages.profile.invalidBirthDate)
        return
      }
    }

    setIsSaving(true)

    try {
      if (parsedCurrentWeightKg != null && !session?.access_token) {
        throw new Error(messages.profile.notSignedIn)
      }

      const updatedProfile = await updateProfile({
        activityLevel: activityLevel === "" ? null : activityLevel,
        birthDate: trimmedBirthDate === "" ? null : trimmedBirthDate,
        dailyCalorieGoal: parsedDailyCalorieGoal,
        fitnessGoals: selectedGoals,
        heightCm: parsedHeightCm,
        name,
        phone: phone.trim() || null,
        preferredWeightUnit,
        sex: sex === "" ? null : sex,
        targetWeightKg: parsedTargetWeightKg,
      })

      if (updatedProfile) {
        const nextWeightUnit = updatedProfile.preferredWeightUnit ?? "kg"
        previousWeightUnitRef.current = nextWeightUnit
        setName(updatedProfile.name)
        setPhone(updatedProfile.phone ?? "")
        setSelectedGoals(updatedProfile.fitnessGoals ?? [])
        setPreferredWeightUnit(nextWeightUnit)
        setHeightCm(updatedProfile.heightCm != null ? formatNumericInput(updatedProfile.heightCm) : "")
        setTargetWeight(
          updatedProfile.targetWeightKg != null
            ? formatNumericInput(convertWeightFromKg(updatedProfile.targetWeightKg, nextWeightUnit))
            : "",
        )
        setDailyCalorieGoal(String(updatedProfile.dailyCalorieGoal ?? DEFAULT_DAILY_CALORIE_GOAL))
        setBirthDate(updatedProfile.birthDate ? updatedProfile.birthDate.slice(0, 10) : "")
        setSex(updatedProfile.sex ?? "")
        setActivityLevel(updatedProfile.activityLevel ?? "")
      }

      const shouldCreateWeightEntry =
        parsedCurrentWeightKg != null && (latestWeightKg == null || Math.abs(parsedCurrentWeightKg - latestWeightKg) > 0.05)

      let resolvedCurrentWeightKg = latestWeightKg

      if (shouldCreateWeightEntry && session?.access_token) {
        const bodyMetric = await createWeightEntry.mutateAsync({
          recordedAt: new Date().toISOString(),
          weightKg: parsedCurrentWeightKg,
        })

        resolvedCurrentWeightKg = bodyMetric.weightKg ?? parsedCurrentWeightKg
      }

      const resolvedWeightUnit = updatedProfile?.preferredWeightUnit ?? preferredWeightUnit
      const displayWeightKg = resolvedCurrentWeightKg ?? parsedCurrentWeightKg

      setCurrentWeight(
        displayWeightKg != null ? formatNumericInput(convertWeightFromKg(displayWeightKg, resolvedWeightUnit)) : "",
      )

      notifySuccess(messages.profile.updated)
    } catch (rawError) {
      notifyError(rawError instanceof Error ? rawError.message : messages.profile.updateFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!profile?.email) {
      return
    }

    setIsSendingReset(true)

    try {
      const redirectUrl = new URL("/auth/callback", getAppBaseUrl())
      redirectUrl.searchParams.set("next", "/reset-password")

      const response = await forgotPasswordRequest({
        identifier: profile.email,
        redirectTo: redirectUrl.toString(),
      })

      notifySuccess(response.message ?? messages.profile.resetEmailSent)
    } catch (rawError) {
      notifyError(rawError instanceof Error ? rawError.message : messages.profile.resetEmailFailed)
    } finally {
      setIsSendingReset(false)
    }
  }

  const handleResetTraineeData = async () => {
    if (!session?.access_token) {
      notifyError(messages.profile.notSignedIn)
      return
    }

    if (resetConfirmation.trim().toUpperCase() !== messages.profile.resetDataConfirmationWord.toUpperCase()) {
      notifyError(messages.profile.resetDataConfirmationMismatch)
      return
    }

    setIsResettingData(true)

    try {
      await resetData.mutateAsync()
      setCurrentWeight("")
      setResetConfirmation("")
      notifySuccess(messages.profile.resetDataSuccess)
    } catch (rawError) {
      notifyError(rawError instanceof Error ? rawError.message : messages.profile.resetDataFailed)
    } finally {
      setIsResettingData(false)
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {messages.profile.loading}
        </div>
      </div>
    )
  }

  const initials = (name || profile.name)
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
  const isResetConfirmationValid =
    resetConfirmation.trim().toUpperCase() === messages.profile.resetDataConfirmationWord.toUpperCase()

  // Body metrics, goals and the reset zone drive trainee-only screens (meals,
  // progress, weight tracking), so a coach or admin gets the shorter page
  // instead of fields nothing in their app reads.
  const isTrainee = profile.role === "trainee"
  const sectionLinks: SettingsSectionLink[] = [
    { icon: User, id: SECTION_IDS.profile, label: messages.profile.profile },
    { icon: SlidersHorizontal, id: SECTION_IDS.preferences, label: messages.profile.preferences },
    ...(isTrainee
      ? [
          { icon: Scale, id: SECTION_IDS.body, label: messages.profile.bodyAndNutrition },
          { icon: Target, id: SECTION_IDS.goals, label: messages.profile.fitnessGoals },
        ]
      : []),
    { icon: Bell, id: SECTION_IDS.notifications, label: messages.profile.notifications },
    { icon: Lock, id: SECTION_IDS.security, label: messages.profile.security },
    ...(isTrainee
      ? [{ icon: AlertTriangle, id: SECTION_IDS.resetData, label: messages.profile.resetData, tone: "danger" as const }]
      : []),
  ]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-8 md:px-6">
      {/* Sticky so Save and the jump list stay reachable from any field. */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/90 px-4 pb-2 pt-4 backdrop-blur-xl md:-mx-6 md:px-6 md:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold leading-tight tracking-[-0.025em] md:text-3xl">
              {messages.profile.title}
            </h1>
            <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{messages.profile.subtitle}</p>
          </div>

          <Button
            className="shrink-0 gap-2"
            onClick={() => void handleSave()}
            disabled={isSaving || isResettingData}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="hidden sm:inline">{isSaving ? messages.common.saving : messages.common.saveChanges}</span>
            <span className="sm:hidden">{isSaving ? messages.common.saving : messages.common.save}</span>
          </Button>
        </div>

        <SettingsNav
          className="mt-2 lg:hidden"
          label={messages.profile.sectionsLabel}
          sections={sectionLinks}
          variant="chips"
        />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:items-start">
        <SettingsNav
          className="hidden lg:sticky lg:top-32 lg:block"
          label={messages.profile.sectionsLabel}
          sections={sectionLinks}
          variant="rail"
        />

        <div className="min-w-0 space-y-4">
          <SettingsSection
            description={messages.profile.profileCopy}
            icon={User}
            id={SECTION_IDS.profile}
            title={messages.profile.profile}
          >
            <input
              ref={avatarInputRef}
              id="avatar-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={isUploadingAvatar}
            />

            <div className="mb-4 flex items-center gap-3 rounded-xl border border-border/70 bg-surface-subtle/60 p-3 sm:gap-4 sm:p-3.5">
              <div className="relative shrink-0">
                <Avatar className="h-14 w-14 border-2 border-primary/20 sm:h-16 sm:w-16">
                  <AvatarImage src={profile.avatar || "/placeholder.svg"} alt={profile.name} />
                  <AvatarFallback className="bg-primary-soft text-2xl text-primary">{initials || "YB"}</AvatarFallback>
                </Avatar>

                <Button
                  type="button"
                  size="icon-sm"
                  className="absolute bottom-0 right-0 rounded-full shadow-lg"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  title={messages.profile.changeAvatar}
                >
                  {isUploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </Button>
              </div>

              <div className="min-w-0 text-left">
                <p className="text-sm font-medium">{messages.profile.changeAvatar}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {isUploadingAvatar ? messages.profile.avatarUploading : messages.profile.avatarRequirements}
                </p>
              </div>
            </div>

            <SettingsFieldGrid>
              <SettingsField htmlFor="name" label={messages.profile.fullName}>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
              </SettingsField>

              <SettingsField htmlFor="phone" label={messages.profile.phone}>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder={messages.profile.phonePlaceholder}
                    className="pl-9"
                  />
                </div>
              </SettingsField>

              <SettingsField htmlFor="email" label={messages.profile.email} wide>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="min-w-0 flex-1 cursor-not-allowed opacity-80"
                  />
                  {!isChangingEmail ? (
                    <Button type="button" variant="outline" className="shrink-0" onClick={() => setIsChangingEmail(true)}>
                      {messages.profile.changeEmail}
                    </Button>
                  ) : null}
                </div>
              </SettingsField>

              {isChangingEmail ? (
                <div className="sm:col-span-2">
                  <ProfileEmailChange currentEmail={profile.email} onCancel={() => setIsChangingEmail(false)} />
                </div>
              ) : null}

              <SettingsField htmlFor="birth-date" hint={messages.profile.birthDateCopy} label={messages.profile.birthDate}>
                <Input
                  id="birth-date"
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </SettingsField>

              <SettingsField htmlFor="sex" hint={messages.profile.sexCopy} label={messages.profile.sex}>
                <Select
                  value={sex === "" ? "unspecified" : sex}
                  onValueChange={(value) => setSex(value === "unspecified" ? "" : (value as AppSex))}
                >
                  <SelectTrigger id="sex" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="unspecified">{messages.profile.sexUnspecified}</SelectItem>
                    <SelectItem value="male">{messages.profile.sexMale}</SelectItem>
                    <SelectItem value="female">{messages.profile.sexFemale}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>
            </SettingsFieldGrid>
          </SettingsSection>

          <SettingsSection
            description={messages.profile.preferencesCopy}
            icon={SlidersHorizontal}
            id={SECTION_IDS.preferences}
            title={messages.profile.preferences}
          >
            <SettingsFieldGrid>
              <SettingsField htmlFor="weight-unit" hint={messages.profile.weightUnitCopy} label={messages.profile.weightUnit}>
                <Select value={preferredWeightUnit} onValueChange={(value: "kg" | "lbs") => setPreferredWeightUnit(value)}>
                  <SelectTrigger id="weight-unit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="kg">{messages.profile.weightUnitKg}</SelectItem>
                    <SelectItem value="lbs">{messages.profile.weightUnitLbs}</SelectItem>
                  </SelectContent>
                </Select>
              </SettingsField>

              {/* Theme and language used to live only in the nav menus; settings
                  is where people look for them, on every role. */}
              <SettingsField hint={messages.profile.languageCopy} label={messages.common.language}>
                <LanguageToggle variant="select" className="bg-transparent" />
              </SettingsField>

              <SettingsField hint={messages.profile.appearanceCopy} label={messages.profile.appearance} wide>
                <ThemeToggle variant="select" className="bg-transparent" />
              </SettingsField>
            </SettingsFieldGrid>
          </SettingsSection>

          {isTrainee ? (
            <SettingsSection
              description={messages.profile.bodyAndNutritionCopy}
              icon={Scale}
              id={SECTION_IDS.body}
              title={messages.profile.bodyAndNutrition}
            >
              <SettingsFieldGrid>
                <SettingsField htmlFor="height-cm" hint={messages.profile.heightCopy} label={`${messages.profile.height} (cm)`}>
                  <div className="relative">
                    <Ruler className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="height-cm"
                      type="number"
                      min={MIN_HEIGHT_CM}
                      max={MAX_HEIGHT_CM}
                      step="0.1"
                      inputMode="decimal"
                      value={heightCm}
                      onChange={(event) => setHeightCm(event.target.value)}
                      placeholder={messages.profile.heightPlaceholder}
                      className="pl-9"
                    />
                  </div>
                </SettingsField>

                <SettingsField
                  htmlFor="current-weight"
                  hint={messages.profile.currentWeightCopy}
                  label={`${messages.profile.currentWeight} (${preferredWeightUnit})`}
                >
                  <div className="relative">
                    <Scale className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="current-weight"
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={currentWeight}
                      onChange={(event) => setCurrentWeight(event.target.value)}
                      placeholder={messages.profile.currentWeightPlaceholder}
                      className="pl-9 pr-14"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                      {preferredWeightUnit}
                    </span>
                  </div>
                </SettingsField>

                <SettingsField
                  htmlFor="target-weight"
                  hint={messages.profile.targetWeightCopy}
                  label={`${messages.profile.targetWeight} (${preferredWeightUnit})`}
                >
                  <div className="relative">
                    <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="target-weight"
                      type="number"
                      min="0"
                      step="0.1"
                      inputMode="decimal"
                      value={targetWeight}
                      onChange={(event) => setTargetWeight(event.target.value)}
                      placeholder={messages.profile.targetWeightPlaceholder}
                      className="pl-9 pr-14"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                      {preferredWeightUnit}
                    </span>
                  </div>
                </SettingsField>

                <SettingsField
                  htmlFor="daily-calorie-goal"
                  hint={messages.profile.dailyCalorieGoalCopy}
                  label={messages.profile.dailyCalorieGoal}
                >
                  <div className="relative">
                    <Flame className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="daily-calorie-goal"
                      type="number"
                      min={MIN_DAILY_CALORIE_GOAL}
                      max={MAX_DAILY_CALORIE_GOAL}
                      step={50}
                      value={dailyCalorieGoal}
                      onChange={(event) => setDailyCalorieGoal(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                </SettingsField>

                <SettingsField
                  htmlFor="activity-level"
                  hint={messages.profile.activityLevelCopy}
                  label={messages.profile.activityLevel}
                  wide
                >
                  <Select
                    value={activityLevel === "" ? "unspecified" : activityLevel}
                    onValueChange={(value) => setActivityLevel(value === "unspecified" ? "" : (value as AppActivityLevel))}
                  >
                    <SelectTrigger id="activity-level" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      <SelectItem value="unspecified">{messages.profile.activityLevelUnspecified}</SelectItem>
                      <SelectItem value="sedentary">{messages.profile.activitySedentary}</SelectItem>
                      <SelectItem value="light">{messages.profile.activityLight}</SelectItem>
                      <SelectItem value="moderate">{messages.profile.activityModerate}</SelectItem>
                      <SelectItem value="active">{messages.profile.activityActive}</SelectItem>
                      <SelectItem value="very_active">{messages.profile.activityVeryActive}</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsField>
              </SettingsFieldGrid>
            </SettingsSection>
          ) : null}

          {isTrainee ? (
            <SettingsSection
              description={messages.profile.fitnessGoalsCopy}
              icon={Trophy}
              id={SECTION_IDS.goals}
              title={messages.profile.fitnessGoals}
            >
              <div className="flex flex-wrap gap-2">
                {availableGoalValues.map((goal) => {
                  const isSelected = selectedGoals.includes(goal)

                  return (
                    <button
                      key={goal}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleGoal(goal)}
                      className={cn(
                        "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors pointer-coarse:min-h-11",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {goalLabels[goal]}
                    </button>
                  )
                })}
              </div>
            </SettingsSection>
          ) : null}

          <SettingsSection
            description={messages.profile.notificationsCopy}
            icon={Bell}
            id={SECTION_IDS.notifications}
            title={messages.profile.notifications}
          >
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3 sm:p-3.5">
              <div className="min-w-0">
                <Label htmlFor="push-notifications" className="text-sm font-medium">
                  {messages.profile.pushNotifications}
                </Label>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{messages.profile.pushNotificationsCopy}</p>
              </div>
              <Switch id="push-notifications" checked={notifications} onCheckedChange={setNotifications} />
            </div>
          </SettingsSection>

          <SettingsSection
            description={messages.profile.changePasswordCopy}
            icon={Lock}
            id={SECTION_IDS.security}
            title={messages.profile.security}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild className="gap-2 sm:w-auto">
                <Link href="/reset-password">
                  <KeyRound className="h-4 w-4" />
                  {messages.profile.changePassword}
                </Link>
              </Button>

              {/* For someone who no longer knows the current password. */}
              <Button
                variant="ghost"
                className="text-muted-foreground sm:w-auto"
                onClick={() => void handlePasswordReset()}
                disabled={isSendingReset}
              >
                {isSendingReset ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {messages.common.sendingEmail}
                  </>
                ) : (
                  messages.profile.forgotPasswordSendEmail
                )}
              </Button>
            </div>
          </SettingsSection>

          {isTrainee ? (
            <SettingsSection
              collapsible
              description={messages.profile.resetDataCopy}
              icon={AlertTriangle}
              id={SECTION_IDS.resetData}
              title={messages.profile.resetData}
              tone="danger"
            >
              <div className="space-y-2 border-t border-destructive/20 pt-4">
                <Label htmlFor="reset-trainee-data">{messages.profile.resetDataConfirmationLabel}</Label>
                <Input
                  id="reset-trainee-data"
                  value={resetConfirmation}
                  onChange={(event) => setResetConfirmation(event.target.value)}
                  placeholder={messages.profile.resetDataConfirmationWord}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  disabled={isResettingData}
                  className="border-destructive/20 bg-background"
                />
                <p className="text-xs text-muted-foreground">{messages.profile.resetDataConfirmationHint}</p>
              </div>

              <Button
                variant="destructive"
                className="mt-4 w-full gap-2 sm:w-auto"
                onClick={() => void handleResetTraineeData()}
                disabled={isResettingData || !isResetConfirmationValid}
              >
                {isResettingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isResettingData ? messages.profile.resetDataInProgress : messages.profile.resetDataAction}
              </Button>
            </SettingsSection>
          ) : null}
        </div>
      </div>
    </div>
  )
}
