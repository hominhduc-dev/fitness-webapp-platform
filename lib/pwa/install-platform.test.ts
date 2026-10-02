import { describe, expect, it } from "vitest"

import { detectInstallPlatform } from "./install-platform"

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1"
const IPHONE_ZALO = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/598 ZaloTheme/light"
const IPHONE_FACEBOOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.38.101]"
const IPAD_DESKTOP_MODE = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15"
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36"
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"

describe("detectInstallPlatform", () => {
  it("knows when the app is already open from the Home Screen", () => {
    expect(detectInstallPlatform({ standalone: true, userAgent: IPHONE_SAFARI })).toBe("installed")
  })

  it("sends in-app browsers to a real browser first", () => {
    expect(detectInstallPlatform({ standalone: false, userAgent: IPHONE_ZALO })).toBe("in-app")
    expect(detectInstallPlatform({ standalone: false, userAgent: IPHONE_FACEBOOK })).toBe("in-app")
  })

  it("tells Safari apart from other iOS browsers", () => {
    expect(detectInstallPlatform({ standalone: false, userAgent: IPHONE_SAFARI })).toBe("ios-safari")
    expect(detectInstallPlatform({ standalone: false, userAgent: IPHONE_CHROME })).toBe("ios-other")
  })

  it("recognises an iPad that reports itself as a Mac by its touch screen", () => {
    expect(detectInstallPlatform({ maxTouchPoints: 5, platform: "MacIntel", standalone: false, userAgent: IPAD_DESKTOP_MODE })).toBe("ios-safari")
    expect(detectInstallPlatform({ maxTouchPoints: 0, platform: "MacIntel", standalone: false, userAgent: MAC_CHROME })).toBe("desktop")
  })

  it("covers Android", () => {
    expect(detectInstallPlatform({ standalone: false, userAgent: ANDROID_CHROME })).toBe("android")
  })
})
