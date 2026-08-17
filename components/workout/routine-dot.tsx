import { TAG_DOT_COLOR, type RoutineTag } from "@/lib/fitness/routine-tag"

export function RoutineDot({ tag }: { tag: Exclude<RoutineTag, "all"> }) {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TAG_DOT_COLOR[tag] }} />
}
