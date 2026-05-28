"use client"

import dynamic from "next/dynamic"

const WeightTrackingClient = dynamic(
  () => import("@/components/progress/weight-tracking-client").then((mod) => mod.WeightTrackingClient),
  {
    loading: () => <div className="min-h-[20rem] rounded-[10px] border border-border bg-card" />,
    ssr: false,
  },
)

export function WeightTrackingLazy() {
  return <WeightTrackingClient />
}
