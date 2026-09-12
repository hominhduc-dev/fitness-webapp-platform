import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6" aria-busy="true">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-64 rounded-full" />
      </div>
      <Skeleton className="mb-7 h-48 rounded-xl" />
      <Skeleton className="mb-3 h-3 w-24" />
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-[130px] rounded-lg" />)}
      </div>
    </section>
  )
}
