import { createHash } from "node:crypto"

import type { Request } from "express"
import { ipKeyGenerator, rateLimit, type Options } from "express-rate-limit"

import { env } from "../config/env"
import { TooManyRequestsError } from "../services/errors"

const MINUTE = 60_000

/**
 * Rate limits are per-user where possible. The Supabase access token is the only
 * caller identity available before `requireCurrentProfile()` runs, so it is hashed
 * (never logged or stored in raw form) and used as the bucket key. Unauthenticated
 * callers fall back to the IP bucket.
 */
function callerKey(req: Request) {
  const header = req.headers.authorization

  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim()

    if (token) {
      return `t:${createHash("sha256").update(token).digest("base64url").slice(0, 24)}`
    }
  }

  return `ip:${ipKeyGenerator(req.ip ?? "")}`
}

function buildLimiter(name: string, options: Pick<Options, "limit" | "windowMs"> & { message: string }) {
  return rateLimit({
    handler: () => {
      throw new TooManyRequestsError(options.message, { code: `RATE_LIMITED_${name.toUpperCase()}` })
    },
    keyGenerator: callerKey,
    legacyHeaders: false,
    limit: options.limit,
    // Local development would otherwise trip limits during hot-reload loops.
    skip: () => !env.isProduction && !env.isTest,
    standardHeaders: "draft-8",
    windowMs: options.windowMs,
  })
}

/** Broad backstop for the whole API surface. */
const apiLimiter = buildLimiter("api", {
  limit: 600,
  message: "Bạn đang gửi quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.",
  windowMs: 15 * MINUTE,
})

/** Credential endpoints — tight, because these are the brute-force targets. */
const authLimiter = buildLimiter("auth", {
  limit: 20,
  message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.",
  windowMs: 15 * MINUTE,
})

/**
 * Generation endpoints call a metered LLM provider, so an unbounded caller is a
 * direct billing risk rather than just a load problem.
 */
const aiLimiter = buildLimiter("ai", {
  limit: 30,
  message: "Bạn đã dùng hết lượt tạo nội dung AI trong giờ này. Vui lòng thử lại sau.",
  windowMs: 60 * MINUTE,
})

/** Bulk import/export handlers hold a DB connection for a long time. */
const heavyLimiter = buildLimiter("heavy", {
  limit: 10,
  message: "Thao tác này đang được xử lý quá thường xuyên. Vui lòng thử lại sau vài phút.",
  windowMs: 10 * MINUTE,
})

export { aiLimiter, apiLimiter, authLimiter, callerKey, heavyLimiter }
