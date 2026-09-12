import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../config/env", () => ({
  env: {
    googleOauthClientId: "test-client",
    googleOauthClientSecret: "test-secret",
    googleOauthRedirectUri: "http://localhost:3000/backend/api/coach/google/callback",
    notionTimeoutMs: 15000,
  },
}))

import { extractSpreadsheetId, fetchSpreadsheetMeta } from "./google"
import { BadRequestError, ExternalServiceError } from "../services/errors"

/** Verbatim reply from the Sheets API for an .xlsx that was uploaded, never converted. */
const OFFICE_FILE_BODY = JSON.stringify({
  error: {
    code: 400,
    message: "This operation is not supported for this document. The document must not be an Office file.",
    status: "FAILED_PRECONDITION",
  },
})

function mockGoogleReply(status: number, body: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: async () => JSON.parse(body),
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Google Sheets error translation", () => {
  it("tells the coach to convert the file instead of reporting an upstream failure", async () => {
    mockGoogleReply(400, OFFICE_FILE_BODY)

    const failure = await fetchSpreadsheetMeta("token", "sheet-id").catch((error: unknown) => error)

    // A 400 the coach can fix, not a 502 that reads as "Google is down".
    expect(failure).toBeInstanceOf(BadRequestError)
    expect((failure as BadRequestError).status).toBe(400)
    expect((failure as BadRequestError).code).toBe("GOOGLE_SHEET_IS_OFFICE_FILE")
    expect((failure as BadRequestError).message).toContain("Save as Google Sheets")
  })

  it("still reports other Google failures as upstream errors", async () => {
    mockGoogleReply(404, JSON.stringify({ error: { code: 404, message: "Requested entity was not found." } }))

    const failure = await fetchSpreadsheetMeta("token", "missing-id").catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ExternalServiceError)
    expect((failure as ExternalServiceError).status).toBe(502)
  })
})

describe("extractSpreadsheetId", () => {
  const id = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

  it("reads the id out of the links a coach actually pastes", () => {
    expect(extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit?gid=0#gid=0`)).toBe(id)
    expect(extractSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing&rtpof=true`)).toBe(id)
    expect(extractSpreadsheetId(id)).toBe(id)
  })

  it("rejects anything that is not a spreadsheet link", () => {
    expect(extractSpreadsheetId("")).toBeUndefined()
    expect(extractSpreadsheetId("https://drive.google.com/drive/folders/abc")).toBeUndefined()
  })
})
