export const MIN_SAFE_DAILY_CALORIES = 1200
export const UNSAFE_CALORIE_GOAL_CODE = "AI_CALORIE_GOAL_UNSAFE"
export const UNSAFE_CALORIE_GOAL_MESSAGE =
  "Mục tiêu calories hiện tại quá thấp để lên thực đơn an toàn. Hãy cập nhật lại mục tiêu hoặc trao đổi với chuyên gia dinh dưỡng."

export function isUnsafeDailyCalorieGoal(value: number | null | undefined) {
  return value != null && value < MIN_SAFE_DAILY_CALORIES
}
