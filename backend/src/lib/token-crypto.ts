import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { env } from "../config/env"
import { AppError } from "../services/errors"

/**
 * Symmetric encryption for third-party OAuth tokens held at rest.
 *
 * A Google refresh token is a long-lived key to a coach's Drive. Storing it as
 * plain text means a database dump, a leaked backup or an over-broad SELECT hands
 * an attacker every connected account. Keeping the key in the environment instead
 * means the database alone is not enough.
 *
 * AES-256-GCM rather than CBC because GCM authenticates the ciphertext: a row
 * tampered with in the database fails to decrypt instead of yielding a token that
 * silently differs from what was stored.
 */

const ALGORITHM = "aes-256-gcm"
const KEY_BYTES = 32
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16

/** Marks the format so a future key rotation or algorithm change stays detectable. */
const PREFIX = "v1"

let cachedKey: Buffer | undefined

/**
 * Reads the key once and keeps it in memory.
 *
 * Throws rather than falling back to a default: a silent fallback would encrypt
 * every token with a publicly known key, which is worse than refusing to store one.
 */
function getKey() {
  if (cachedKey) {
    return cachedKey
  }

  const raw = env.googleTokenEncryptionKey?.trim()

  if (!raw) {
    throw new AppError("GOOGLE_TOKEN_ENCRYPTION_KEY chưa được cấu hình.", {
      code: "TOKEN_ENCRYPTION_NOT_CONFIGURED",
      status: 500,
    })
  }

  const key = Buffer.from(raw, "base64")

  if (key.length !== KEY_BYTES) {
    throw new AppError(
      `GOOGLE_TOKEN_ENCRYPTION_KEY phải là ${KEY_BYTES} byte mã hoá base64 (hiện tại ${key.length} byte).`,
      { code: "TOKEN_ENCRYPTION_KEY_INVALID", status: 500 },
    )
  }

  cachedKey = key

  return key
}

/** True when a key is present and usable, so callers can degrade instead of crashing. */
function isTokenCryptoConfigured() {
  try {
    getKey()

    return true
  } catch {
    return false
  }
}

/**
 * Returns `v1.<iv>.<authTag>.<ciphertext>`, all base64url.
 *
 * The IV is random per call and stored alongside the ciphertext: reusing an IV
 * under the same key breaks GCM badly, so it must never be derived from the value.
 */
function encryptToken(plainText: string) {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [PREFIX, iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(".")
}

function decryptToken(payload: string) {
  const [prefix, ivPart, tagPart, dataPart] = payload.split(".")

  if (prefix !== PREFIX || !ivPart || !tagPart || !dataPart) {
    throw new AppError("Token đã lưu không đúng định dạng mã hoá.", {
      code: "TOKEN_CIPHERTEXT_MALFORMED",
      status: 500,
    })
  }

  const authTag = Buffer.from(tagPart, "base64url")

  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new AppError("Token đã lưu không đúng định dạng mã hoá.", {
      code: "TOKEN_CIPHERTEXT_MALFORMED",
      status: 500,
    })
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivPart, "base64url"))
  decipher.setAuthTag(authTag)

  try {
    return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8")
  } catch (error) {
    // A failed auth tag means the row was altered or the key changed. Either way the
    // stored token is unusable and the coach has to reconnect.
    throw new AppError("Không giải mã được token Google đã lưu.", {
      cause: error,
      code: "TOKEN_DECRYPT_FAILED",
      status: 500,
    })
  }
}

export { decryptToken, encryptToken, isTokenCryptoConfigured }
