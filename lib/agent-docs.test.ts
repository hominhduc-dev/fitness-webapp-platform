import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

/**
 * AGENTS.md is the one instruction file every coding agent reads; CLAUDE.md only
 * imports it. These checks stop the two drifting apart again and catch links to
 * skills or files that were moved or never existed.
 */
const root = process.cwd()
const read = (file: string) => readFileSync(path.join(root, file), "utf-8")

/** Relative targets of markdown links, skipping URLs and in-page anchors. */
function localLinkTargets(markdown: string) {
  return [...markdown.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1].split("#")[0])
    .filter((target) => target && !/^[a-z]+:/i.test(target))
}

describe("agent instruction files", () => {
  it("CLAUDE.md imports AGENTS.md instead of keeping its own copy", () => {
    const claude = read("CLAUDE.md")
    expect(claude.split("\n")[0].trim()).toBe("@AGENTS.md")
    expect(claude).not.toMatch(/^## Ground Rules/m)
  })

  it("every file AGENTS.md links to exists", () => {
    const missing = localLinkTargets(read("AGENTS.md")).filter((target) => !existsSync(path.join(root, target)))
    expect(missing).toEqual([])
  })

  it("AGENTS.md uses plain links, not Claude-only @imports", () => {
    expect(read("AGENTS.md")).not.toMatch(/^@\S+/m)
  })
})
