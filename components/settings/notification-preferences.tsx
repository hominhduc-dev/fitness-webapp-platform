"use client"

import { useId, useState, type ReactNode } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useToast } from "@/components/providers/toast-provider"
import { FilterChip } from "@/components/ui/filter-chip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import type { NotificationMealType, NotificationPreferencesInput } from "@/lib/fitness/types"
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/lib/queries/notifications"

/** Monday-first, matching the schedule; values are JS weekdays (0 = Sunday). */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const CLOCK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const MEAL_ORDER: NotificationMealType[] = ["breakfast", "lunch", "snack", "dinner"]
const WORKOUT_REMINDER_OFFSETS = [15, 30, 60]

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-0">
      {children}
    </p>
  )
}

function PreferenceRow({
  checked,
  children,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean
  children?: ReactNode
  description?: string
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  const id = useId()

  return (
    <div className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-semibold leading-5 text-foreground">
            {label}
          </Label>
          {description ? <p className="mt-0.5 text-xs leading-4 text-muted-foreground sm:text-sm sm:leading-5">{description}</p> : null}
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {checked && children ? <div className="flex flex-col gap-2">{children}</div> : null}
    </div>
  )
}

/**
 * Saves on blur so typing "0", "07", "07:3" does not send a request per keystroke.
 * Callers key it by `value`, so a saved or reverted value resets the draft.
 */
function ReminderTimeField({
  label,
  onCommit,
  value,
}: {
  label: string
  onCommit: (value: string) => void
  value: string
}) {
  const id = useId()
  const [draft, setDraft] = useState(value)

  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-xs text-muted-foreground sm:text-sm">
        {label}
      </Label>
      <Input
        id={id}
        type="time"
        value={draft}
        className="h-9 w-28 sm:w-32"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (CLOCK_TIME_PATTERN.test(draft) && draft !== value) {
            onCommit(draft)
          } else {
            setDraft(value)
          }
        }}
      />
    </div>
  )
}

function ChipGroup({
  label,
  onSelect,
  options,
  selected,
}: {
  label: string
  onSelect: (value: number) => void
  options: Array<{ label: string; value: number }>
  selected: (value: number) => boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((option) => (
          <FilterChip
            key={option.value}
            active={selected(option.value)}
            aria-pressed={selected(option.value)}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </FilterChip>
        ))}
      </div>
    </div>
  )
}

export function NotificationPreferencesSettings({ role }: { role: "coach" | "trainee" }) {
  const { locale, messages } = useLocale()
  const copy = messages.profile.notificationSettings
  const mealLabels = messages.notificationCenter.mealLabels
  const { toast } = useToast()
  const query = useNotificationPreferences()
  const update = useUpdateNotificationPreferences()
  const preferences = query.data

  const save = (input: NotificationPreferencesInput) => {
    update.mutate(input, {
      onError: (error) => {
        toast({ title: error instanceof Error ? error.message : copy.saveError, tone: "error" })
      },
    })
  }

  if (query.isError) {
    return <p className="text-sm text-destructive-text">{copy.loadError}</p>
  }

  if (!preferences) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "short" })
  // 2026-09-20 is a Sunday, so day d is 20 + d.
  const weekdayOptions = WEEKDAY_ORDER.map((day) => ({
    label: weekdayFormatter.format(new Date(Date.UTC(2026, 8, 20 + day, 12))),
    value: day,
  }))
  const selectedWeightDays = new Set(preferences.weightReminder.days)

  const toggleWeightDay = (day: number) => {
    const next = new Set(selectedWeightDays)
    if (next.has(day)) {
      next.delete(day)
    } else {
      next.add(day)
    }

    // An empty selection would silently never fire; keep at least one day.
    if (next.size === 0) return
    save({ weightReminder: { days: Array.from(next).sort((left, right) => left - right) } })
  }

  const timeZoneNote = <p className="pt-4 text-xs text-muted-foreground">{copy.timeZoneNote(preferences.timeZone)}</p>

  if (role === "coach") {
    return (
      <div className="flex flex-col">
        <SectionHeading>{copy.coachHeading}</SectionHeading>
        <PreferenceRow
          checked={preferences.coachWeeklyReview.enabled}
          description={copy.coachWeeklyReviewCopy}
          label={copy.coachWeeklyReview}
          onCheckedChange={(checked) => save({ coachWeeklyReview: { enabled: checked } })}
        >
          <ChipGroup
            label={copy.reviewDay}
            options={weekdayOptions}
            selected={(day) => preferences.coachWeeklyReview.day === day}
            onSelect={(day) => save({ coachWeeklyReview: { day } })}
          />
          <ReminderTimeField
            key={preferences.coachWeeklyReview.time}
            label={copy.reminderTime}
            value={preferences.coachWeeklyReview.time}
            onCommit={(time) => save({ coachWeeklyReview: { time } })}
          />
        </PreferenceRow>
        {timeZoneNote}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <SectionHeading>{copy.eventsHeading}</SectionHeading>
      <div className="divide-y divide-border/70">
        <PreferenceRow
          checked={preferences.coachProgramUpdates}
          description={copy.coachProgramUpdatesCopy}
          label={copy.coachProgramUpdates}
          onCheckedChange={(checked) => save({ coachProgramUpdates: checked })}
        />
        <PreferenceRow
          checked={preferences.workoutSessionReminders}
          description={copy.workoutSessionRemindersCopy}
          label={copy.workoutSessionReminders}
          onCheckedChange={(checked) => save({ workoutSessionReminders: checked })}
        />
      </div>

      <SectionHeading>{copy.remindersHeading}</SectionHeading>
      <div className="divide-y divide-border/70">
        <PreferenceRow
          checked={preferences.workoutReminder.enabled}
          description={copy.workoutReminderCopy}
          label={copy.workoutReminder}
          onCheckedChange={(checked) => save({ workoutReminder: { enabled: checked } })}
        >
          <ReminderTimeField
            key={preferences.workoutReminder.time}
            label={copy.workoutTime}
            value={preferences.workoutReminder.time}
            onCommit={(time) => save({ workoutReminder: { time } })}
          />
          <ChipGroup
            label={copy.reminderOffset}
            options={WORKOUT_REMINDER_OFFSETS.map((minutes) => ({ label: copy.offsetMinutes(minutes), value: minutes }))}
            selected={(minutes) => preferences.workoutReminder.offsetMinutes === minutes}
            onSelect={(offsetMinutes) => save({ workoutReminder: { offsetMinutes } })}
          />
        </PreferenceRow>
        <PreferenceRow
          checked={preferences.weightReminder.enabled}
          description={copy.weightReminderCopy}
          label={copy.weightReminder}
          onCheckedChange={(checked) => save({ weightReminder: { enabled: checked } })}
        >
          <ReminderTimeField
            key={preferences.weightReminder.time}
            label={copy.reminderTime}
            value={preferences.weightReminder.time}
            onCommit={(time) => save({ weightReminder: { time } })}
          />
          <ChipGroup
            label={copy.reminderDays}
            options={weekdayOptions}
            selected={(day) => selectedWeightDays.has(day)}
            onSelect={toggleWeightDay}
          />
        </PreferenceRow>
        <PreferenceRow
          checked={preferences.dailyCheckIn.enabled}
          description={copy.dailyCheckInCopy}
          label={copy.dailyCheckIn}
          onCheckedChange={(checked) => save({ dailyCheckIn: { enabled: checked } })}
        >
          <ReminderTimeField
            key={preferences.dailyCheckIn.time}
            label={copy.reminderTime}
            value={preferences.dailyCheckIn.time}
            onCommit={(time) => save({ dailyCheckIn: { time } })}
          />
        </PreferenceRow>
      </div>

      <SectionHeading>{copy.mealsHeading}</SectionHeading>
      <p className="-mt-1 pb-1.5 text-xs leading-4 text-muted-foreground sm:text-sm sm:leading-5">{copy.mealRemindersCopy}</p>
      <div className="divide-y divide-border/70">
        {MEAL_ORDER.map((meal) => (
          <PreferenceRow
            key={meal}
            checked={preferences.mealReminders[meal].enabled}
            label={mealLabels[meal]}
            onCheckedChange={(checked) => save({ mealReminders: { [meal]: { enabled: checked } } })}
          >
            <ReminderTimeField
              key={preferences.mealReminders[meal].time}
              label={copy.reminderTime}
              value={preferences.mealReminders[meal].time}
              onCommit={(time) => save({ mealReminders: { [meal]: { time } } })}
            />
          </PreferenceRow>
        ))}
      </div>

      {timeZoneNote}
    </div>
  )
}
