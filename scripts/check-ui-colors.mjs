import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const roots = ["app", "components", "lib"]
const extensions = new Set([".js", ".jsx", ".ts", ".tsx"])

// These literals describe browser chrome, official brand artwork, or the
// low-level SVG filter pipeline. They are not application UI decisions.
const allowedFiles = new Set([
  "components/ui/liquid-glass-filters.tsx",
])

const allowedLiterals = new Map([
  ["app/layout.tsx", new Set(["#080a0f", "#f4f7fb"])],
  ["components/providers/theme-provider.tsx", new Set(["#080a0f", "#f4f7fb"])],
  ["components/auth/auth-modal.tsx", new Set(["#4285f4", "#34a853", "#fbbc05", "#ea4335"])],
])

const literalColorPattern = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\(\s*(?:[.\d+-]|var\()/g
const rawTailwindPattern = /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:\b|[-/[])/g

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(target))
    else if (extensions.has(path.extname(entry.name))) files.push(target)
  }

  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length
}

const failures = []

for (const root of roots) {
  const files = await collectFiles(root)

  for (const file of files) {
    const normalized = file.replaceAll("\\", "/")
    if (allowedFiles.has(normalized)) continue

    const source = await readFile(file, "utf8")
    const allowed = allowedLiterals.get(normalized) ?? new Set()

    for (const match of source.matchAll(literalColorPattern)) {
      const literal = match[0].toLowerCase()
      if (allowed.has(literal)) continue
      failures.push(`${normalized}:${lineNumber(source, match.index)} raw color literal ${match[0]}`)
    }

    for (const match of source.matchAll(rawTailwindPattern)) {
      failures.push(`${normalized}:${lineNumber(source, match.index)} raw Tailwind palette class ${match[0]}`)
    }
  }
}

if (failures.length > 0) {
  console.error("UI color contract violations:\n")
  console.error(failures.map((failure) => `- ${failure}`).join("\n"))
  console.error("\nUse a semantic token from app/globals.css or document a technical/brand exception in scripts/check-ui-colors.mjs.")
  process.exit(1)
}

console.log("UI color contract passed: application code uses semantic tokens.")
