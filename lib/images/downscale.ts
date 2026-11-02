/**
 * Shrinks a photo in the browser before it is uploaded for AI reading.
 *
 * Phone photos are often 4–12 MB; the model reads a sheet just as well at
 * ~1800 px on the long edge, and the API takes at most ~1.1 MB per image. The
 * result is always JPEG, which also drops EXIF (location) from camera photos.
 */

const MAX_EDGE = 1800
/** Base64 characters the backend accepts per image, with a little headroom. */
const MAX_BASE64_LENGTH = 1_400_000
const QUALITIES = [0.85, 0.75, 0.65, 0.55]

type DownscaledImage = { data: string; mediaType: "image/jpeg" }

async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file)
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Throws when the file is not an image the browser can decode. */
async function downscaleImage(file: File): Promise<DownscaledImage> {
  const image = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas is not available.")
  // JPEG has no alpha: paint white first so transparent screenshots stay readable.
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  for (const quality of QUALITIES) {
    const data = canvas.toDataURL("image/jpeg", quality).split(",")[1] ?? ""
    if (data && data.length <= MAX_BASE64_LENGTH) return { data, mediaType: "image/jpeg" }
  }
  throw new Error("Image is too large.")
}

export { downscaleImage, type DownscaledImage }
