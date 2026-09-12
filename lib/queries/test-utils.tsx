import type { ReactElement, ReactNode } from "react"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"

/**
 * A throwaway client per test: retries off so a rejected query fails fast
 * instead of burning the test timeout, and no shared cache between tests.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & { queryClient?: QueryClient },
) {
  const queryClient = options?.queryClient ?? createTestQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}
