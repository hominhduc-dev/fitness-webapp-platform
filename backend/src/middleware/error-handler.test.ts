import express from "express"
import request from "supertest"
import { describe, expect, it } from "vitest"

import { errorHandler, GENERIC_ERROR_MESSAGE, notFoundHandler } from "./error-handler"
import { AppError, AuthServiceError, ExternalServiceError, NotFoundError, ValidationError } from "../services/errors"

/**
 * Builds a throwaway app carrying only the middleware under test, so these assert
 * the HTTP contract without booting the service graph (Prisma, Supabase, providers).
 */
function buildApp(throwing: () => never) {
  const app = express()

  app.get("/boom", (_req, _res, next) => {
    try {
      throwing()
    } catch (error) {
      next(error)
    }
  })

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

describe("errorHandler", () => {
  it("maps an AppError to its status and the { data, error, meta } envelope", async () => {
    const response = await request(buildApp(() => {
      throw new NotFoundError("Không tìm thấy buổi tập.")
    })).get("/boom")

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      data: null,
      error: { code: "NOT_FOUND", message: "Không tìm thấy buổi tập." },
      meta: null,
    })
  })

  it("includes details for exposed errors", async () => {
    const response = await request(buildApp(() => {
      throw new ValidationError("Dữ liệu gửi lên không hợp lệ.", {
        details: [{ message: "Bắt buộc", path: "body.message" }],
      })
    })).get("/boom")

    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe("VALIDATION_FAILED")
    expect(response.body.error.details).toEqual([{ message: "Bắt buộc", path: "body.message" }])
  })

  it("never leaks a 5xx message or its details to the client", async () => {
    const response = await request(buildApp(() => {
      throw new ExternalServiceError("anthropic 500: api_key sk-ant-xxx rejected", {
        details: { endpoint: "https://api.anthropic.com/v1/messages" },
      })
    })).get("/boom")

    expect(response.status).toBe(502)
    expect(response.body.error.message).toBe(GENERIC_ERROR_MESSAGE)
    expect(response.body.error).not.toHaveProperty("details")
    expect(JSON.stringify(response.body)).not.toContain("sk-ant")
  })

  it("treats an unknown error as an opaque 500", async () => {
    const response = await request(buildApp(() => {
      throw new Error("ECONNREFUSED 10.0.0.5:5432")
    })).get("/boom")

    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      data: null,
      error: { code: "INTERNAL_ERROR", message: GENERIC_ERROR_MESSAGE },
      meta: null,
    })
  })

  it("formats a legacy AuthServiceError the same way", async () => {
    const response = await request(buildApp(() => {
      throw new AuthServiceError("Thiếu access token trong header Authorization.", 401)
    })).get("/boom")

    expect(response.status).toBe(401)
    expect(response.body.error).toEqual({
      code: "UNAUTHORIZED",
      message: "Thiếu access token trong header Authorization.",
    })
  })

  it("honours a custom code", async () => {
    const response = await request(buildApp(() => {
      throw new AppError("Tính năng AI chưa được cấu hình.", { code: "AI_NOT_CONFIGURED", status: 503 })
    })).get("/boom")

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe("AI_NOT_CONFIGURED")
  })
})

describe("notFoundHandler", () => {
  it("answers unmatched routes with a 404 envelope", async () => {
    const response = await request(buildApp(() => {
      throw new Error("unreachable")
    })).get("/no-such-route")

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND")
    expect(response.body.error.message).toContain("/no-such-route")
  })
})
