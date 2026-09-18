/**
 * Browser side of the share card: turn a DOM node into a PNG, then hand it to
 * the OS share sheet (Instagram, Facebook, Zalo, Messages…) or, where that does
 * not exist, to a plain download.
 */

import { toBlob } from "html-to-image"

export type ShareImageOutcome = "cancelled" | "downloaded" | "shared"

const PNG_TYPE = "image/png"

/**
 * Safari on iOS paints an empty frame the first time a node with embedded fonts
 * or images is serialised; the second pass reuses the warmed cache and comes
 * out complete. Rendering twice costs ~100ms and is the accepted workaround.
 */
const WARMUP_PASSES = 2

function isIosSafari() {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  return /iP(ad|hone|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * Serialises `node` at its own layout size times `pixelRatio`. The node must be
 * laid out (in the document, non-`display:none`) — an off-screen wrapper is
 * fine, a hidden one is not.
 */
export async function renderNodeToPng(
  node: HTMLElement,
  { backgroundColor, pixelRatio = 1 }: { backgroundColor?: string; pixelRatio?: number } = {},
): Promise<Blob> {
  const options = {
    backgroundColor,
    // Nothing on the card is cacheable-stale, and cache busting appends query
    // params that break same-origin font requests behind a CDN.
    cacheBust: false,
    height: node.offsetHeight,
    pixelRatio,
    // The preview scales the card down through an ancestor transform; the clone
    // must be captured unscaled or the PNG comes out at preview size.
    style: { transform: "none", transformOrigin: "top left" },
    width: node.offsetWidth,
  }

  const passes = isIosSafari() ? WARMUP_PASSES : 1
  let blob: Blob | null = null

  for (let pass = 0; pass < passes; pass += 1) {
    try {
      blob = await toBlob(node, options)
    } catch {
      // Embedding web fonts fetches every @font-face the document declares. One
      // unreachable sheet rejects the whole render, and a card without its
      // custom font is far better than no card at all.
      blob = await toBlob(node, { ...options, skipFonts: true })
    }
  }

  if (!blob) throw new Error("Share card rendered an empty image")
  return blob
}

/** Whether this browser can put an image file into the native share sheet. */
export function canShareImageFile() {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false
  if (typeof navigator.canShare !== "function") return false

  try {
    return navigator.canShare({ files: [new File([], "probe.png", { type: PNG_TYPE })] })
  } catch {
    return false
  }
}

/** Saves the PNG straight to the device, bypassing the share sheet. */
export function downloadImage(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.rel = "noopener"
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoking synchronously races Safari, which reads the blob after the click
  // handler returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Opens the native share sheet with the PNG attached, falling back to a
 * download. Returns what actually happened so the caller can word its toast —
 * "saved to your photos" is wrong when the share sheet was used, and a user who
 * dismissed the sheet should see nothing at all.
 */
export async function shareOrDownloadImage(
  blob: Blob,
  fileName: string,
  { text, title }: { text?: string; title?: string } = {},
): Promise<ShareImageOutcome> {
  const file = new File([blob], fileName, { type: PNG_TYPE })

  if (canShareImageFile() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title })
      return "shared"
    } catch (error) {
      // The sheet was dismissed — not a failure, and re-downloading behind the
      // user's back would be surprising.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled"
      // Anything else (NotAllowedError on a stale gesture, an app that refuses
      // the payload) still deserves the file.
    }
  }

  downloadImage(blob, fileName)
  return "downloaded"
}
