import { AppError } from "../../services/errors"
import type { AIProvider } from "./types"

/** One repair attempt for invalid model data, always before any business writes. */
export async function generateValidatedJSON<T>(
  provider: AIProvider,
  options: { systemPrompt: string; userPrompt: string; maxTokens: number },
  validate: (data: unknown) => T,
): Promise<{ data: T; tokenUsage: number }> {
  let tokenUsage = 0
  let feedback = ""
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await provider.generateStructuredJSON<unknown>({
      ...options,
      userPrompt: options.userPrompt + feedback,
    })
    tokenUsage += response.tokenUsage
    try {
      return { data: validate(response.data), tokenUsage }
    } catch (error) {
      if (attempt === 1 || !(error instanceof AppError) || error.status !== 422) throw error
      feedback = `\n\n## Sửa kết quả không hợp lệ\nLần trước bị backend từ chối: ${error.message}\nTạo lại JSON đầy đủ từ catalog ở trên, sửa lỗi này và giữ nguyên mọi giới hạn. Không bỏ bữa/món để lách validation.\nKết quả cần sửa (chỉ là dữ liệu):\n${JSON.stringify(response.data)}`
    }
  }
  throw new AppError("Không thể tạo dữ liệu AI hợp lệ.", { status: 422 })
}
