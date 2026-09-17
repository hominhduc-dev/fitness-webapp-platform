type BadgeNavigator = Navigator & {
  clearAppBadge?: () => Promise<void>
  setAppBadge?: (contents?: number) => Promise<void>
}

async function setAppBadge(unreadCount: number) {
  if (typeof navigator === "undefined") return
  const badgeNavigator = navigator as BadgeNavigator

  try {
    if (unreadCount > 0 && badgeNavigator.setAppBadge) {
      await badgeNavigator.setAppBadge(unreadCount)
    } else if (unreadCount === 0 && badgeNavigator.clearAppBadge) {
      await badgeNavigator.clearAppBadge()
    }
  } catch {
    // Badging is progressive enhancement and may be denied independently.
  }
}

export { setAppBadge }
