const DASHBOARD_REFRESH_STORAGE_KEY = "fitness-dashboard-refresh"

function hasSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined"
}

export function markDashboardForRefresh() {
  if (!hasSessionStorage()) {
    return
  }

  window.sessionStorage.setItem(DASHBOARD_REFRESH_STORAGE_KEY, "1")
}

export function consumeDashboardRefreshFlag() {
  if (!hasSessionStorage()) {
    return false
  }

  const shouldRefresh = window.sessionStorage.getItem(DASHBOARD_REFRESH_STORAGE_KEY) === "1"

  if (shouldRefresh) {
    window.sessionStorage.removeItem(DASHBOARD_REFRESH_STORAGE_KEY)
  }

  return shouldRefresh
}
