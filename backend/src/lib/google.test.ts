import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../config/env", () => ({
  env: {
    googleOauthClientId: "test-client",
    googleOauthClientSecret: "test-secret",
    googleOauthRedirectUri: "http://localhost:3000/backend/api/coach/google/callback",
    notionTimeoutMs: 15000,
  },
}))

import { batchUpdateSpreadsheet, extractDriveFolderId, extractSpreadsheetId, fetchSpreadsheetMeta, findOrCreateDriveFolder } from "./google"
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

/** How undici reports a connection Google dropped mid-response. */
function connectionReset() {
  return Object.assign(new TypeError("fetch failed"), {
    cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
  })
}

function okReply() {
  return { json: async () => ({}), ok: true, status: 200, text: async () => "{}" }
}

describe("transient connection failures", () => {
  it("retries a read that Google reset, and returns the reply that follows", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(connectionReset())
      .mockRejectedValueOnce(connectionReset())
      .mockResolvedValue({ ...okReply(), json: async () => ({ properties: { title: "Training" } }) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchSpreadsheetMeta("token", "sheet-id")).resolves.toMatchObject({ title: "Training" })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("gives up on a read once the attempts run out", async () => {
    const fetchMock = vi.fn().mockRejectedValue(connectionReset())
    vi.stubGlobal("fetch", fetchMock)

    const failure = await fetchSpreadsheetMeta("token", "sheet-id").catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ExternalServiceError)
    expect((failure as ExternalServiceError).code).toBe("GOOGLE_UNREACHABLE")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("never repeats a write, because Google may already have applied the lost one", async () => {
    const fetchMock = vi.fn().mockRejectedValue(connectionReset())
    vi.stubGlobal("fetch", fetchMock)

    await expect(batchUpdateSpreadsheet("token", "sheet-id", [])).rejects.toBeInstanceOf(ExternalServiceError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not retry its own timeout, which would only stack more waiting", async () => {
    const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchSpreadsheetMeta("token", "sheet-id")).rejects.toBeInstanceOf(ExternalServiceError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not retry a real HTTP error, which says the same thing every time", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({}),
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: { code: 404 } }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchSpreadsheetMeta("token", "missing-id")).rejects.toBeInstanceOf(ExternalServiceError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe("the app's own Drive folder", () => {
  it("reuses the folder when the app already made one", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ files: [{ id: "folder-1", name: "Templates" }] }),
      ok: true,
      status: 200,
      text: async () => "{}",
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(findOrCreateDriveFolder("token", "Templates")).resolves.toBe("folder-1")
    // One lookup, no creation.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("creates the folder the first time and returns the new id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ files: [] }), ok: true, status: 200, text: async () => "{}" })
      .mockResolvedValueOnce({ json: async () => ({ id: "folder-2" }), ok: true, status: 200, text: async () => "{}" })
    vi.stubGlobal("fetch", fetchMock)

    await expect(findOrCreateDriveFolder("token", "Templates")).resolves.toBe("folder-2")
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST" })
  })
})

describe("extractDriveFolderId", () => {
  const id = "1nJd29hdYscdLKJNd5y8jagFAnk6XT3Nw"

  it("reads the id out of a pasted folder link, or takes a bare id", () => {
    expect(extractDriveFolderId(`https://drive.google.com/drive/folders/${id}`)).toBe(id)
    expect(extractDriveFolderId(`https://drive.google.com/drive/folders/${id}?usp=sharing`)).toBe(id)
    expect(extractDriveFolderId(id)).toBe(id)
  })

  it("rejects anything that is not a folder", () => {
    expect(extractDriveFolderId("")).toBeUndefined()
    expect(extractDriveFolderId("   ")).toBeUndefined()
    expect(extractDriveFolderId("short")).toBeUndefined()
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
