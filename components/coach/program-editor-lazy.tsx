"use client"

import dynamic from "next/dynamic"
import { createPortal } from "react-dom"

import type { AIProgramDraft } from "@/components/coach/coach-ai-program-assistant"
import type { CoachProgram, CoachTrainee } from "@/lib/fitness/types"
import type { ExerciseVariationOption } from "@/lib/types"

type ProgramEditorLazyProps = {
  initialAIDraft?: AIProgramDraft
  initialExerciseOptions?: ExerciseVariationOption[]
  initialTraineeOptions?: CoachTrainee[]
  onClose?: () => void
  onGenerateWithAI?: (traineeId: string | null) => void
  onImportProgram?: () => void
  onSaved?: (program: CoachProgram) => void
  programId?: string
}

const ProgramEditor = dynamic(
  () => import("@/components/coach/program-editor").then((mod) => mod.ProgramEditor),
  {
    loading: () => <div className="min-h-[24rem] rounded-lg border border-border bg-card" />,
    ssr: false,
  },
)

export function ProgramEditorLazy(props: ProgramEditorLazyProps) {
  const editor = <ProgramEditor {...props} />

  if (props.onClose && typeof document !== "undefined") {
    return createPortal(editor, document.body)
  }

  return editor
}
