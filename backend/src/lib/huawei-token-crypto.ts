import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

import { env } from "../config/env"
import { AppError } from "../services/errors"

const ALGORITHM = "aes-256-gcm"
const KEY_BYTES = 32
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const PREFIX = "v1"

let cachedKey: Buffer | undefined

function getKey() {
  if (cachedKey) return cachedKey

  const raw = env.huaweiTokenEncryptionKey?.trim()
  if (!raw) {
    throw new AppError("HUAWEI_TOKEN_ENCRYPTION_KEY chưa được cấu hình.", {
      code: "HUAWEI_TOKEN_ENCRYPTION_NOT_CONFIGURED",
      status: 500,
    })
  }

  const key = Buffer.from(raw, "base64")
  if (key.length !== KEY_BYTES) {
    throw new AppError(
      `HUAWEI_TOKEN_ENCRYPTION_KEY phải là ${KEY_BYTES} byte mã hoá base64 (hiện tại ${key.length} byte).`,
      { code: "HUAWEI_TOKEN_ENCRYPTION_KEY_INVALID", status: 500 },
    )
  }

  cachedKey = key
  return key
}

function isHuaweiTokenCryptoConfigured() {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

function encryptHuaweiToken(plainText: string) {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [PREFIX, iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(".")
}

function decryptHuaweiToken(payload: string) {
  const [prefix, ivPart, tagPart, dataPart] = payload.split(".")
  if (prefix !== PREFIX || !ivPart || !tagPart || !dataPart) {
    throw new AppError("Huawei token đã lưu không đúng định dạng mã hoá.", {
      code: "HUAWEI_TOKEN_CIPHERTEXT_MALFORMED",
      status: 500,
    })
  }

  const authTag = Buffer.from(tagPart, "base64url")
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new AppError("Huawei token đã lưu không đúng định dạng mã hoá.", {
      code: "HUAWEI_TOKEN_CIPHERTEXT_MALFORMED",
      status: 500,
    })
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivPart, "base64url"))
  decipher.setAuthTag(authTag)

  try {
    return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8")
  } catch (error) {
    throw new AppError("Không giải mã được Huawei token đã lưu.", {
      cause: error,
      code: "HUAWEI_TOKEN_DECRYPT_FAILED",
      status: 500,
    })
  }
}

export {
  decryptHuaweiToken,
  encryptHuaweiToken,
  isHuaweiTokenCryptoConfigured,
}
