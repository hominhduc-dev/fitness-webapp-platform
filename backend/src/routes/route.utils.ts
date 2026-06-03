import type { Request, Response } from "express"

import { AuthServiceError } from "../services/auth.service"

function getAccessToken(req: Request) {
  const header = req.headers.authorization

  if (!header?.startsWith("Bearer ")) {
    throw new AuthServiceError("Thiếu access token trong header Authorization.", 401)
  }

  return header.replace(/^Bearer\s+/i, "").trim()
}

function sendError(res: Response, error: unknown) {
  if (error instanceof AuthServiceError) {
    return res.status(error.status).json({
      error: error.message,
    })
  }

  console.error(error)

  return res.status(500).json({
    error: "Internal Server Error",
  })
}

function sendData(res: Response, data: unknown, options?: { meta?: unknown; status?: number }) {
  return res.status(options?.status ?? 200).json({
    data,
    error: null,
    meta: options?.meta ?? null,
  })
}

function sendApiError(res: Response, error: unknown) {
  if (error instanceof AuthServiceError) {
    return res.status(error.status).json({
      data: null,
      error: {
        message: error.message,
      },
      meta: null,
    })
  }

  console.error(error)

  return res.status(500).json({
    data: null,
    error: {
      message: "Internal Server Error",
    },
    meta: null,
  })
}

export { getAccessToken, sendApiError, sendData, sendError }
