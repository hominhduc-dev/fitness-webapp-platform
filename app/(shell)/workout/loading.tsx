import { RoutinesLoadingState } from "@/components/workout/routines-loading-state"

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 overflow-x-hidden px-4 pb-6 pt-page md:px-6">
      <RoutinesLoadingState />
    </main>
  )
}
