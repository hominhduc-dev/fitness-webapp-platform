import { z } from "zod"

import { AppError } from "../services/errors"

/** Mirrors the `MovementPattern` Prisma enum; order is the display order. */
const MOVEMENT_PATTERNS = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "core",
  "isolation",
  "cardio",
  "mobility",
  "other",
] as const

type MovementPatternValue = (typeof MOVEMENT_PATTERNS)[number]

const movementPatternSchema = z.enum(MOVEMENT_PATTERNS)

/** One line per pattern, shared by every prompt that asks a model to pick one. */
const MOVEMENT_PATTERN_GUIDE = `- horizontal_push: đẩy ra trước (bench press, push-up, chest press, floor press).
- vertical_push: đẩy theo phương dọc (overhead press, handstand push-up, dips).
- horizontal_pull: kéo về phía thân (row các loại, face pull, reverse fly).
- vertical_pull: kéo từ trên xuống (pull-up, chin-up, lat pulldown).
- squat: gập gối + hông, hai chân cùng lúc, gối là chính (squat, leg press, hack squat, goblet squat).
- hinge: gập hông, gối ít (deadlift, RDL, hip thrust, good morning, kettlebell swing, back extension).
- lunge: một chân hoặc tư thế so le (lunge, split squat, step-up, pistol squat).
- carry: mang vác đi bộ (farmer's walk, suitcase carry).
- core: bụng/thân trên chống duỗi, xoay, gập (plank, crunch, ab wheel, pallof press, leg raise).
- isolation: một khớp cho một nhóm cơ nhỏ (curl, triceps extension, lateral raise, leg extension, leg curl, calf raise, fly).
- cardio: đơn điệu sức bền (chạy, đạp xe, chèo, nhảy dây, burpee).
- mobility: giãn cơ, linh hoạt, khởi động.
- other: không thuộc các nhóm trên (kỹ thuật thể thao, olympic lift tổng hợp khó phân loại).`

/** Optional/nullable on writes: `undefined` leaves it unchanged, `null` clears it. */
function parseMovementPatternInput(value: unknown): MovementPatternValue | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null

  const result = movementPatternSchema.safeParse(value)
  if (!result.success) {
    throw new AppError("Movement pattern không hợp lệ.", { code: "INVALID_MOVEMENT_PATTERN", status: 400 })
  }
  return result.data
}

export {
  MOVEMENT_PATTERN_GUIDE,
  MOVEMENT_PATTERNS,
  movementPatternSchema,
  parseMovementPatternInput,
  type MovementPatternValue,
}
