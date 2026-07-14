import type { SerializedProfile } from "../../auth.service"
import { buildBodyMetricContext } from "./body-metric-context"
import { buildCoachNoteContext } from "./coach-note-context"
import { ensureContextPrisma } from "./helpers"
import { detectAIChatIntent } from "./intent"
import { buildNutritionContext } from "./nutrition-context"
import { buildProfileContext } from "./profile-context"
import { buildProgramContext } from "./program-context"
import { buildProgressionContext } from "./progression-context"
import type { AIChatIntent, ContextBuilderInput, ContextSection, ContextSectionKey, TraineeChatContext } from "./types"
import { buildWorkoutContext } from "./workout-context"

type SectionFactory = () => Promise<ContextSection | null> | ContextSection | null

const DEFAULT_CONTEXT_TOKEN_BUDGET = 2200

const INTENT_SECTION_PLAN: Record<AIChatIntent, ContextSectionKey[]> = {
  coach_feedback: ["profile", "coach_notes", "recent_workouts", "body_metrics", "nutrition"],
  exercise_progression: ["profile", "progression", "recent_workouts", "program", "body_metrics"],
  general_fitness: ["profile", "recent_workouts", "nutrition", "body_metrics", "progression"],
  nutrition_today: ["profile", "nutrition", "body_metrics", "recent_workouts"],
  nutrition_trend: ["profile", "nutrition", "body_metrics", "recent_workouts"],
  program_review: ["profile", "program", "recent_workouts", "progression", "body_metrics"],
  weight_progress: ["profile", "body_metrics", "nutrition", "recent_workouts", "progression"],
  workout_today: ["profile", "recent_workouts", "program", "progression", "body_metrics"],
}

export async function buildTraineeChatContext(input: ContextBuilderInput): Promise<TraineeChatContext> {
  const db = ensureContextPrisma()
  const now = input.now ?? new Date()
  const maxTokens = input.maxContextTokens ?? DEFAULT_CONTEXT_TOKEN_BUDGET
  const intent = detectAIChatIntent(input.message, input.history ?? [])
  const factories = buildSectionFactories(db, input.profile, now)
  const plannedKeys = INTENT_SECTION_PLAN[intent.intent]
  const plannedSections = await Promise.all(plannedKeys.map((key) => factories[key]()))
  const sections = selectContextSections(
    plannedSections.filter((section): section is ContextSection => Boolean(section)),
    maxTokens,
  )

  return {
    intent: intent.intent,
    intentReason: intent.reason,
    maxTokens,
    promptContext: formatSectionsForPrompt(sections),
    sections,
  }
}

function buildSectionFactories(
  db: ReturnType<typeof ensureContextPrisma>,
  profile: SerializedProfile,
  now: Date,
): Record<ContextSectionKey, SectionFactory> {
  return {
    body_metrics: () => buildBodyMetricContext(db, profile, now),
    coach_notes: () => buildCoachNoteContext(db, profile, now),
    nutrition: () => buildNutritionContext(db, profile, now),
    profile: () => buildProfileContext(profile),
    program: () => buildProgramContext(db, profile),
    progression: () => buildProgressionContext(db, profile, now),
    recent_workouts: () => buildWorkoutContext(db, profile, now),
  }
}

function selectContextSections(sections: ContextSection[], maxTokens: number) {
  const ordered = sections.slice().sort((a, b) => b.priority - a.priority)
  const selected: ContextSection[] = []
  let usedTokens = 0

  for (const section of ordered) {
    if (selected.length === 0 || usedTokens + section.tokenEstimate <= maxTokens) {
      selected.push(section)
      usedTokens += section.tokenEstimate
    }
  }

  return selected.sort((a, b) => b.priority - a.priority)
}

function formatSectionsForPrompt(sections: ContextSection[]) {
  if (sections.length === 0) {
    return "- Không có dữ liệu context phù hợp. Nếu cần dữ liệu cá nhân hoá, hãy nói rõ dữ liệu đang thiếu."
  }

  return sections.map((section) => `${section.title}\n${section.content}`).join("\n\n")
}
