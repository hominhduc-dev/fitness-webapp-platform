"use client"

import { useParams } from "next/navigation"

import { ProgramEditor } from "@/components/coach/program-editor"

export default function ProgramDetailPage() {
  const params = useParams()
  const programId = Array.isArray(params.id) ? params.id[0] : params.id

  return <ProgramEditor programId={programId} />
}
