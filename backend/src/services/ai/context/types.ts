import type { SerializedProfile } from "../../auth.service"

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type AIChatIntent =
  | "workout_today"
  | "program_review"
  | "exercise_progression"
  | "nutrition_today"
  | "nutrition_trend"
  | "weight_progress"
  | "coach_feedback"
  | "general_fitness"

export type IntentResult = {
  intent: AIChatIntent
  reason: string
  score: number
}

export type ContextSectionKey =
  | "profile"
  | "program"
  | "recent_workouts"
  | "progression"
  | "nutrition"
  | "body_metrics"
  | "coach_notes"

export type ContextSection = {
  content: string
  key: ContextSectionKey
  priority: number
  title: string
  tokenEstimate: number
}

export type TraineeChatContext = {
  intent: AIChatIntent
  intentReason: string
  maxTokens: number
  promptContext: string
  sections: ContextSection[]
}

export type ContextBuilderInput = {
  history?: ChatMessage[]
  maxContextTokens?: number
  message: string
  now?: Date
  profile: SerializedProfile
}
