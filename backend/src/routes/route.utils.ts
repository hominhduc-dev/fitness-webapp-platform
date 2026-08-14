import type { Request, Response } from "express"

import { logger } from "../lib/logger"
import { GENERIC_ERROR_MESSAGE } from "../middleware/error-handler"
import { AppError, UnauthorizedError } from "../services/errors"

function getAccessToken(req: Request) {
  const header = req.headers.authorization

  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Thiếu access token trong header Authorization.", { code: "MISSING_ACCESS_TOKEN" })
  }

  return header.replace(/^Bearer\s+/i, "").trim()
}

function sendData(res: Response, data: unknown, options?: { meta?: unknown; status?: number }) {
  return res.status(options?.status ?? 200).json({
    data,
    error: null,
    meta: options?.meta ?? null,
  })
}

/**
 * Formats an error the same way `errorHandler` does.
 *
 * Prefer letting the error reach the central handler (throw inside `asyncHandler`
 * or `validated`); this helper exists for the routes that still catch locally.
 */
function sendApiError(res: Response, error: unknown) {
  const appError = error instanceof AppError ? error : undefined
  const status = appError?.status ?? 500

  if (status >= 500) {
    logger.error("request failed", { error, status })
  }

  return res.status(status).json({
    data: null,
    error: {
      code: appError?.code ?? "INTERNAL_ERROR",
      message: appError?.expose ? appError.message : GENERIC_ERROR_MESSAGE,
      ...(appError?.expose && appError.details !== undefined ? { details: appError.details } : {}),
    },
    meta: null,
  })
}

/** Legacy flat `{ error }` shape kept for the auth endpoints that predate the envelope. */
function sendError(res: Response, error: unknown) {
  const appError = error instanceof AppError ? error : undefined
  const status = appError?.status ?? 500

  if (status >= 500) {
    logger.error("request failed", { error, status })
  }

  return res.status(status).json({
    error: appError?.expose ? appError.message : GENERIC_ERROR_MESSAGE,
  })
}

export { getAccessToken, sendApiError, sendData, sendError }
