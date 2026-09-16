import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { claimOAuthRoleRequest } from "@/lib/auth/api"
import { getSupabasePublicConfig } from "@/lib/supabase/config"

function sanitizeNextPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/")) {
    return "/dashboard"
  }

  return nextPath
}

export async function GET(request: NextRequest) {
  const { publishableKey, url } = getSupabasePublicConfig()
  const code = request.nextUrl.searchParams.get("code")
  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"))
  // Google carries no role of ours, so a coach signup says so on the callback
  // URL it sent the user out with.
  const isCoachSignup = request.nextUrl.searchParams.get("role") === "coach"
  const redirectUrl = new URL(nextPath, request.url)
  let response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        response = NextResponse.redirect(redirectUrl)

        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  if (!code) {
    const loginUrl = new URL("/", request.url)
    loginUrl.searchParams.set("auth", "login")
    loginUrl.searchParams.set("error", "missing_code")
    return NextResponse.redirect(loginUrl)
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const loginUrl = new URL("/", request.url)
    loginUrl.searchParams.set("auth", "login")
    loginUrl.searchParams.set("error", "auth_callback_failed")
    return NextResponse.redirect(loginUrl)
  }

  if (isCoachSignup) {
    return finishCoachSignup(request, supabase, response, data.session?.access_token)
  }

  return response
}

/**
 * Turns the fresh OAuth account into a pending coach and ends the browser
 * session: the account is locked until an admin approves it, so leaving the
 * cookies in place would only bounce the visitor between guarded pages.
 */
async function finishCoachSignup(
  request: NextRequest,
  supabase: ReturnType<typeof createServerClient>,
  sessionResponse: NextResponse,
  accessToken?: string,
) {
  const destination = new URL("/coach-signup", request.url)

  try {
    if (!accessToken) {
      throw new Error("missing_session")
    }

    const claim = await claimOAuthRoleRequest(accessToken, "coach")

    // An account that already exists keeps whatever role it had, so let it
    // through to the app instead of stranding it on the signup page.
    if (!claim.requiresApproval) {
      return sessionResponse
    }

    destination.searchParams.set("status", "pending")
  } catch {
    destination.searchParams.set("error", "oauth_claim_failed")
  }

  // A failed revoke must not turn the callback into a 500: worst case the
  // stale cookies get the visitor bounced to sign-in on their next page.
  await supabase.auth.signOut().catch(() => undefined)

  const finalResponse = NextResponse.redirect(destination)

  // signOut() writes its cookie removals onto the response the cookie adapter
  // rebuilt, so carry them over rather than returning a response without them.
  sessionResponse.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie)
  })

  return finalResponse
}
