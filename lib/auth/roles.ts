import type { AppRole } from "./types"

function getRoleLandingPath(role?: AppRole | null) {
  switch (role) {
    case "admin":
      return "/admin"
    case "coach":
      return "/coach"
    default:
      return "/dashboard"
  }
}

export { getRoleLandingPath }
