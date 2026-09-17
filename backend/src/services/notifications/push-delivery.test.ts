import { NotificationType, type Notification } from "@prisma/client"
import { describe, expect, it } from "vitest"

import { notificationPushTag, retryAt } from "./push-delivery.service"

describe("push delivery helpers", () => {
  it("uses stable tags so a repeated reminder replaces the previous device notification", () => {
    const notification: Pick<Notification, "id" | "metadata" | "relatedEntityId" | "type"> = {
      id: "notification-id",
      metadata: { mealType: "lunch" },
      relatedEntityId: null,
      type: NotificationType.meal_reminder,
    }

    expect(notificationPushTag(notification)).toBe("meal-reminder:lunch")
  })

  it("backs retries off and caps the final delay", () => {
    const now = new Date("2026-09-17T00:00:00.000Z")
    expect(retryAt(1, now).toISOString()).toBe("2026-09-17T00:01:00.000Z")
    expect(retryAt(2, now).toISOString()).toBe("2026-09-17T00:05:00.000Z")
    expect(retryAt(99, now).toISOString()).toBe("2026-09-17T06:00:00.000Z")
  })
})
