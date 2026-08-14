import { AsyncLocalStorage } from "node:async_hooks"

import { env } from "../config/env"

type LogLevel = "debug" | "info" | "warn" | "error"

type LogFields = Record<string, unknown>

type RequestContext = {
  method: string
  path: string
  requestId: string
  userId?: string
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  error: 40,
  info: 20,
  warn: 30,
}

const requestContextStore = new AsyncLocalStorage<RequestContext>()

function getRequestContext() {
  return requestContextStore.getStore()
}

/**
 * Runs `callback` with a request context attached, so every log line emitted
 * anywhere down the call stack carries the request id without threading it
 * through service signatures.
 */
function withRequestContext<T>(context: RequestContext, callback: () => T) {
  return requestContextStore.run(context, callback)
}

/** Adds fields to the in-flight request context (e.g. the user id, once authenticated). */
function enrichRequestContext(fields: Partial<RequestContext>) {
  const context = requestContextStore.getStore()

  if (context) {
    Object.assign(context, fields)
  }
}

type SerializedError = {
  cause?: SerializedError
  message: string
  name?: string
  stack?: string
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      ...(error.cause ? { cause: serializeError(error.cause) } : {}),
    }
  }

  return { message: String(error) }
}

function shouldLog(level: LogLevel) {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[env.logLevel]
}

function emit(level: LogLevel, message: string, fields: LogFields = {}) {
  if (!shouldLog(level)) {
    return
  }

  const context = getRequestContext()
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...(context ? { method: context.method, path: context.path, requestId: context.requestId, userId: context.userId } : {}),
    ...(fields.error ? { ...fields, error: serializeError(fields.error) } : fields),
  }

  // Production ships single-line JSON for log aggregators; local dev stays readable.
  const line = env.isProduction ? JSON.stringify(payload) : formatForHumans(payload)

  if (level === "error") {
    console.error(line)
    return
  }

  if (level === "warn") {
    console.warn(line)
    return
  }

  console.log(line)
}

function formatForHumans(payload: Record<string, unknown>) {
  const { level, message, method, path, requestId, time, ...rest } = payload
  const head = `${String(time).slice(11, 23)} ${String(level).toUpperCase().padEnd(5)}`
  const route = method && path ? ` ${method} ${path}` : ""
  const trace = requestId ? ` [${String(requestId).slice(0, 8)}]` : ""
  const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ""

  return `${head}${trace}${route} ${message}${extras}`
}

const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
}

export { enrichRequestContext, getRequestContext, logger, withRequestContext }
export type { LogLevel, RequestContext }
