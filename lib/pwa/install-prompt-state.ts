import { createPromptSchedule } from "./prompt-schedule"

/** The "add to Home Screen" dialog: snoozed 3 days, then 14, then never asked again. */
const schedule = createPromptSchedule("yeahbuddy:install-prompt", [3, 14])

const canShowInstallPrompt = schedule.canShow
const snoozeInstallPrompt = schedule.snooze
/** Installed, or the user asked not to be reminded. */
const stopAskingForInstallPrompt = schedule.stop

export { canShowInstallPrompt, snoozeInstallPrompt, stopAskingForInstallPrompt }
