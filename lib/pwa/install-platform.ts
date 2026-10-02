/**
 * Which "add to Home Screen" instructions a visitor needs.
 *
 * - `installed`: already opened from the Home Screen icon.
 * - `in-app`: inside Zalo, Facebook, Messenger, Instagram, TikTok or LINE. Their
 *   built-in browsers cannot install a web app, so the visitor has to reopen the
 *   link in Safari or Chrome first.
 * - `ios-safari` / `ios-other`: iPhone or iPad. Safari is the dependable path;
 *   other iOS browsers can add to the Home Screen from iOS 16.4 on.
 * - `android`: Chrome and other Android browsers offer an install prompt or menu item.
 * - `desktop`: anything else.
 */
type InstallPlatform = "android" | "desktop" | "in-app" | "installed" | "ios-other" | "ios-safari"

const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Zalo|ZaloTheme|musical_ly|BytedanceWebview|TikTok|Line\//i
const IOS_OTHER_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|YaBrowser|Coc ?Coc/i

function detectInstallPlatform(input: {
  maxTouchPoints?: number
  platform?: string
  standalone: boolean
  userAgent: string
}): InstallPlatform {
  if (input.standalone) return "installed"
  if (IN_APP_BROWSER.test(input.userAgent)) return "in-app"

  // iPadOS reports itself as a Mac; a touch screen gives it away.
  const ios = /iPad|iPhone|iPod/.test(input.userAgent)
    || (input.platform === "MacIntel" && (input.maxTouchPoints ?? 0) > 1)
  if (ios) return IOS_OTHER_BROWSER.test(input.userAgent) ? "ios-other" : "ios-safari"

  if (/Android/i.test(input.userAgent)) return "android"
  return "desktop"
}

export { detectInstallPlatform }
export type { InstallPlatform }
