"use client"

import type { ChangeEvent } from "react"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Bell, Camera, Flame, Loader2, Lock, Palette, Phone, Save, Scale, Trash2, User } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { forgotPasswordRequest, resetCurrentTraineeDataRequest } from "@/lib/auth/api"
import type { AppProfile } from "@/lib/auth/types"
import { createWeightEntry, fetchWeightEntries } from "@/lib/fitness/api"
import type { BodyMetricEntry } from "@/lib/fitness/types"
import { getAppBaseUrl } from "@/lib/supabase/config"

const availableGoals = ["Build Muscle", "Lose Weight", "Increase Strength", "Improve Endurance", "Flexibility"]
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
  const { locale, messages } = useLocale()
  const { isLoading, profile: authProfile, session, updateProfile, uploadAvatar } = useAuth()
  const profile = authProfile ?? initialData.profile
  const hasConsumedInitialWeight = useRef(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const previousWeightUnitRef = useRef<"kg" | "lbs">("kg")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [selectedGoals, setSelectedGoals] = useState<string[]>([])
  const [preferredWeightUnit, setPreferredWeightUnit] = useState<"kg" | "lbs">("kg")
  const [heightCm, setHeightCm] = useState("")
  const [currentWeight, setCurrentWeight] = useState("")
  const [targetWeight, setTargetWeight] = useState("")
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null)
  const [dailyCalorieGoal, setDailyCalorieGoal] = useState(String(DEFAULT_DAILY_CALORIE_GOAL))
  const [notifications, setNotifications] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [isResettingData, setIsResettingData] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
  }, [profile])

  useEffect(() => {
    let cancelled = false

    async function loadCurrentWeight() {
      if (!session?.access_token || !profile?.id) {
        setLatestWeightKg(null)
        setCurrentWeight("")
        return
      }

      try {
        const entries = !hasConsumedInitialWeight.current
          ? initialData.weightEntries
          : await fetchWeightEntries(session.access_token, 365)
        hasConsumedInitialWeight.current = true

        if (cancelled) {
          return
        }

        const nextLatestWeightKg =
          entries.find((entry) => typeof entry.weightKg === "number" && Number.isFinite(entry.weightKg))?.weightKg ?? null

        setLatestWeightKg(nextLatestWeightKg)
        setCurrentWeight(
          nextLatestWeightKg != null
            ? formatNumericInput(convertWeightFromKg(nextLatestWeightKg, previousWeightUnitRef.current))
            : "",
        )
      } catch {
        if (!cancelled) {
          setLatestWeightKg(null)
          setCurrentWeight("")
        }
      }
    }

    void loadCurrentWeight()

    return () => {
      cancelled = true
    }
  }, [initialData.weightEntries, profile?.id, session?.access_token])

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
      setError(messages.profile.avatarInvalidType)
      setSuccess(null)
      return
    }

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      setError(messages.profile.avatarTooLarge)
      setSuccess(null)
      return
    }

    setError(null)
    setSuccess(null)
    setIsUploadingAvatar(true)

    try {
      const dataUrl = await readFileAsDataUrl(file)
      await uploadAvatar({
        dataUrl,
        fileName: file.name,
      })

      setSuccess(messages.profile.avatarUpdated)
    } catch (rawError) {
      setError(
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
      setError(messages.profile.invalidDailyCalorieGoal)
      setSuccess(null)
      return
    }

    if (
      parsedHeightCm != null &&
      (!Number.isFinite(parsedHeightCm) || parsedHeightCm < MIN_HEIGHT_CM || parsedHeightCm > MAX_HEIGHT_CM)
    ) {
      setError(messages.profile.invalidHeight)
      setSuccess(null)
      return
    }

    if (
      parsedCurrentWeightKg != null &&
      (!Number.isFinite(parsedCurrentWeightKg) ||
        parsedCurrentWeightKg < MIN_TARGET_WEIGHT_KG ||
        parsedCurrentWeightKg > MAX_TARGET_WEIGHT_KG)
    ) {
      setError(messages.profile.invalidCurrentWeight)
      setSuccess(null)
      return
    }

    if (
      parsedTargetWeightKg != null &&
      (!Number.isFinite(parsedTargetWeightKg) ||
        parsedTargetWeightKg < MIN_TARGET_WEIGHT_KG ||
        parsedTargetWeightKg > MAX_TARGET_WEIGHT_KG)
    ) {
      setError(messages.profile.invalidTargetWeight)
      setSuccess(null)
      return
    }

    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      if (parsedCurrentWeightKg != null && !session?.access_token) {
        throw new Error(locale === "en" ? "You are not signed in." : "Bạn chưa đăng nhập.")
      }

      const updatedProfile = await updateProfile({
        dailyCalorieGoal: parsedDailyCalorieGoal,
        fitnessGoals: selectedGoals,
        heightCm: parsedHeightCm,
        name,
        phone: phone.trim() || null,
        preferredWeightUnit,
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
      }

      const shouldCreateWeightEntry =
        parsedCurrentWeightKg != null && (latestWeightKg == null || Math.abs(parsedCurrentWeightKg - latestWeightKg) > 0.05)

      let resolvedCurrentWeightKg = latestWeightKg

      if (shouldCreateWeightEntry && session?.access_token) {
        const bodyMetric = await createWeightEntry(session.access_token, {
          recordedAt: new Date().toISOString(),
          weightKg: parsedCurrentWeightKg,
        })

        resolvedCurrentWeightKg = bodyMetric.weightKg ?? parsedCurrentWeightKg
        setLatestWeightKg(resolvedCurrentWeightKg)
      }

      const resolvedWeightUnit = updatedProfile?.preferredWeightUnit ?? preferredWeightUnit
      const displayWeightKg = resolvedCurrentWeightKg ?? parsedCurrentWeightKg

      setCurrentWeight(
        displayWeightKg != null ? formatNumericInput(convertWeightFromKg(displayWeightKg, resolvedWeightUnit)) : "",
      )

      setSuccess(messages.profile.updated)
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : messages.profile.updateFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!profile?.email) {
      return
    }

    setError(null)
    setSuccess(null)
    setIsSendingReset(true)

    try {
      const redirectUrl = new URL("/auth/callback", getAppBaseUrl())
      redirectUrl.searchParams.set("next", "/reset-password")

      const response = await forgotPasswordRequest({
        identifier: profile.email,
        redirectTo: redirectUrl.toString(),
      })

      setSuccess(response.message ?? messages.profile.resetEmailSent)
    } catch (rawError) {
      setError(
        rawError instanceof Error
          ? rawError.message
          : locale === "en"
            ? "Unable to send the password reset email."
            : "Không thể gửi email đổi mật khẩu.",
      )
    } finally {
      setIsSendingReset(false)
    }
  }

  const handleResetTraineeData = async () => {
    if (!session?.access_token) {
      setError(locale === "en" ? "You are not signed in." : "Bạn chưa đăng nhập.")
      setSuccess(null)
      return
    }

    if (resetConfirmation.trim().toUpperCase() !== messages.profile.resetDataConfirmationWord.toUpperCase()) {
      setError(messages.profile.resetDataConfirmationMismatch)
      setSuccess(null)
      return
    }

    setError(null)
    setSuccess(null)
    setIsResettingData(true)

    try {
      await resetCurrentTraineeDataRequest(session.access_token)
      setLatestWeightKg(null)
      setCurrentWeight("")
      setResetConfirmation("")
      setSuccess(messages.profile.resetDataSuccess)
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : messages.profile.resetDataFailed)
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">{messages.profile.title}</h1>
        <p className="mt-1 text-muted-foreground">{messages.profile.subtitle}</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
          {success}
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{messages.profile.profile}</h2>
        </div>

        <div className="mb-6 flex flex-col items-center gap-3">
          <input
            ref={avatarInputRef}
            id="avatar-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleAvatarUpload}
            disabled={isUploadingAvatar}
          />

          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={profile.avatar || "/placeholder.svg"} alt={profile.name} />
              <AvatarFallback className="bg-primary/10 text-2xl text-primary">{initials || "YB"}</AvatarFallback>
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

          <div className="text-center">
            <p className="text-sm font-medium">{messages.profile.changeAvatar}</p>
            <p className="text-xs text-muted-foreground">
              {isUploadingAvatar ? messages.profile.avatarUploading : messages.profile.avatarRequirements}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">{messages.profile.fullName}</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{messages.profile.phone}</Label>
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
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">{messages.profile.email}</Label>
            <Input id="email" type="email" value={profile.email} disabled className="cursor-not-allowed opacity-80" />
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{messages.profile.preferences}</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="weight-unit">{messages.profile.weightUnit}</Label>
            <Select value={preferredWeightUnit} onValueChange={(value: "kg" | "lbs") => setPreferredWeightUnit(value)}>
              <SelectTrigger id="weight-unit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                <SelectItem value="kg">{messages.profile.weightUnitKg}</SelectItem>
                <SelectItem value="lbs">{messages.profile.weightUnitLbs}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{messages.profile.weightUnitCopy}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="height-cm">{messages.profile.height} (cm)</Label>
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
            />
            <p className="text-sm text-muted-foreground">{messages.profile.heightCopy}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-weight">
              {messages.profile.targetWeight} ({preferredWeightUnit})
            </Label>
            <div className="relative">
              <Scale className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
            <p className="text-sm text-muted-foreground">{messages.profile.targetWeightCopy}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="current-weight">
              {messages.profile.currentWeight} ({preferredWeightUnit})
            </Label>
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
            <p className="text-sm text-muted-foreground">{messages.profile.currentWeightCopy}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="daily-calorie-goal">{messages.profile.dailyCalorieGoal}</Label>
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
            <p className="text-sm text-muted-foreground">{messages.profile.dailyCalorieGoalCopy}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{messages.profile.fitnessGoals}</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableGoals.map((goal) => {
            const isSelected = selectedGoals.includes(goal)

            return (
              <button
                key={goal}
                type="button"
                onClick={() => toggleGoal(goal)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {goal}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{messages.profile.notifications}</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{messages.profile.pushNotifications}</p>
              <p className="text-sm text-muted-foreground">{messages.profile.pushNotificationsCopy}</p>
            </div>
            <Switch checked={notifications} onCheckedChange={setNotifications} />
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{messages.profile.security}</h2>
        </div>

        <Button
          variant="outline"
          className="w-full bg-transparent"
          onClick={() => void handlePasswordReset()}
          disabled={isSendingReset}
        >
          {isSendingReset ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {messages.common.sendingEmail}
            </>
          ) : (
            messages.common.sendResetEmail
          )}
        </Button>
      </div>

      {profile.role === "trainee" ? (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="mb-4 flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{messages.profile.resetData}</h2>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">{messages.profile.resetDataCopy}</p>

          <div className="space-y-2">
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
              className="max-w-xs border-destructive/20 bg-background"
            />
            <p className="text-sm text-muted-foreground">{messages.profile.resetDataConfirmationHint}</p>
          </div>

          <Button
            variant="destructive"
            className="mt-4 w-full md:w-auto"
            onClick={() => void handleResetTraineeData()}
            disabled={isResettingData || !isResetConfirmationValid}
          >
            {isResettingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {isResettingData ? messages.profile.resetDataInProgress : messages.profile.resetDataAction}
          </Button>
        </div>
      ) : null}

      <Button
        className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => void handleSave()}
        disabled={isSaving || isResettingData}
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {isSaving ? messages.common.saving : messages.common.saveChanges}
      </Button>
    </div>
  )
}
