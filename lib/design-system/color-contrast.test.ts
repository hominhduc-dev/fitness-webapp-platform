import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

// Comments are stripped first: prose that mentions a token ("--muted: ...")
// would otherwise be parsed as a declaration and shadow the real value.
const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")

type Rgba = [number, number, number, number]

function tokenBlock(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`))
  if (!match) throw new Error(`Missing ${selector} token block`)

  return new Map(
    [...match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((entry) => [`--${entry[1]}`, entry[2].trim()]),
  )
}

function resolveToken(tokens: Map<string, string>, name: string, seen = new Set<string>()): string {
  if (seen.has(name)) throw new Error(`Circular token reference: ${[...seen, name].join(" -> ")}`)
  seen.add(name)

  const value = tokens.get(name)
  if (!value) throw new Error(`Missing token ${name}`)

  // Inline references too, e.g. the alpha channel of the dark --card token.
  return value.replace(/var\((--[\w-]+)\)/g, (_, reference: string) => resolveToken(tokens, reference, new Set(seen)))
}

function parseColor(value: string): Rgba {
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) return [0, 2, 4].map((index) => Number.parseInt(hex[1].slice(index, index + 2), 16)).concat(1) as Rgba

  const rgb = value.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+)(%?))?\)$/)
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]) / (rgb[5] ? 100 : 1)
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha]
  }

  throw new Error(`Expected six-digit hex or rgb(), received ${value}`)
}

function composite(top: Rgba, bottom: Rgba): Rgba {
  const [red, green, blue, alpha] = top
  return [red, green, blue].map((channel, index) => channel * alpha + bottom[index] * (1 - alpha)).concat(1) as Rgba
}

/**
 * Translucent tokens (every dark surface, dark soft tints) have no contrast of
 * their own, so each layer is flattened onto the ones beneath it, down to the
 * opaque page canvas.
 */
function flatten(tokens: Map<string, string>, layers: readonly string[]): Rgba {
  return [...layers].reverse().reduce<Rgba>(
    (below, layer) => composite(parseColor(resolveToken(tokens, layer)), below),
    parseColor(resolveToken(tokens, "--background")),
  )
}

function luminance([red, green, blue]: Rgba) {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: Rgba, background: Rgba) {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

// [foreground, ...surfaces from nearest to furthest]; the page canvas is implied.
const requiredPairs: ReadonlyArray<readonly [string, ...string[]]> = [
  ["--foreground", "--background"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--muted-foreground", "--muted", "--card"],
  ["--primary-foreground", "--primary"],
  ["--primary", "--card"],
  ["--primary", "--primary-soft", "--card"],
  ["--success-text", "--success-soft"],
  ["--warning-text", "--warning-soft"],
  ["--info-text", "--info-soft"],
  ["--destructive-text", "--destructive-soft"],
  ["--success-text", "--card"],
  ["--warning-text", "--card"],
  ["--info-text", "--card"],
  ["--destructive-text", "--card"],
  ["--success-foreground", "--success"],
  ["--warning-foreground", "--warning"],
  ["--info-foreground", "--info"],
  ["--destructive-foreground", "--destructive"],
]

const lightTokens = tokenBlock(":root")
const darkTokens = new Map([...lightTokens, ...tokenBlock(".dark")])
const paletteTokens: ReadonlyArray<readonly [string, Map<string, string>]> = [
  ["performance-green", new Map([...lightTokens, ...tokenBlock(".performance-green")])],
  ["electric-blue", new Map([...lightTokens, ...tokenBlock(".electric-blue")])],
  ["volt-lime", new Map([...lightTokens, ...tokenBlock(".volt-lime")])],
  ["iron-orange", new Map([...lightTokens, ...tokenBlock(".iron-orange")])],
  ["black-volt", new Map([...darkTokens, ...tokenBlock(".black-volt")])],
  ["crimson-performance", new Map([...lightTokens, ...tokenBlock(".crimson-performance")])],
]

const themeTokens: ReadonlyArray<readonly [string, Map<string, string>]> = [
  ["light", lightTokens],
  ...paletteTokens,
  ["dark", darkTokens],
]

describe("Volt Lime palette contract", () => {
  const tokens = new Map([...lightTokens, ...tokenBlock(".volt-lime")])

  it.each([
    ["--background", "#f3f6f5"],
    ["--card", "#ffffff"],
    ["--surface-subtle", "#f0f7e7"],
    ["--brand-accent", "#a3e635"],
    ["--brand-primary", "#3f6f0d"],
    ["--foreground", "#172012"],
  ])("keeps %s at %s", (token, expected) => {
    expect(resolveToken(tokens, token)).toBe(expected)
  })
})

describe("Iron Orange palette contract", () => {
  const tokens = new Map([...lightTokens, ...tokenBlock(".iron-orange")])

  it.each([
    ["--brand-primary", "#f97316"],
    ["--brand-primary-hover", "#c2410c"],
    ["--brand-accent", "#ffb020"],
    ["--brand-primary-soft", "#fff0e5"],
    ["--surface", "#fff7ed"],
    ["--background", "#faf9f7"],
    ["--card", "#ffffff"],
    ["--border", "#e7e5e4"],
    ["--foreground", "#171717"],
    ["--muted-foreground", "#667085"],
    ["--success", "#16a05d"],
    ["--destructive", "#ef4444"],
  ])("keeps %s at %s", (token, expected) => {
    expect(resolveToken(tokens, token)).toBe(expected)
  })
})

describe("Black + Volt palette contract", () => {
  const tokens = new Map([...darkTokens, ...tokenBlock(".black-volt")])

  it.each([
    ["--brand-primary", "#b6f23a"],
    ["--brand-accent", "#c7ff32"],
    ["--brand-primary-hover", "#8bc926"],
    ["--background", "#0d0f0e"],
    ["--sidebar", "#101311"],
    ["--card", "#171a18"],
    ["--surface", "#1d211e"],
    ["--surface-subtle", "#242824"],
    ["--foreground", "#f7f9f7"],
    ["--text-secondary", "#a5ada7"],
    ["--ink-400", "#707872"],
    ["--border", "#2b302c"],
    ["--success", "#4ade80"],
    ["--warning", "#facc15"],
    ["--destructive", "#ff5a5f"],
  ])("keeps %s at %s", (token, expected) => {
    expect(resolveToken(tokens, token)).toBe(expected)
  })
})

describe.each(themeTokens)("%s theme contrast", (_theme, tokens) => {
  it.each(requiredPairs)("keeps %s legible on %s", (foreground, ...surfaces) => {
    const background = flatten(tokens, surfaces)
    const text = composite(parseColor(resolveToken(tokens, foreground)), background)
    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5)
  })

  it("defines distinct semantic surface roles", () => {
    expect(tokens.get("--surface")).toBeTruthy()
    expect(tokens.get("--surface-subtle")).toBeTruthy()
    expect(tokens.get("--surface-hover")).toBeTruthy()
  })
})

describe("light canvas", () => {
  it("keeps the browser chrome colour in sync with --background", () => {
    const background = resolveToken(lightTokens, "--background").toLowerCase()
    const sources = [
      "app/layout.tsx",
      "components/providers/theme-provider.tsx",
      "public/manifest.json",
      "public/browserconfig.xml",
    ]

    for (const source of sources) {
      const content = readFileSync(path.join(process.cwd(), source), "utf8").toLowerCase()
      expect(content, source).toContain(background)
    }
  })

  it.each(paletteTokens)("keeps %s browser chrome colour in sync with its background", (_theme, tokens) => {
    const background = resolveToken(tokens, "--background").toLowerCase()
    for (const source of ["app/layout.tsx", "components/providers/theme-provider.tsx"]) {
      const content = readFileSync(path.join(process.cwd(), source), "utf8").toLowerCase()
      expect(content, source).toContain(background)
    }
  })
})
