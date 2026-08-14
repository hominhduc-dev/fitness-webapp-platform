import { describe, expect, it } from "vitest"

import {
  AppError,
  AuthServiceError,
  BadRequestError,
  ExternalServiceError,
  NotFoundError,
  ValidationError,
} from "./errors"

describe("AppError", () => {
  it("defaults to a 500 with a generic code", () => {
    const error = new AppError("boom")

    expect(error.status).toBe(500)
    expect(error.code).toBe("INTERNAL_ERROR")
  })

  it("derives a code from the status when none is given", () => {
    expect(new AppError("nope", { status: 404 }).code).toBe("NOT_FOUND")
    expect(new AppError("nope", { status: 409 }).code).toBe("CONFLICT")
  })

  it("prefers an explicit code over the status-derived one", () => {
    expect(new AppError("nope", { code: "SEAT_TAKEN", status: 409 }).code).toBe("SEAT_TAKEN")
  })

  it("exposes 4xx messages to the client but not 5xx ones", () => {
    expect(new BadRequestError("email không hợp lệ").expose).toBe(true)
    expect(new NotFoundError("không tìm thấy").expose).toBe(true)
    expect(new ExternalServiceError("anthropic timed out").expose).toBe(false)
    expect(new AppError("connection string leaked here").expose).toBe(false)
  })

  it("keeps the underlying cause for logging", () => {
    const cause = new Error("socket hang up")
    const error = new ExternalServiceError("upstream failed", { cause })

    expect(error.cause).toBe(cause)
  })

  it("names each subclass after itself so log records are readable", () => {
    expect(new NotFoundError("x").name).toBe("NotFoundError")
    expect(new ValidationError("x").name).toBe("ValidationError")
  })

  it("gives ValidationError a 422 and a stable code", () => {
    const error = new ValidationError("bad input", { details: [{ message: "required", path: "body.email" }] })

    expect(error.status).toBe(422)
    expect(error.code).toBe("VALIDATION_FAILED")
    expect(error.details).toEqual([{ message: "required", path: "body.email" }])
  })
})

describe("AuthServiceError", () => {
  // ~226 call sites still throw this with a positional status; the compatibility
  // contract is what keeps the AppError migration from being a big-bang rewrite.
  it("is an AppError so the central handler formats it", () => {
    expect(new AuthServiceError("hết phiên", 401)).toBeInstanceOf(AppError)
  })

  it("keeps the positional (message, status) signature", () => {
    const error = new AuthServiceError("hết phiên", 401)

    expect(error.status).toBe(401)
    expect(error.code).toBe("UNAUTHORIZED")
    expect(error.message).toBe("hết phiên")
  })

  it("defaults to 400 like the original implementation", () => {
    expect(new AuthServiceError("sai dữ liệu").status).toBe(400)
  })

  it("reports its historical name", () => {
    expect(new AuthServiceError("x").name).toBe("AuthServiceError")
  })
})
