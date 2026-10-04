import { ProgramEditorLazy } from "@/components/coach/program-editor-lazy"

export default async function ProgramDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ adjustTrainee?: string | string[] }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const traineeId = Array.isArray(query.adjustTrainee) ? query.adjustTrainee[0] : query.adjustTrainee

  return <ProgramEditorLazy programId={id} closeHref={traineeId ? `/coach/trainees/${encodeURIComponent(traineeId)}` : undefined} />
}
