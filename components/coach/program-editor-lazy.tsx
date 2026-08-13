"use client"

import dynamic from "next/dynamic"
import { createPortal } from "react-dom"

import type { CoachProgram, CoachTrainee } from "@/lib/fitness/types"
import type { ExerciseVariationOption } from "@/lib/types"

type ProgramEditorLazyProps = {
  initialExerciseOptions?: ExerciseVariationOption[]
  initialTraineeOptions?: CoachTrainee[]
  onClose?: () => void
  onSaved?: (program: CoachProgram) => void
  programId?: string
}

const ProgramEditor = dynamic(
  () => import("@/components/coach/program-editor").then((mod) => mod.ProgramEditor),
  {
    loading: () => <div className="min-h-[24rem] rounded-[10px] border border-border bg-card" />,
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
