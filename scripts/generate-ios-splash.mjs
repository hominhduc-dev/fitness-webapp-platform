// Generate iOS apple-touch-startup-image splash screens (light + dark)
// from the shared device list. Run: `npm run splash`
//
// Each splash is rendered as an SVG (solid background + centered barbell
// mark) and rasterised to PNG at the device's physical pixel size. The
// matching <link rel="apple-touch-startup-image" media="..."> tags are
// emitted by app/layout.tsx from the same lib/ios-splash-devices.json.

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const outDir = join(root, "public", "splash")

// Theme — must stay in sync with app/globals.css (--background / --ink-800)
const THEMES = {
  light: { bg: "#fcfcfa", fg: "#1a1a17" },
  dark: { bg: "#0d0d0b", fg: "#f5f5f1" },
}

// Barbell mark from public/lift-mark.svg (viewBox 0 0 64 64)
function logoMarkup(fill) {
  return `
    <rect x="4" y="28" width="6" height="8" rx="1" fill="${fill}" />
    <rect x="10" y="24" width="4" height="16" rx="1" fill="${fill}" />
    <rect x="14" y="30" width="36" height="4" fill="${fill}" />
    <rect x="50" y="24" width="4" height="16" rx="1" fill="${fill}" />
    <rect x="54" y="28" width="6" height="8" rx="1" fill="${fill}" />`
}

function splashSvg(pw, ph, { bg, fg }) {
  // Logo sized to ~22% of the shorter side, centered on the canvas.
  const logo = Math.round(Math.min(pw, ph) * 0.22)
  const scale = logo / 64
  const tx = pw / 2 - 32 * scale
  const ty = ph / 2 - 32 * scale
  return `<svg width="${pw}" height="${ph}" viewBox="0 0 ${pw} ${ph}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${pw}" height="${ph}" fill="${bg}" />
  <g transform="translate(${tx} ${ty}) scale(${scale})">${logoMarkup(fg)}</g>
</svg>`
}

async function main() {
  const devices = JSON.parse(
    await readFile(join(root, "lib", "ios-splash-devices.json"), "utf8"),
  )

  await mkdir(outDir, { recursive: true })

  let count = 0
  for (const d of devices) {
    const pw = d.w * d.dpr
    const ph = d.h * d.dpr
    for (const scheme of Object.keys(THEMES)) {
      const svg = splashSvg(pw, ph, THEMES[scheme])
      const file = join(outDir, `${d.name}-${scheme}.png`)
      await sharp(Buffer.from(svg)).png().toFile(file)
      count++
    }
  }

  console.log(`Generated ${count} splash images in public/splash/`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
