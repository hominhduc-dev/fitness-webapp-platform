import { randomUUID } from "node:crypto"

import type { NextFunction, Request, Response } from "express"

import { logger, withRequestContext } from "../lib/logger"

const REQUEST_ID_HEADER = "x-request-id"

/** Only accept an inbound id that looks like one — it ends up in every log line. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,128}$/

function resolveRequestId(req: Request) {
  const inbound = req.header(REQUEST_ID_HEADER)
  return inbound && SAFE_REQUEST_ID.test(inbound) ? inbound : randomUUID()
}

/**
 * Assigns a request id, echoes it back on the response, and runs the rest of the
 * request inside an AsyncLocalStorage scope so service-level logs can be traced
 * back to the HTTP call without passing an id through every function signature.
 */
function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = resolveRequestId(req)
  const startedAt = process.hrtime.bigint()

  res.setHeader(REQUEST_ID_HEADER, requestId)

  // Registered outside the ALS scope on purpose: 'finish' fires from the socket's
  // async context, so the store would not be visible here. The fields are explicit.
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"

    logger[level]("request completed", {
      durationMs: Math.round(durationMs),
      method: req.method,
      path: req.originalUrl,
      requestId,
      status: res.statusCode,
    })
  })

  withRequestContext({ method: req.method, path: req.originalUrl, requestId }, next)
}

export { REQUEST_ID_HEADER, requestContext }
