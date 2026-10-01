import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../config/env", () => ({
  env: {
    huaweiClientId: "test-client",
    huaweiClientSecret: "test-secret",
    huaweiHealthApiBase: "https://health-api.cloud.huawei.com",
    huaweiOauthRedirectUri: "http://localhost:3000/backend/api/integrations/huawei/callback",
  },
}))

import {
  buildHuaweiAuthorizationUrl,
  exchangeCodeForTokens,
  OPTIONAL_SCOPES,
  requestHuaweiHealth,
  SCOPES,
} from "./huawei"

describe("Huawei Health client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("builds a least-privilege offline authorization URL", () => {
    const url = new URL(buildHuaweiAuthorizationUrl("signed-state"))

    expect(url.origin + url.pathname).toBe("https://oauth-login.cloud.huawei.com/oauth2/v3/authorize")
    expect(url.searchParams.get("client_id")).toBe("test-client")
    expect(url.searchParams.get("access_type")).toBe("offline")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("state")).toBe("signed-state")

    const scopes = url.searchParams.get("scope")?.split(" ") ?? []
    expect(scopes).toEqual([...SCOPES])
    expect(scopes).not.toContain("https://www.huawei.com/healthkit/activity.read")
    // Weight is requested for the weight log, but optional so a grant without it still connects.
    expect(scopes).toContain("https://www.huawei.com/healthkit/heightweight.read")
    expect([...OPTIONAL_SCOPES]).toEqual(["https://www.huawei.com/healthkit/heightweight.read"])
  })

  it("exchanges a code only through the server token endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "access",
          expires_in: 3600,
          refresh_token: "refresh",
          scope: SCOPES.join(" "),
          token_type: "Bearer",
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      ),
    )

    const tokens = await exchangeCodeForTokens("authorization-code")

    expect(tokens.accessToken).toBe("access")
    expect(tokens.refreshToken).toBe("refresh")
    expect(tokens.scope).toBe(SCOPES.join(" "))

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toBe("https://oauth-login.cloud.huawei.com/oauth2/v3/token")
    expect(init?.method).toBe("POST")
    expect(String(init?.body)).toContain("client_secret=test-secret")
    expect(String(init?.body)).toContain("code=authorization-code")
  })

  it("follows Huawei's cross-site region redirect only to an allowed Health API host", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 121001, message: "request forbidden due to site cross" } }),
          {
            headers: {
              "Content-Type": "application/json",
              Location: "https://health-api.cloud.huawei.eu/healthkit/v2/sampleSet:polymerize",
            },
            status: 403,
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ group: [] }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      )

    const result = await requestHuaweiHealth<{ group: unknown[] }>(
      "access-token",
      "/healthkit/v2/sampleSet:polymerize",
      { body: JSON.stringify({}), method: "POST" },
    )

    expect(result.baseUrl).toBe("https://health-api.cloud.huawei.eu")
    expect(result.data.group).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
      "https://health-api.cloud.huawei.eu/healthkit/v2/sampleSet:polymerize",
    )
  })

  it("rejects a cross-site redirect to an arbitrary host", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 121001, message: "request forbidden due to site cross" } }),
        {
          headers: {
            "Content-Type": "application/json",
            Location: "https://attacker.example/healthkit/v2/sampleSet:polymerize",
          },
          status: 403,
        },
      ),
    )

    await expect(
      requestHuaweiHealth("access-token", "/healthkit/v2/sampleSet:polymerize", {
        method: "POST",
      }),
    ).rejects.toMatchObject({ code: "HUAWEI_HEALTH_REGION_INVALID" })

    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
