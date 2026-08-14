type AppErrorOptions = {
  cause?: unknown
  /** Stable machine-readable identifier, e.g. `NOT_FOUND`. Sent to the client. */
  code?: string
  /** Extra structured context (field-level validation issues, ids, …). */
  details?: unknown
  status?: number
}

const DEFAULT_CODE_BY_STATUS: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_ERROR",
  502: "UPSTREAM_ERROR",
  503: "SERVICE_UNAVAILABLE",
}

/**
 * Base class for every error the API deliberately produces.
 *
 * `expose` decides whether `message` reaches the client. 4xx messages are written
 * for end users (they are localized Vietnamese copy in most services), while 5xx
 * messages can leak connection strings or upstream payloads and are replaced with
 * a generic string by the error middleware.
 */
class AppError extends Error {
  readonly code: string
  readonly details?: unknown
  readonly expose: boolean
  readonly status: number

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })

    this.name = new.target.name
    this.status = options.status ?? 500
    this.code = options.code ?? DEFAULT_CODE_BY_STATUS[this.status] ?? "INTERNAL_ERROR"
    this.details = options.details
    this.expose = this.status < 500

    Error.captureStackTrace?.(this, new.target)
  }
}

class BadRequestError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { ...options, status: 400 })
  }
}

class UnauthorizedError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { ...options, status: 401 })
  }
}

class ForbiddenError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { ...options, status: 403 })
  }
}

class NotFoundError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { ...options, status: 404 })
  }
}

class ConflictError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { ...options, status: 409 })
  }
}

class ValidationError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { code: "VALIDATION_FAILED", ...options, status: 422 })
  }
}

class TooManyRequestsError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { ...options, status: 429 })
  }
}

/** A dependency we do not control (Supabase, Anthropic/OpenAI, USDA) failed. */
class ExternalServiceError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { ...options, status: 502 })
  }
}

/**
 * Historical error type used by ~226 throw sites across the services. It predates
 * AppError and carries `(message, status)` positionally; keeping it as a subclass
 * means every existing `instanceof AuthServiceError` check and every `throw` keeps
 * working while new code can use the specific classes above.
 */
class AuthServiceError extends AppError {
  constructor(message: string, status = 400, options: Omit<AppErrorOptions, "status"> = {}) {
    super(message, { ...options, status })
    this.name = "AuthServiceError"
  }
}

export {
  AppError,
  AuthServiceError,
  BadRequestError,
  ConflictError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
}
export type { AppErrorOptions }
