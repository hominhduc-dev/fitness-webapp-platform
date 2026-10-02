import { createPromptSchedule, type PromptScheduleState } from "./prompt-schedule"

/**
 * The Web Push soft-ask: snoozed 3 days, then 14, then never asked again.
 * Browsers treat repeated soft-asks as spam.
 */
const schedule = createPromptSchedule("yeahbuddy:push-prompt", [3, 14])

const canShowPushPrompt = schedule.canShow
const snoozePushPrompt = schedule.snooze
/** Settles the question for good — the user granted or blocked notifications. */
const stopAskingForPushPrompt = schedule.stop
const resetPushPrompt = schedule.reset

type PushPromptState = PromptScheduleState

export { canShowPushPrompt, resetPushPrompt, snoozePushPrompt, stopAskingForPushPrompt }
export type { PushPromptState }
