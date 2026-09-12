import { ProgramEditorLazy } from "@/components/coach/program-editor-lazy"

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return <ProgramEditorLazy programId={id} />
}
