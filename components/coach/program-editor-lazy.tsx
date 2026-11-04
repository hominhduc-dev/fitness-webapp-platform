"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { createPortal } from "react-dom"

import type { CoachProgram, CoachTrainee } from "@/lib/fitness/types"
import type { ExerciseVariationOption } from "@/lib/types"

import type { ProgramImportSource } from "./import-program-menu"

type ProgramEditorLazyProps = {
  closeHref?: string
  initialExerciseOptions?: ExerciseVariationOption[]
  initialTraineeOptions?: CoachTrainee[]
  onClose?: () => void
  onGenerateWithAI?: (traineeId: string | null) => void
  onImportProgram?: (source: ProgramImportSource) => void
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

export function ProgramEditorLazy({ closeHref, ...props }: ProgramEditorLazyProps) {
  const router = useRouter()
  const onClose = props.onClose ?? (closeHref ? () => router.push(closeHref) : undefined)
  const editor = <ProgramEditor {...props} onClose={onClose} />

  if (onClose && typeof document !== "undefined") {
    return createPortal(editor, document.body)
  }

  return editor
}
