const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60_000

function getAIRequestTimeoutMs() {
  const timeout = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? "", 10)
  return Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_AI_REQUEST_TIMEOUT_MS
}

async function withAIRequestTimeout<T>(request: Promise<T>, timeoutMs = getAIRequestTimeoutMs()): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`AI request timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([request, timeout])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

export { getAIRequestTimeoutMs, withAIRequestTimeout }
