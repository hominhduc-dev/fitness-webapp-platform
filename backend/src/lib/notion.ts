import { env } from "../config/env"
import { BadRequestError, ExternalServiceError } from "../services/errors"
import { logger } from "./logger"

const NOTION_BASE_URL = "https://api.notion.com/v1"

/** Notion caps every query response at 100 rows, so paging is mandatory, not optional. */
const PAGE_SIZE = 100

/** A program with 8 weeks of rows stays well under this; the guard is for runaway relations. */
const MAX_PAGES = 50

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])
const MAX_ATTEMPTS = 3

type NotionRichText = {
  plain_text?: unknown
}

type NotionProperty = {
  checkbox?: unknown
  date?: { start?: unknown } | null
  multi_select?: Array<{ name?: unknown }>
  number?: unknown
  relation?: Array<{ id?: unknown }>
  rich_text?: NotionRichText[]
  select?: { name?: unknown } | null
  title?: NotionRichText[]
  type?: unknown
  url?: unknown
}

type NotionPage = {
  id: string
  last_edited_time?: string
  properties?: Record<string, NotionProperty>
  url?: string
}

type NotionQueryResponse = {
  has_more?: boolean
  next_cursor?: string | null
  results?: NotionPage[]
}

type QueryOptions = {
  filter?: Record<string, unknown>
  sorts?: Array<Record<string, unknown>>
}

function isNotionConfigured() {
  return Boolean(env.notionToken && env.notionProgramDbId && env.notionProgramRowsDbId)
}

function requireNotionConfig() {
  if (!env.notionToken) {
    throw new BadRequestError("Chưa cấu hình NOTION_TOKEN trên máy chủ.", { code: "NOTION_NOT_CONFIGURED" })
  }

  if (!env.notionProgramDbId || !env.notionProgramRowsDbId) {
    throw new BadRequestError("Chưa cấu hình database Notion cho program mẫu.", { code: "NOTION_NOT_CONFIGURED" })
  }

  return {
    programDbId: env.notionProgramDbId,
    rowsDbId: env.notionProgramRowsDbId,
    token: env.notionToken,
  }
}

/**
 * Notion accepts both the dashed UUID and the 32-character form that appears in
 * page URLs. Callers paste either, so both are normalised to the dashed form.
 */
function normalizeNotionId(value: string) {
  const compact = value.trim().replace(/-/g, "")

  if (!/^[0-9a-f]{32}$/i.test(compact)) {
    return undefined
  }

  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-")
}

/** Pulls the database or page id out of a pasted Notion URL, or out of a bare id. */
function extractNotionIdFromInput(input: string) {
  const trimmed = input.trim()

  if (!trimmed) {
    return undefined
  }

  const direct = normalizeNotionId(trimmed)

  if (direct) {
    return direct
  }

  const candidates = trimmed.match(/[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []

  for (const candidate of candidates.reverse()) {
    const normalized = normalizeNotionId(candidate)

    if (normalized) {
      return normalized
    }
  }

  return undefined
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Notion allows 3 requests per second on non-enterprise plans and answers 429 with
 * a `Retry-After` header. Several coaches importing at once share that budget, so
 * every call backs off instead of surfacing the failure straight away.
 */
async function notionFetch(path: string, body: Record<string, unknown>, token: string) {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, env.notionTimeoutMs)

    try {
      const response = await fetch(`${NOTION_BASE_URL}${path}`, {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Notion-Version": env.notionApiVersion,
        },
        method: "POST",
        signal: controller.signal,
      })

      if (response.ok) {
        return (await response.json()) as NotionQueryResponse
      }

      const payload = await response.text()

      if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
        throw new ExternalServiceError(`Notion trả về lỗi ${response.status}.`, {
          code: "NOTION_REQUEST_FAILED",
          details: { path, status: response.status },
        })
      }

      const retryAfterSeconds = Number(response.headers.get("retry-after"))
      const backoffMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : 2 ** attempt * 250 + Math.random() * 250

      logger.warn("notion request retrying", { attempt, backoffMs, payload: payload.slice(0, 200), status: response.status })
      await sleep(backoffMs)
      continue
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error
      }

      lastError = error

      if (attempt === MAX_ATTEMPTS) {
        break
      }

      await sleep(2 ** attempt * 250)
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new ExternalServiceError("Không gọi được Notion API.", {
    cause: lastError,
    code: "NOTION_UNREACHABLE",
  })
}

/** Walks every page of a database query and returns the flattened rows. */
async function queryDatabase(databaseId: string, token: string, options: QueryOptions = {}) {
  const pages: NotionPage[] = []
  let cursor: string | undefined

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await notionFetch(
      `/databases/${databaseId}/query`,
      {
        page_size: PAGE_SIZE,
        ...(cursor ? { start_cursor: cursor } : {}),
        ...(options.filter ? { filter: options.filter } : {}),
        ...(options.sorts ? { sorts: options.sorts } : {}),
      },
      token,
    )

    pages.push(...(response.results ?? []))

    if (!response.has_more || !response.next_cursor) {
      return pages
    }

    cursor = response.next_cursor
  }

  throw new ExternalServiceError("Database Notion quá lớn để import trong một lần.", {
    code: "NOTION_TOO_MANY_ROWS",
    details: { maxRows: MAX_PAGES * PAGE_SIZE },
  })
}

function readPlainText(parts: NotionRichText[] | undefined) {
  if (!Array.isArray(parts)) {
    return ""
  }

  return parts
    .map((part) => (typeof part?.plain_text === "string" ? part.plain_text : ""))
    .join("")
    .trim()
}

/**
 * Reads a property without caring which Notion type the author picked. A coach who
 * makes `Reps` a Number instead of Text should not break the import, so numbers,
 * selects and dates all collapse to their text form.
 */
function readPropertyText(page: NotionPage, name: string) {
  const property = page.properties?.[name]

  if (!property) {
    return ""
  }

  if (Array.isArray(property.title)) {
    return readPlainText(property.title)
  }

  if (Array.isArray(property.rich_text)) {
    return readPlainText(property.rich_text)
  }

  if (property.select && typeof property.select.name === "string") {
    return property.select.name.trim()
  }

  if (typeof property.number === "number") {
    return String(property.number)
  }

  if (typeof property.checkbox === "boolean") {
    return property.checkbox ? "true" : "false"
  }

  if (typeof property.url === "string") {
    return property.url.trim()
  }

  if (property.date && typeof property.date.start === "string") {
    return property.date.start
  }

  if (Array.isArray(property.multi_select)) {
    return property.multi_select
      .map((option) => (typeof option?.name === "string" ? option.name : ""))
      .filter(Boolean)
      .join(", ")
  }

  return ""
}

function readPropertyNumber(page: NotionPage, name: string) {
  const property = page.properties?.[name]

  if (property && typeof property.number === "number") {
    return property.number
  }

  const text = readPropertyText(page, name)

  if (!text) {
    return undefined
  }

  const parsed = Number(text.replace(",", "."))

  return Number.isFinite(parsed) ? parsed : undefined
}

/** Returns the ids of every page this relation property points at. */
function readRelationIds(page: NotionPage, name: string) {
  const property = page.properties?.[name]

  if (!Array.isArray(property?.relation)) {
    return []
  }

  return property.relation
    .map((entry) => (typeof entry?.id === "string" ? entry.id : ""))
    .filter(Boolean)
}

export {
  extractNotionIdFromInput,
  isNotionConfigured,
  normalizeNotionId,
  queryDatabase,
  readPropertyNumber,
  readPropertyText,
  readRelationIds,
  requireNotionConfig,
}
export type { NotionPage }
