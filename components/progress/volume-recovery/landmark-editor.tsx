"use client"

import { useState } from "react"
import { X } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { BottomSheet, BottomSheetBody, BottomSheetFooter, BottomSheetHeader } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { VolumeRecoveryMuscle } from "@/lib/fitness/types"
import { useResetVolumeLandmarks, useSaveVolumeLandmarks } from "@/lib/queries/progress"

type Field = "mavMaxSets" | "mavMinSets" | "mevSets" | "mrvSets"

const FIELD_ORDER: Field[] = ["mevSets", "mavMinSets", "mavMaxSets", "mrvSets"]

export function LandmarkEditor({
  muscle,
  muscleName,
  onClose,
  open,
}: {
  muscle: VolumeRecoveryMuscle
  muscleName: string
  onClose: () => void
  open: boolean
}) {
  const { messages } = useLocale()
  const copy = messages.volumeRecovery
  const save = useSaveVolumeLandmarks()
  const reset = useResetVolumeLandmarks()
  const [values, setValues] = useState<Record<Field, string>>({
    mavMaxSets: String(muscle.landmarks.mavMaxSets),
    mavMinSets: String(muscle.landmarks.mavMinSets),
    mevSets: String(muscle.landmarks.mevSets),
    mrvSets: String(muscle.landmarks.mrvSets),
  })

  if (!open) return null

  const parsed = FIELD_ORDER.map((field) => Number(values[field]))
  // Each landmark has to be at least the one before it, which is also what the
  // database CHECK enforces — catching it here keeps the error in the form.
  const isValid = parsed.every((value) => Number.isFinite(value) && value >= 0 && value <= 60)
    && parsed.every((value, index) => index === 0 || parsed[index - 1] <= value)

  const label: Record<Field, string> = {
    mavMaxSets: copy.mavMax,
    mavMinSets: copy.mavMin,
    mevSets: copy.mev,
    mrvSets: copy.mrv,
  }

  async function submit() {
    if (!isValid) return
    try {
      await save.mutateAsync({
        mavMaxSets: Number(values.mavMaxSets),
        mavMinSets: Number(values.mavMinSets),
        mevSets: Number(values.mevSets),
        mrvSets: Number(values.mrvSets),
        muscleSlug: muscle.muscleSlug,
      })
      onClose()
    } catch {
      // The mutation surfaces its error below the fields.
    }
  }

  async function restoreDefaults() {
    try {
      await reset.mutateAsync(muscle.muscleSlug)
      onClose()
    } catch {
      // As above.
    }
  }

  const error = save.error ?? reset.error

  return (
    <BottomSheet ariaLabel={copy.landmarksTitle} onClose={onClose} variant="flush">
      <BottomSheetHeader>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{copy.landmarksTitle} · {muscleName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.landmarksDescription}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label={messages.common.closeNavigation}
        >
          <X className="size-4" />
        </button>
      </BottomSheetHeader>

      <BottomSheetBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {FIELD_ORDER.map((field) => (
            <label key={field} className="space-y-1.5" htmlFor={`landmark-${field}`}>
              <span className="text-xs text-muted-foreground">{label[field]}</span>
              <Input
                id={`landmark-${field}`}
                type="number"
                inputMode="numeric"
                min="0"
                max="60"
                step="1"
                value={values[field]}
                onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                className="h-11 bg-background font-mono tnum"
              />
            </label>
          ))}
        </div>

        {!isValid ? <p className="text-xs text-destructive-text">{copy.landmarksDescription}</p> : null}
        {error ? <p className="text-sm text-destructive-text">{error.message || copy.saveError}</p> : null}

        <button
          type="button"
          onClick={() => void restoreDefaults()}
          disabled={reset.isPending || muscle.landmarks.source === "system"}
          className="text-sm font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
        >
          {copy.resetLandmarks}
        </button>
      </BottomSheetBody>

      <BottomSheetFooter>
        <Button type="button" variant="outline" onClick={onClose}>{copy.cancel}</Button>
        <Button type="button" disabled={!isValid || save.isPending} onClick={() => void submit()}>
          {save.isPending ? copy.saving : copy.save}
        </Button>
      </BottomSheetFooter>
    </BottomSheet>
  )
}
