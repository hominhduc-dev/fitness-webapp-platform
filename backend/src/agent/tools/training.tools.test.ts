import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SerializedProfile } from "../../services/auth.service"
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), recommendation: vi.fn(), recovery: vi.fn() }))
vi.mock("../../services/training-recommendation.service", () => ({ getTrainingRecommendationForTrainee: mocks.recommendation }))
vi.mock("../../services/volume-recovery/volume-recovery.service", () => ({ getVolumeRecoveryForTrainee: mocks.recovery }))
vi.mock("../../services/ai/context/helpers", () => ({ ensureContextPrisma: () => ({ workoutLog: { findMany: mocks.findMany, count: mocks.count } }), parseExerciseSnapshot: () => [] }))
vi.mock("../../services/ai/context/progression-context", () => ({ buildProgressionContext: vi.fn() }))
vi.mock("../../services/ai/context/nutrition-context", () => ({ buildNutritionContext: vi.fn() }))
import { executeTrainingReadTool } from "./training.tools"
const profile = { id: "authenticated-user", role: "trainee" } as SerializedProfile
const call = { id: "call", name: "get_workout_history", arguments: {} }
beforeEach(() => { vi.clearAllMocks(); mocks.findMany.mockResolvedValue([]); mocks.count.mockResolvedValue(0) })
describe("training tool permission boundary", () => {
  it("rejects model-supplied target identity before reading", async () => {
    expect(await executeTrainingReadTool(profile, { ...call, arguments: { userId: "victim" } })).toMatchObject({ code: "INVALID_ARGUMENTS" })
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
  it("rejects non-trainee actors without querying", async () => {
    expect(await executeTrainingReadTool({ ...profile, role: "coach" }, call)).toMatchObject({ code: "FORBIDDEN" })
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
  it("binds every history query to authenticated identity and reports sample limits", async () => {
    mocks.count.mockResolvedValue(31)
    const result = await executeTrainingReadTool(profile, call)
    expect(result).toMatchObject({ ok: true, data: { total: 31, limited: true } })
    expect(mocks.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: profile.id, completedAt: { not: null } }, take: 30 })
    expect(mocks.count.mock.calls[0][0].where.userId).toBe(profile.id)
  })
  it("rejects excessive lookback and invented tools", async () => {
    expect(await executeTrainingReadTool(profile, { ...call, arguments: { days: 999 } })).toMatchObject({ code: "INVALID_ARGUMENTS" })
    expect(await executeTrainingReadTool(profile, { ...call, name: "update_workout_log" })).toMatchObject({ code: "UNKNOWN_TOOL" })
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
  it("returns engine numbers unchanged", async () => {
    mocks.recommendation.mockResolvedValue({ weight: 22, source: "engine" })
    expect(await executeTrainingReadTool(profile, { ...call, name: "get_training_recommendation" })).toMatchObject({ data: { weight: 22, source: "engine" } })
    expect(mocks.recommendation).toHaveBeenCalledWith(profile)
  })
})
