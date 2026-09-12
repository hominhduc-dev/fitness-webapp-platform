"use client"

import type { AuthChangeEvent, Session } from "@supabase/supabase-js"

import { createContext, startTransition, useCallback, useContext, useEffect, useState } from "react"

import { useQueryClient } from "@tanstack/react-query"

import { fetchCurrentProfile, updateProfileRequest, uploadAvatarRequest } from "@/lib/auth/api"
import type { AppProfile, UpdateProfileInput, UploadAvatarInput } from "@/lib/auth/types"
import { getOptionalBrowserSupabaseClient } from "@/lib/supabase/client"

type AuthContextValue = {
  isLoading: boolean
  profile: AppProfile | null
  refreshProfile: () => Promise<AppProfile | null>
  session: Session | null
  signOut: () => Promise<void>
  uploadAvatar: (input: UploadAvatarInput) => Promise<AppProfile | null>
  updateProfile: (input: UpdateProfileInput) => Promise<AppProfile | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({
  children,
  initialProfile = null,
}: {
  children: React.ReactNode
  initialProfile?: AppProfile | null
}) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AppProfile | null>(initialProfile)
  const [isLoading, setIsLoading] = useState(!initialProfile)

  // Memoized because it now closes over the query client, which makes it a
  // reactive value for the auth-state effect below. The client is a singleton,
  // so the identity is stable and the effect still runs once.
  const syncProfile = useCallback(async function syncProfile(nextSession: Session | null) {
    if (!nextSession?.access_token) {
      // Also covers a SIGNED_OUT broadcast from another tab, where signOut()
      // below never runs. Dropping the cache here stops the next person signing
      // in on this tab from seeing the previous user's data.
      queryClient.clear()

      startTransition(() => {
        setSession(null)
        setProfile(null)
        setIsLoading(false)
      })

      return null
    }

    try {
      const nextProfile = await fetchCurrentProfile(nextSession.access_token)

      startTransition(() => {
        setSession(nextSession)
        setProfile(nextProfile)
        setIsLoading(false)
      })

      return nextProfile
    } catch {
      startTransition(() => {
        setSession(nextSession)
        setProfile(null)
        setIsLoading(false)
      })

      return null
    }
  }, [queryClient])

  useEffect(() => {
    let cancelled = false
    const supabase = getOptionalBrowserSupabaseClient()

    if (!supabase) {
      startTransition(() => {
        setSession(null)
        setProfile(null)
        setIsLoading(false)
      })

      return
    }

    const bootstrap = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession()

      if (cancelled) {
        return
      }

      if (initialSession?.access_token && initialProfile) {
        startTransition(() => {
          setSession(initialSession)
          setProfile(initialProfile)
          setIsLoading(false)
        })

        return
      }

      await syncProfile(initialSession)
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession: Session | null) => {
      if (cancelled) {
        return
      }

      if (event === "INITIAL_SESSION" && nextSession?.access_token && initialProfile) {
        startTransition(() => {
          setSession(nextSession)
          setProfile(initialProfile)
          setIsLoading(false)
        })

        return
      }

      void syncProfile(nextSession)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [initialProfile, syncProfile])

  async function refreshProfile() {
    const supabase = getOptionalBrowserSupabaseClient()

    if (!supabase) {
      return null
    }

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()

    return syncProfile(currentSession)
  }

  async function updateProfile(input: UpdateProfileInput) {
    const supabase = getOptionalBrowserSupabaseClient()

    if (!supabase) {
      throw new Error("Supabase chưa được cấu hình.")
    }

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()

    if (!currentSession?.access_token) {
      throw new Error("Bạn chưa đăng nhập.")
    }

    const response = await updateProfileRequest(currentSession.access_token, input)

    startTransition(() => {
      setProfile(response.profile)
    })

    return response.profile
  }

  async function uploadAvatar(input: UploadAvatarInput) {
    const supabase = getOptionalBrowserSupabaseClient()

    if (!supabase) {
      throw new Error("Supabase chưa được cấu hình.")
    }

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()

    if (!currentSession?.access_token) {
      throw new Error("Bạn chưa đăng nhập.")
    }

    const response = await uploadAvatarRequest(currentSession.access_token, input)

    startTransition(() => {
      setProfile(response.profile)
    })

    return response.profile
  }

  async function signOut() {
    const supabase = getOptionalBrowserSupabaseClient()

    if (supabase) {
      await supabase.auth.signOut({ scope: "local" })
    }

    // clear(), not invalidateQueries(): invalidation keeps the rows resident, so
    // the previous user's screen would render again while refetching.
    queryClient.clear()

    startTransition(() => {
      setSession(null)
      setProfile(null)
      setIsLoading(false)
    })
  }

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        profile,
        refreshProfile,
        session,
        signOut,
        uploadAvatar,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}
