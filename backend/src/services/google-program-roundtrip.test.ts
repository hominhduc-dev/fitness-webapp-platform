import { describe, expect, it, vi } from "vitest"
vi.mock("../config/env", () => ({ env: { googleOauthClientId: "test-client", googleOauthClientSecret: "test-secret", googleOauthRedirectUri: "http://localhost/callback", googleTokenEncryptionKey: Buffer.alloc(32, 7).toString("base64") } }))
vi.mock("../lib/prisma", () => ({ prisma: null }))
import { parseGoogleProgramRows } from "./google-program-import.service"
import { buildGoogleResultRequests } from "./google-program-export.service"
import { createGoogleState, verifyGoogleState, GOOGLE_STATE_MAX_AGE } from "./google-connection.service"
import { decryptToken, encryptToken } from "../lib/token-crypto"
import { buildAuthorizationUrl, fetchSheetValues } from "../lib/google"

const headers = ["Day", "Muscle Group", "Exercise", "Variation", "", "Sets", "Rep Range", "Weight (kg)", "Substitute Exercise", "Actual rep per weight", "", "", "", "", "RIR", "Method", "Rest (s)", "Note"]
const grid = () => [["Week 1"], headers, ["1", "Chest", "Bench", "Default", "v1", "3", "8-12", "40", "", "", "", "", "", "", "0", "3:mrm", "90"], ["", "Chest", "Fly", "Default", "v2", "2", "12", "10"]]
const legacyHeaders = ["Day", "Muscle Group", "Exercise", "Variation", "", "Sets", "Rep Range", "Weight (kg)", "Substitute Exercise", "Actual rep per weight", "", "", "", "", "RIR", "Rest (s)", "Note"]
describe("Google sheet row parsing", () => {
  it("carries merged Day values, positional IDs, rep ranges and zero RIR", () => {
    const rows = parseGoogleProgramRows(grid())
    expect(rows[0]).toMatchObject({ sourceRow: 3, scheduledDay: 1, order: 1, variationId: "v1", reps: "8-12", rir: 0, restTime: 90, method: "3:mrm" })
    expect(rows[1]).toMatchObject({ sourceRow: 4, scheduledDay: 1, order: 2 })
  })
  it("still reads sheets authored before the Method column existed", () => {
    const rows = parseGoogleProgramRows([["Week 1"], legacyHeaders, ["1", "Chest", "Bench", "Default", "v1", "3", "8-12", "40", "", "", "", "", "", "", "0", "90"]])
    expect(rows[0]).toMatchObject({ restTime: 90, method: undefined })
  })
  it("rejects old or shifted layouts and does not guess a missing variation ID", () => {
    expect(() => parseGoogleProgramRows([["Day", "Exercise"]])).toThrow()
    const values = grid(); values[2][4] = ""
    expect(parseGoogleProgramRows(values)[0].variationId).toBe("__missing_variation_id__")
  })
})
describe("Google sheet export planning", () => {
  const exercise = { order: 1, originalVariationId: "v1", variation: { id: "v3", name: "Incline" }, exercise: { name: "Press" }, sets: [{ setNumber: 1, completed: true, actualReps: 10, weight: 35 }] }
  it("matches the original exercise after a swap and writes result columns only", () => {
    const result = buildGoogleResultRequests(grid(), [{ day: 1, week: 1, exercises: [exercise] }], 5, 50)
    expect(result.rowCount).toBe(1)
    expect(result.requests).toEqual([{ updateCells: { start: { sheetId: 5, rowIndex: 2, columnIndex: 8 }, rows: [{ values: [{ userEnteredValue: { stringValue: "Press / Incline" } }, { userEnteredValue: { stringValue: "10 × 35 kg" } }, {}, {}, {}, {}] }], fields: "userEnteredValue" } }])
  })
  it("inserts extra sets before RIR and clears copied results on a new week", () => {
    const result = buildGoogleResultRequests(grid(), [{ day: 1, week: 2, exercises: [{ ...exercise, sets: [{ setNumber: 7, completed: true, actualReps: 5, weight: 45 }] }] }], 9, 50, true)
    expect(result.requests[0]).toEqual({ insertDimension: { range: { sheetId: 9, dimension: "COLUMNS", startIndex: 14, endIndex: 16 }, inheritFromBefore: true } })
    expect(result.requests).toContainEqual({ repeatCell: { range: { sheetId: 9, startRowIndex: 2, endRowIndex: 50, startColumnIndex: 8, endColumnIndex: 16 }, cell: {}, fields: "userEnteredValue" } })
  })
  it("rejects inserted/reordered rows and duplicate session results before any write", () => {
    const values = grid(); values.splice(2, 0, ["1", "", "Other", "Default", "v9", "3", "10"])
    expect(() => buildGoogleResultRequests(values, [{ day: 1, week: 1, exercises: [exercise] }], 5, 50)).toThrow(/Không khớp/)
    expect(() => buildGoogleResultRequests(grid(), [{ day: 1, week: 1, exercises: [exercise, exercise] }], 5, 50)).toThrow(/nhiều log/)
  })
})
describe("Google OAuth boundary", () => {
  it("binds signed state to browser nonce and expires it", () => {
    const { state, nonce } = createGoogleState("coach-1")
    expect(verifyGoogleState(state, nonce)).toBe("coach-1")
    expect(() => verifyGoogleState(state, "other-browser")).toThrow()
    expect(() => verifyGoogleState(`${state}x`, nonce)).toThrow()
    const now = Date.now(); const spy = vi.spyOn(Date, "now").mockReturnValue(now + GOOGLE_STATE_MAX_AGE + 1)
    expect(() => verifyGoogleState(state, nonce)).toThrow()
    spy.mockRestore()
  })
  it("encrypts token values with authenticated ciphertext", () => {
    const encrypted = encryptToken("test-refresh-token")
    expect(encrypted).not.toContain("test-refresh-token")
    expect(decryptToken(encrypted)).toBe("test-refresh-token")
    const parts = encrypted.split("."); parts[3] = Buffer.from("tampered").toString("base64url")
    expect(() => decryptToken(parts.join("."))).toThrow()
  })
  it("requests offline consent and read/write Sheets scope", () => {
    const url = new URL(buildAuthorizationUrl("state"))
    expect(url.searchParams.get("scope")).toContain("https://www.googleapis.com/auth/spreadsheets ")
    expect(url.searchParams.get("access_type")).toBe("offline")
  })
  it("quotes sheet names rather than interpreting them as named ranges", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ values: [["1"]] })))
    vi.stubGlobal("fetch", fetch)
    await fetchSheetValues("access", "sheet-id", "Coach's Week")
    expect(decodeURIComponent(fetch.mock.calls[0][0])).toContain("/values/'Coach''s Week'")
    vi.unstubAllGlobals()
  })
})
