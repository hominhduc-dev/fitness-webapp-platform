import { Fragment, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Renders an AI reply as readable blocks.
 *
 * The system prompt asks for plain text, and the model obliges — but it still
 * structures answers with blank lines, "-" bullets and indented item lists.
 * Dropping that string into a <div> lets HTML collapse every newline into a
 * space, which turns the whole answer into one wall of text. This parses the
 * handful of shapes the model actually emits; it is deliberately not a full
 * markdown renderer.
 */

type Block =
  | { type: "paragraph"; lines: string[] }
  | { type: "bullets"; items: string[] }
  | { type: "numbered"; items: string[] }

const BULLET_PATTERN = /^\s*[-*•]\s+(.*)$/
const NUMBERED_PATTERN = /^\s*\d+[.)]\s+(.*)$/
const INDENTED_PATTERN = /^\s{2,}(\S.*)$/

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", lines: paragraph })
      paragraph = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!line.trim()) {
      flushParagraph()
      continue
    }

    const bullet = line.match(BULLET_PATTERN)
    if (bullet) {
      flushParagraph()
      const items = [bullet[1]]
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(BULLET_PATTERN)
        if (!next) break
        items.push(next[1])
        i++
      }
      blocks.push({ type: "bullets", items })
      continue
    }

    const numbered = line.match(NUMBERED_PATTERN)
    if (numbered) {
      flushParagraph()
      const items = [numbered[1]]
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(NUMBERED_PATTERN)
        if (!next) break
        items.push(next[1])
        i++
      }
      blocks.push({ type: "numbered", items })
      continue
    }

    // The model also lists things as bare indented lines (no "-" prefix).
    // Only treat them as a list when at least two run together, so a single
    // stray-indented sentence stays a normal paragraph line.
    const indented = line.match(INDENTED_PATTERN)
    if (indented && lines[i + 1]?.match(INDENTED_PATTERN)) {
      flushParagraph()
      const items = [indented[1]]
      while (i + 1 < lines.length) {
        const next = lines[i + 1].match(INDENTED_PATTERN)
        if (!next) break
        items.push(next[1])
        i++
      }
      blocks.push({ type: "bullets", items })
      continue
    }

    paragraph.push(line.trim())
  }

  flushParagraph()
  return blocks
}

/** Renders **bold** spans; everything else stays literal text. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

function AIMessage({ content, className }: { content: string; className?: string }) {
  const blocks = parseBlocks(content)

  if (blocks.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-2", className)}>
      {blocks.map((block, i) => {
        if (block.type === "bullets") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-4.5 marker:text-current/50">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === "numbered") {
          return (
            <ol key={i} className="list-decimal space-y-1 pl-4.5 marker:text-current/50">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          )
        }

        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

export { AIMessage }
