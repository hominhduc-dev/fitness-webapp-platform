// Extract the male body SVG path data from react-native-body-highlighter and
// emit it as plain TypeScript modules under components/body/.
// Run: `node scripts/extract-muscle-paths.mjs`
//
// Why extract instead of `npm install`: the upstream package renders through
// react-native-svg and declares react-native as a peer dependency, so it cannot
// be installed into a Next.js app. Only its *render* layer is React Native —
// the artwork itself is plain SVG `d` strings, which the DOM draws just as well.
//
// The upstream tarball is read straight from the npm registry rather than
// vendored, so bumping UPSTREAM_VERSION and re-running is the whole upgrade
// path. Output files are generated: edit this script, never them.
//
// Upstream: https://github.com/HichamELBSI/react-native-body-highlighter (MIT)

import { execFile } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const outDir = join(root, "components", "body")

const UPSTREAM_VERSION = "3.2.0"
const UPSTREAM_TARBALL = `https://registry.npmjs.org/react-native-body-highlighter/-/react-native-body-highlighter-${UPSTREAM_VERSION}.tgz`

// Front and back share one 1448-unit-wide coordinate space: the front figure
// occupies the left half, the back figure the right half. Keeping the original
// coordinates means the two views can never drift out of alignment.
const VIEW_BOX = {
  back: "724 0 724 1448",
  front: "0 0 724 1448",
}

function banner(sourceFile) {
  return `// GENERATED FILE — do not edit by hand.
// Produced by scripts/extract-muscle-paths.mjs from
// react-native-body-highlighter@${UPSTREAM_VERSION} (${sourceFile}).
//
// react-native-body-highlighter is MIT licensed:
//   Copyright (c) 2022 ELABBASSI Hicham
//   https://github.com/HichamELBSI/react-native-body-highlighter
//
// Only the SVG path data is reused. The rendering component that consumes it
// (components/body/muscle-map.tsx) is our own DOM implementation.
`
}

async function readTarballEntry(dir, entry) {
  // `tar -O` writes the member to stdout. The asset files are ~34KB at most, so
  // buffering them whole is fine.
  const { stdout } = await execFileAsync("tar", ["-xzOf", join(dir, "upstream.tgz"), `package/${entry}`], {
    maxBuffer: 64 * 1024 * 1024,
  })
  return stdout
}

/**
 * Pull the `{ slug, path: { common?, left?, right? } }` entries out of one of
 * upstream's asset modules. The modules are hand-written literal arrays
 * compiled by tsc, so their shape is stable enough to read with a scanner —
 * but bail loudly rather than silently emitting a half-empty body.
 */
function parseBodyAsset(source, exportName) {
  const start = source.indexOf(`exports.${exportName} = [`)
  if (start === -1) {
    throw new Error(`Could not find "exports.${exportName}" — upstream layout changed`)
  }

  const parts = []
  const entryRe = /slug:\s*"([a-z-]+)"/g
  let match

  while ((match = entryRe.exec(source)) !== null) {
    const slug = match[1]
    // Everything up to the next slug (or the end) belongs to this entry.
    entryRe.lastIndex = match.index + match[0].length
    const nextSlug = source.indexOf('slug: "', entryRe.lastIndex)
    const chunk = source.slice(match.index, nextSlug === -1 ? source.length : nextSlug)

    const path = {}
    for (const group of ["common", "left", "right"]) {
      const groupMatch = chunk.match(new RegExp(`${group}:\\s*\\[([\\s\\S]*?)\\]`))
      if (!groupMatch) {
        continue
      }
      const ds = [...groupMatch[1].matchAll(/"([^"]+)"/g)].map((d) => d[1])
      if (ds.length > 0) {
        path[group] = ds
      }
    }

    if (Object.keys(path).length === 0) {
      throw new Error(`Slug "${slug}" yielded no paths — upstream layout changed`)
    }

    parts.push({ path, slug })
  }

  if (parts.length === 0) {
    throw new Error(`No slugs parsed from ${exportName}`)
  }

  return parts
}

/**
 * The body outline is not in the asset modules — it lives inside upstream's
 * SvgMaleWrapper as two `d` attributes (front, then back) on the border <G>.
 * They are by far the longest strings in that file, which is what makes them
 * safe to pick out positionally.
 */
function parseOutline(source) {
  const ds = [...source.matchAll(/d="(M [^"]{500,})"/g)].map((m) => m[1])
  if (ds.length !== 2) {
    throw new Error(`Expected 2 outline paths in SvgMaleWrapper, found ${ds.length}`)
  }
  return { back: ds[1], front: ds[0] }
}

function renderPartsModule(parts, { constName, side, sourceFile, typeName }) {
  const slugs = [...new Set(parts.map((part) => part.slug))].sort()

  const entries = parts
    .map((part) => {
      const groups = ["common", "left", "right"]
        .filter((group) => part.path[group])
        .map((group) => `      ${group}: [\n${part.path[group].map((d) => `        ${JSON.stringify(d)},`).join("\n")}\n      ],`)
        .join("\n")

      return `  {\n    path: {\n${groups}\n    },\n    slug: "${part.slug}",\n  },`
    })
    .join("\n")

  return `${banner(sourceFile)}
import type { BodyPart } from "./types"

export const ${side.toUpperCase()}_VIEW_BOX = "${VIEW_BOX[side]}"

export type ${typeName} =
${slugs.map((slug) => `  | "${slug}"`).join("\n")}

export const ${constName}: readonly BodyPart<${typeName}>[] = [
${entries}
]
`
}

function renderOutlineModule(outline, sourceFile) {
  return `${banner(sourceFile)}
export const BODY_OUTLINE = {
  back: ${JSON.stringify(outline.back)},
  front: ${JSON.stringify(outline.front)},
} as const
`
}

function renderTypesModule() {
  return `// Shared shape for the generated path data in this directory.
// Upstream splits each muscle into up to three groups: \`common\` for parts drawn
// once (abs, neck), \`left\`/\`right\` for the mirrored pairs. We render all three
// with the same fill, but the split is kept so a future per-side feature — the
// left/right imbalance view — does not need the assets regenerated.

export type BodyPart<Slug extends string = string> = {
  path: {
    common?: readonly string[]
    left?: readonly string[]
    right?: readonly string[]
  }
  slug: Slug
}
`
}

async function main() {
  const workDir = await mkdtemp(join(tmpdir(), "muscle-paths-"))

  try {
    const response = await fetch(UPSTREAM_TARBALL)
    if (!response.ok) {
      throw new Error(`Failed to download ${UPSTREAM_TARBALL}: HTTP ${response.status}`)
    }
    await writeFile(join(workDir, "upstream.tgz"), Buffer.from(await response.arrayBuffer()))

    const [frontSource, backSource, wrapperSource] = await Promise.all([
      readTarballEntry(workDir, "dist/assets/bodyFront.js"),
      readTarballEntry(workDir, "dist/assets/bodyBack.js"),
      readTarballEntry(workDir, "dist/components/SvgMaleWrapper.js"),
    ])

    const front = parseBodyAsset(frontSource, "bodyFront")
    const back = parseBodyAsset(backSource, "bodyBack")
    const outline = parseOutline(wrapperSource)

    await mkdir(outDir, { recursive: true })
    await Promise.all([
      writeFile(join(outDir, "types.ts"), renderTypesModule()),
      writeFile(
        join(outDir, "muscle-paths.front.ts"),
        renderPartsModule(front, {
          constName: "FRONT_BODY_PARTS",
          side: "front",
          sourceFile: "dist/assets/bodyFront.js",
          typeName: "FrontMuscleSlug",
        }),
      ),
      writeFile(
        join(outDir, "muscle-paths.back.ts"),
        renderPartsModule(back, {
          constName: "BACK_BODY_PARTS",
          side: "back",
          sourceFile: "dist/assets/bodyBack.js",
          typeName: "BackMuscleSlug",
        }),
      ),
      writeFile(join(outDir, "muscle-outline.ts"), renderOutlineModule(outline, "dist/components/SvgMaleWrapper.js")),
    ])

    console.log(`front: ${front.length} parts, back: ${back.length} parts, outline: 2 paths`)
    console.log(`written to ${outDir}`)
  } finally {
    await rm(workDir, { force: true, recursive: true })
  }
}

await main()
