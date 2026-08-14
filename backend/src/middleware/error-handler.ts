import type { NextFunction, Request, Response } from "express"

import { logger } from "../lib/logger"
import { AppError, NotFoundError } from "../services/errors"

/** Message sent instead of an unexpected error's own text, which may leak internals. */
const GENERIC_ERROR_MESSAGE = "Đã có lỗi xảy ra. Vui lòng thử lại."

function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new NotFoundError(`Không tìm thấy endpoint ${req.method} ${req.path}.`, { code: "ROUTE_NOT_FOUND" }))
}

/**
 * Terminal error middleware. Every route delegates here instead of formatting its
 * own 500, so the `{ data, error, meta }` envelope and the log record stay in sync.
 */
function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction) {
  // Express cannot rewrite headers once streaming has begun; hand it back so the
  // default handler destroys the socket.
  if (res.headersSent) {
    next(error)
    return
  }

  const appError = error instanceof AppError ? error : undefined
  const status = appError?.status ?? 500

  if (status >= 500) {
    logger.error("request failed", { error, method: req.method, path: req.originalUrl, status })
  } else {
    logger.warn("request rejected", {
      code: appError?.code,
      method: req.method,
      path: req.originalUrl,
      reason: appError?.message,
      status,
    })
  }

  res.status(status).json({
    data: null,
    error: {
      code: appError?.code ?? "INTERNAL_ERROR",
      message: appError?.expose ? appError.message : GENERIC_ERROR_MESSAGE,
      ...(appError?.expose && appError.details !== undefined ? { details: appError.details } : {}),
    },
    meta: null,
  })
}

export { errorHandler, GENERIC_ERROR_MESSAGE, notFoundHandler }
