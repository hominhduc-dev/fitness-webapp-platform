import { describe, expect, it } from "vitest"

import { getTraineeNavItems, isNavItemActive } from "./shell-nav"
import { getMessages } from "@/lib/i18n/messages"

describe.each(["en", "vi"] as const)("trainee navigation (%s)", (locale) => {
  it("exposes the exercise library without displacing the five mobile destinations", () => {
    const messages = getMessages(locale)
    const items = getTraineeNavItems(messages, { compactLabels: true })

    expect(items.slice(0, 5).map((item) => item.href)).toEqual([
      "/dashboard", "/workout", "/meals", "/progress", "/schedule",
    ])
    expect(items.slice(5)).toContainEqual(expect.objectContaining({
      href: "/exercises", label: messages.shell.exercises,
    }))
    expect(items.filter((item) => item.href === "/exercises")).toHaveLength(1)
  })

  it("recognizes the library as the active page independently of workouts", () => {
    const items = getTraineeNavItems(getMessages(locale))
    const active = items.filter((item) => isNavItemActive("/exercises", item))

    expect(active.map((item) => item.href)).toEqual(["/exercises"])
  })
})
