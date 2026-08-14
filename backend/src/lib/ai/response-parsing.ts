import { ExternalServiceError } from "../../services/errors"

/**
 * Shared salvage logic for model text responses.
 *
 * Lives outside the providers because model output does not get tidier just
 * because it arrived over a different API — the Anthropic path previously used
 * a bare JSON.parse and threw on anything wrapped in prose, while the
 * OpenAI-compatible path already handled it.
 */

/**
 * Removes reasoning blocks that thinking models (e.g. Gemma via Google AI
 * Studio) emit before the real answer: <thought>...</thought> /
 * <thinking>...</thinking>. If the model ran out of tokens mid-thought (no
 * closing tag), drop the dangling open block too so we don't return raw
 * reasoning to the user.
 */
function stripThoughts(text: string): string {
  return text
    .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<think(?:ing)?>[\s\S]*$/gi, "")
    .replace(/<thought>[\s\S]*$/gi, "")
    .trim()
}

/**
 * Extracts a JSON object from a raw model response. Handles:
 * 1. Reasoning blocks — stripped first so a draft JSON inside <thought> isn't
 *    mistaken for the answer.
 * 2. Plain JSON.
 * 3. JSON wrapped in a ```json ... ``` markdown fence.
 * 4. JSON embedded in surrounding prose (grabs the outermost {...} span).
 */
function extractJSON<T>(text: string): T {
  const trimmed = stripThoughts(text)

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim()) as T
  }

  try {
    return JSON.parse(trimmed) as T
  } catch {
    // Fall back to grabbing the outermost { ... } span.
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T
    }
    throw new ExternalServiceError("Nhà cung cấp AI trả về dữ liệu không hợp lệ.", { code: "AI_INVALID_JSON" })
  }
}

export { extractJSON, stripThoughts }
