type PushCapability = "ios_install_required" | "supported" | "unsupported"

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

function isIosDevice() {
  if (typeof navigator === "undefined") return false

  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

function isStandaloneWebApp() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false

  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as NavigatorWithStandalone).standalone)
}

function hasWebPushApis() {
  return (
    typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window
  )
}

function getPushCapability(): PushCapability {
  // iOS/iPadOS exposes Web Push only to Home Screen web apps. Detect this before
  // checking PushManager so Safari can show an actionable install instruction.
  if (isIosDevice() && !isStandaloneWebApp()) return "ios_install_required"
  return hasWebPushApis() ? "supported" : "unsupported"
}

export { getPushCapability, hasWebPushApis, isIosDevice, isStandaloneWebApp }
export type { PushCapability }
