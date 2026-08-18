import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8")

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

  const reference = value.match(/^var\((--[\w-]+)\)$/)
  return reference ? resolveToken(tokens, reference[1], seen) : value
}

function rgb(hex: string) {
  const normalized = hex.replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(normalized)) throw new Error(`Expected six-digit hex, received ${hex}`)
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16) / 255)
}

function luminance(hex: string) {
  const [red, green, blue] = rgb(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

const requiredPairs = [
  ["--foreground", "--background"],
  ["--muted-foreground", "--background"],
  ["--primary-foreground", "--primary"],
  ["--success-text", "--success-soft"],
  ["--warning-text", "--warning-soft"],
  ["--info-text", "--info-soft"],
  ["--destructive-text", "--destructive-soft"],
] as const

const darkTokens = new Map([...tokenBlock(":root"), ...tokenBlock(".dark")])

describe.each([
  ["light", tokenBlock(":root")],
  ["dark", darkTokens],
  // Midnight is applied as .dark + data-palette, so it inherits the dark block
  // and only overrides the tokens that move to navy.
  ["midnight", new Map([...darkTokens, ...tokenBlock(':root[data-palette="midnight"]')])],
])("%s theme contrast", (_theme, tokens) => {
  it.each(requiredPairs)("keeps %s legible on %s", (foreground, background) => {
    expect(contrast(resolveToken(tokens, foreground), resolveToken(tokens, background))).toBeGreaterThanOrEqual(4.5)
  })
})
