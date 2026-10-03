/**
 * Keeps AI commentary in the reader's language.
 *
 * Food, nutrient and exercise names, codes and numbers in the prompt data are
 * often English, so the model drifts into English. The rule goes last in the
 * system prompt, and the output is checked so a slip is sent back once.
 */
import { AppError } from "../errors"

type InsightLocale = "vi" | "en"

/** Letters only Vietnamese uses; tone marks on a bare vowel are left out because French names have them too. */
const VIETNAMESE_LETTERS = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i
/** Any Vietnamese diacritic, for telling a Vietnamese sentence from an English one. */
const VIETNAMESE_MARKS = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i

/**
 * Throws a 422 (which `generateValidatedJSON` answers with one repair round)
 * unless `summary` and most of `texts` are in `locale`. A stray Vietnamese
 * food or exercise name inside English text is fine.
 */
function assertInsightLanguage(summary: string, texts: string[], locale: InsightLocale) {
  const all = [summary, ...texts]
  const inVietnamese = all.filter((text) => (locale === "vi" ? VIETNAMESE_MARKS : VIETNAMESE_LETTERS).test(text))
  const wrong =
    locale === "vi"
      ? !VIETNAMESE_MARKS.test(summary) || inVietnamese.length < all.length / 2
      : VIETNAMESE_LETTERS.test(summary) || inVietnamese.length > all.length / 2
  if (wrong) {
    throw new AppError(
      locale === "vi"
        ? "Dữ liệu AI không hợp lệ: nội dung phải viết bằng tiếng Việt có dấu, không dùng tiếng Anh."
        : "Dữ liệu AI không hợp lệ: nội dung phải viết bằng tiếng Anh (English), không dùng tiếng Việt.",
      { code: "AI_VALIDATION_ERROR", status: 422 },
    )
  }
}

/** The closing section of a system prompt; `fields` names what must follow it, e.g. "summary và mọi point". */
function languageRule(locale: InsightLocale, fields: { en: string; vi: string }) {
  return locale === "en"
    ? `## Ngôn ngữ\nWrite ${fields.en} in English only.`
    : `## Ngôn ngữ\nViết ${fields.vi} hoàn toàn bằng tiếng Việt có dấu. Giữ nguyên tên riêng và con số, nhưng câu văn không được viết bằng tiếng Anh.`
}

export { assertInsightLanguage, languageRule, type InsightLocale }
