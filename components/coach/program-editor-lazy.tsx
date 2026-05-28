"use client"

import dynamic from "next/dynamic"

import type { CoachTrainee } from "@/lib/fitness/types"
import type { ExerciseVariationOption } from "@/lib/types"

type ProgramEditorLazyProps = {
  initialExerciseOptions?: ExerciseVariationOption[]
  initialTraineeOptions?: CoachTrainee[]
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
  return <ProgramEditor {...props} />
}
