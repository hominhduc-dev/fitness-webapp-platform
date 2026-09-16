"use client"

import type { ReactNode } from "react"

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

import { getQueryClient } from "@/lib/queries/client"
import {
  PERSISTED_QUERY_BUSTER,
  PERSISTED_QUERY_MAX_AGE_MS,
  getQueryPersister,
  shouldPersistQuery,
} from "@/lib/queries/persist"

const showDevtools = process.env.NEXT_PUBLIC_ENABLE_QUERY_DEVTOOLS === "true"

const persistOptions = {
  buster: PERSISTED_QUERY_BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  maxAge: PERSISTED_QUERY_MAX_AGE_MS,
  persister: getQueryPersister(),
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Not `useState(() => new QueryClient())`: see the comment on getQueryClient.
  // The client must outlive this component so the cache survives navigating
  // between sibling route groups.
  const queryClient = getQueryClient()

  // Restoring only fills gaps: hydration never overwrites a query that already
  // holds newer data, so remounting under another route group is harmless.
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
      {showDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </PersistQueryClientProvider>
  )
}
