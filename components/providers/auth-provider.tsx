"use client"

import type { AuthChangeEvent, Session } from "@supabase/supabase-js"

import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState } from "react"

import { useQueryClient } from "@tanstack/react-query"

import { fetchCurrentProfile } from "@/lib/auth/api"
import type { AppProfile, UpdateProfileInput, UploadAvatarInput } from "@/lib/auth/types"
import { getOptionalBrowserSupabaseClient } from "@/lib/supabase/client"
import { useCurrentProfile, useUpdateProfile, useUploadAvatar } from "@/lib/queries/profile"
import { userQueryKey } from "@/lib/queries/scoped"
import { queryKeys } from "@/lib/queries/keys"

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
  const accountRef = useRef<string | null>(initialProfile?.supabaseAuthUserId ?? null)
  const revisionRef = useRef(0)
  const profileQuery = useCurrentProfile(profile, Boolean(session))
  const updateMutation = useUpdateProfile()
  const avatarMutation = useUploadAvatar()

  // Memoized because it now closes over the query client, which makes it a
  // reactive value for the auth-state effect below. The client is a singleton,
  // so the identity is stable and the effect still runs once.
  const syncProfile = useCallback(async function syncProfile(nextSession: Session | null) {
    const account = nextSession?.user.id ?? null
    if (accountRef.current !== account) {
      accountRef.current = account
      revisionRef.current += 1
      queryClient.clear()
      setProfile(null)
    }
    const revision = revisionRef.current
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
      const nextProfile = await queryClient.fetchQuery({
        queryKey: ["profile", "bootstrap", account],
        queryFn: () => fetchCurrentProfile(nextSession.access_token),
        // Bootstrap must not overwrite a newer profile mutation with its old
        // cached snapshot when SIGNED_IN is emitted again for this account.
        staleTime: 0,
      })
      if (revision !== revisionRef.current) return null
      if (nextProfile) queryClient.setQueryData(userQueryKey(queryKeys.profile.current(), nextProfile.id), nextProfile)

      startTransition(() => {
        setSession(nextSession)
        setProfile(nextProfile)
        setIsLoading(false)
      })

      return nextProfile
    } catch {
      if (revision !== revisionRef.current) return null
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
        if (initialProfile.supabaseAuthUserId && initialProfile.supabaseAuthUserId !== initialSession.user.id) {
          await syncProfile(initialSession)
          return
        }
        accountRef.current = initialSession.user.id
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

      if (event === "TOKEN_REFRESHED" && accountRef.current === nextSession?.user.id) {
        setSession(nextSession)
        return
      }

      if (event === "INITIAL_SESSION" && nextSession?.access_token && initialProfile) {
        if (initialProfile.supabaseAuthUserId && initialProfile.supabaseAuthUserId !== nextSession.user.id) {
          setTimeout(() => { if (!cancelled) void syncProfile(nextSession) }, 0)
          return
        }
        accountRef.current = nextSession.user.id
        startTransition(() => {
          setSession(nextSession)
          setProfile(initialProfile)
          setIsLoading(false)
        })

        return
      }

      // Do not enter Supabase getSession from inside its auth callback lock.
      if (accountRef.current !== (nextSession?.user.id ?? null)) {
        revisionRef.current += 1
        accountRef.current = nextSession?.user.id ?? null
        queryClient.clear()
        setProfile(null)
      }
      setTimeout(() => { if (!cancelled) void syncProfile(nextSession) }, 0)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [initialProfile, syncProfile, queryClient])

  async function refreshProfile() {
    const supabase = getOptionalBrowserSupabaseClient()

    if (!supabase) {
      return null
    }

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()

    if (profile?.id && currentSession?.user.id === accountRef.current) {
      return (await profileQuery.refetch()).data ?? null
    }
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

    const revision = revisionRef.current
    const response = await updateMutation.mutateAsync(input)
    if (revision !== revisionRef.current) return null
    if (response.profile) queryClient.setQueryData(userQueryKey(queryKeys.profile.current(), response.profile.id), response.profile)
    void queryClient.invalidateQueries({ queryKey: queryKeys.meals.all })

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

    const revision = revisionRef.current
    const response = await avatarMutation.mutateAsync(input)
    if (revision !== revisionRef.current) return null
    if (response.profile) queryClient.setQueryData(userQueryKey(queryKeys.profile.current(), response.profile.id), response.profile)

    startTransition(() => {
      setProfile(response.profile)
    })

    return response.profile
  }

  async function signOut() {
    revisionRef.current += 1
    accountRef.current = null
    queryClient.clear()
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
        profile: profile ? profileQuery.data ?? profile : null,
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
