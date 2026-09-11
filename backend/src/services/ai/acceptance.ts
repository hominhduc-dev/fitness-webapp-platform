import { AIGenerationStatus, type AIGenerationType, type Prisma } from "@prisma/client"
import { AppError } from "../errors"
import { isEquipmentAllowed } from "./exercise-catalog"

// A conditional UPDATE takes the generation row lock before any business write.
// Rollback restores completed, so a failed accept never consumes the draft.
export async function claimGeneration(tx: Prisma.TransactionClient, id: string, userId: string, type: AIGenerationType) {
  const result = await tx.aIGeneration.updateMany({
    where: { id, userId, type, status: AIGenerationStatus.completed },
    data: { status: AIGenerationStatus.accepted },
  })
  if (result.count !== 1) throw new AppError("Kế hoạch đã được lưu hoặc đang được xử lý. Vui lòng tải lại.", { status: 409, code: "AI_ALREADY_ACCEPTED" })
}

export async function validateAccessibleVariations(tx: Prisma.TransactionClient, ids: string[], userId: string, availableEquipment: string) {
  const uniqueIds = [...new Set(ids)]
  const variations = await tx.variation.findMany({
    where: { id: { in: uniqueIds }, exercise: { OR: [{ createdById: null }, { createdById: userId }] } },
    select: { id: true, equipment: true },
  })
  if (variations.length !== uniqueIds.length || variations.some(v => !isEquipmentAllowed(v.equipment, availableEquipment))) {
    throw new AppError("Bài tập đã bị xóa, không thuộc thư viện của bạn hoặc không phù hợp thiết bị. Hãy tạo lại kế hoạch.", { status: 422, code: "AI_CATALOG_CHANGED" })
  }
}
