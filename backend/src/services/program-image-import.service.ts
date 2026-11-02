import { ExerciseShareStatus } from "@prisma/client"

import { getAIProvider } from "../lib/ai/ai-client"
import type { AIImageInput } from "../lib/ai/types"
import { DailyCounter } from "./ai/daily-counter"
import { importProgramFromImages, type ImportedProgram } from "./ai/program-image-import"
import type { SerializedProfile } from "./auth.service"
import { AppError, AuthServiceError, TooManyRequestsError } from "./errors"
import { buildVariationDisplayName } from "./fitness-data/core"
import { assertCoach, ensurePrisma } from "./fitness-data/shared/guards"

/** Each import is two model calls, one of them reading images: generous, but bounded. */
const imageImportCounter = new DailyCounter(20)

type ProgramImageImportResponse = Omit<ImportedProgram, "promptVersion" | "tokenUsage">

/**
 * Turns photos of a program into a draft for the coach's import review. Nothing
 * is saved: the coach checks the sessions and exercises, picks a library
 * exercise for any row that found none, and creates the program from there.
 */
async function importCoachProgramFromImages(
  coach: SerializedProfile,
  input: { images: AIImageInput[]; locale?: "vi" | "en" },
): Promise<ProgramImageImportResponse> {
  assertCoach(coach)
  if (!imageImportCounter.tryConsume(coach.id)) {
    throw new TooManyRequestsError(`Bạn đã tạo bài tập từ ảnh ${imageImportCounter.max} lần hôm nay. Vui lòng thử lại vào ngày mai.`)
  }

  try {
    const db = ensurePrisma()
    // The same library the coach picks from in the exercise picker: system
    // exercises, ones other coaches shared, and the coach's own.
    const exercises = await db.exercise.findMany({
      select: {
        name: true,
        variations: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { displayMetadata: true, equipment: true, id: true, isDefault: true, name: true },
        },
      },
      where: { OR: [{ createdById: null }, { shareStatus: ExerciseShareStatus.shared }, { createdById: coach.id }] },
    })
    const library = exercises.flatMap((exercise) =>
      exercise.variations.map((variation) => ({
        displayName: buildVariationDisplayName({
          exerciseName: exercise.name,
          isDefault: variation.isDefault,
          metadata: variation.displayMetadata,
          variationName: variation.name,
        }),
        equipment: variation.equipment,
        exerciseName: exercise.name,
        variationId: variation.id,
        variationName: variation.name,
      })),
    )

    const { promptVersion: _promptVersion, tokenUsage: _tokenUsage, ...result } = await importProgramFromImages(getAIProvider(), {
      images: input.images,
      library,
      locale: input.locale ?? "vi",
    })
    if (result.workouts.length === 0) {
      throw new AppError("Không tìm thấy bài tập nào trong ảnh. Hãy chụp rõ bảng chương trình tập (tên bài, số set, rep).", {
        code: "NO_PROGRAM_IN_IMAGE",
        status: 422,
      })
    }
    return result
  } catch (error) {
    // An attempt that produced nothing usable does not use up the coach's budget.
    imageImportCounter.release(coach.id)
    if (error instanceof AppError) throw error
    const providerRateLimited = error instanceof Error && /\b429\b/.test(error.message)
    if (providerRateLimited) throw new TooManyRequestsError("Dịch vụ AI đang bận. Vui lòng thử lại sau ít phút.")
    throw new AuthServiceError("Không thể đọc chương trình từ ảnh. Vui lòng thử lại sau.", 500)
  }
}

export { importCoachProgramFromImages, type ProgramImageImportResponse }
