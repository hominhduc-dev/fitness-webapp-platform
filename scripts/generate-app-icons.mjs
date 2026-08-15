// Generate the 512px PWA icons (standard + maskable) that Android Chrome
// needs for the install prompt and the home screen. Run: `npm run icons`
//
// Both are drawn as SVG and rasterised, never upscaled from the 192px PNG.
// The lockup is a vector rebuild of the shipped mark: the barbell comes from
// public/lift-mark.svg, and the proportions below were measured off
// public/ms-icon-310x310.png so the 512 lines up with the smaller icons.

import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const outDir = join(root, "public")

const SIZE = 512
const NAVY = "#050a30" // sampled from android-icon-192x192.png
const FG = "#ffffff"

// Measured from ms-icon-310x310.png, as a fraction of the canvas.
const BAR_FRAC = 0.426 // barbell width
const TEXT_FRAC = 0.677 // wordmark width
const GAP_FRAC = 0.019 // barbell -> wordmark gap
const TOP_FRAC = 0.316 // top of the barbell
const BOT_FRAC = 0.677 // bottom of the wordmark

// "YEAH BUDDY" in Impact measures 4.81em wide with a 0.81em cap height.
// librsvg ignores textLength, so the run is sized from these metrics.
const TEXT_EM_W = 4.81
const TEXT_CAP = 0.81

// Barbell from public/lift-mark.svg (viewBox 0 0 64 64). The drawn content
// occupies x 4..60 and y 24..40, so the bbox is 56x16 within that box.
const BAR_BOX_W = 56
const BAR_BOX_H = 16

function barbell(fill) {
  return `
    <rect x="4" y="28" width="6" height="8" rx="1" fill="${fill}" />
    <rect x="10" y="24" width="4" height="16" rx="1" fill="${fill}" />
    <rect x="14" y="30" width="36" height="4" fill="${fill}" />
    <rect x="50" y="24" width="4" height="16" rx="1" fill="${fill}" />
    <rect x="54" y="28" width="6" height="8" rx="1" fill="${fill}" />`
}

// Positions the barbell so its drawn bbox lands exactly at (x, y) with width w.
function barbellAt(x, y, w, fill) {
  const s = w / BAR_BOX_W
  return `<g transform="translate(${(x - 4 * s).toFixed(3)} ${(y - 24 * s).toFixed(3)}) scale(${s.toFixed(5)})">${barbell(fill)}</g>`
}

// scale 1 reproduces the shipped lockup; below 1 insets it for the mask.
function iconSvg(scale) {
  const cx = SIZE / 2
  const barW = SIZE * BAR_FRAC * scale
  const barH = (barW / BAR_BOX_W) * BAR_BOX_H
  // Keep the lockup vertically centred as it scales.
  const height = SIZE * (BOT_FRAC - TOP_FRAC) * scale
  const barY = SIZE / 2 - height / 2
  const fontSize = (SIZE * TEXT_FRAC * scale) / TEXT_EM_W
  const baseline = barY + barH + SIZE * GAP_FRAC * scale + fontSize * TEXT_CAP

  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SIZE}" height="${SIZE}" fill="${NAVY}" />
  ${barbellAt(cx - barW / 2, barY, barW, FG)}
  <text x="${cx}" y="${baseline.toFixed(2)}" text-anchor="middle" fill="${FG}"
    font-family="Impact" font-size="${fontSize.toFixed(2)}">YEAH BUDDY</text>
</svg>`
}

// Android's maskable safe zone is a centred circle 80% of the canvas wide.
// The lockup is wide and short, so fit it by its diagonal, not its width,
// and leave headroom inside that circle.
function maskableScale() {
  const w = TEXT_FRAC
  const h = BOT_FRAC - TOP_FRAC
  const diagonal = Math.hypot(w, h)
  return 0.72 / diagonal
}

async function main() {
  await mkdir(outDir, { recursive: true })

  const targets = [
    ["icon-512x512.png", 1],
    ["icon-512x512-maskable.png", maskableScale()],
  ]

  for (const [file, scale] of targets) {
    await sharp(Buffer.from(iconSvg(scale)))
      .png({ compressionLevel: 9 })
      .toFile(join(outDir, file))
    console.log(`Generated public/${file} (scale ${scale.toFixed(3)})`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
