import type { SerializedProfile } from "../../auth.service"
import { createSection, formatNumber } from "./helpers"
import type { ContextSection } from "./types"

export function buildProfileContext(profile: SerializedProfile): ContextSection | null {
  const goals = profile.fitnessGoals?.length ? profile.fitnessGoals.join(", ") : "Chưa cập nhật"
  const lines = [
    `- Tên: ${profile.name || "Trainee"}`,
    `- Mục tiêu fitness: ${goals}`,
    `- Chiều cao: ${profile.heightCm ? `${formatNumber(profile.heightCm, 1)}cm` : "Chưa cập nhật"}`,
    `- Cân nặng mục tiêu: ${profile.targetWeightKg ? `${formatNumber(profile.targetWeightKg, 1)}kg` : "Chưa cập nhật"}`,
    `- Đơn vị tạ ưu tiên: ${profile.preferredWeightUnit ?? "kg"}`,
    `- Mục tiêu ngày: ${profile.dailyCalorieGoal} kcal, P ${profile.dailyProteinGoal}g / C ${profile.dailyCarbsGoal}g / F ${profile.dailyFatGoal}g`,
    `- Dị ứng thực phẩm: ${profile.foodAllergies?.length ? profile.foodAllergies.join(", ") : "Không khai báo"}`,
    `- Chế độ ăn: ${profile.dietType === "vegetarian" ? "Ăn chay" : profile.dietType === "pescatarian" ? "Không ăn thịt (được ăn cá)" : "Bình thường"}`,
  ]

  return createSection("profile", "USER PROFILE", 100, lines)
}
