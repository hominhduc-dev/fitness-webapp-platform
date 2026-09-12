"use client"

import type { ReactNode } from "react"

import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

import { getQueryClient } from "@/lib/queries/client"

const showDevtools = process.env.NODE_ENV === "development"

export function QueryProvider({ children }: { children: ReactNode }) {
  // Not `useState(() => new QueryClient())`: see the comment on getQueryClient.
  // The client must outlive this component so the cache survives navigating
  // between sibling route groups.
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {showDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  )
}
