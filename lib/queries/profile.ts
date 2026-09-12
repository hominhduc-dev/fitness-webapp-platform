"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchCurrentProfile, updateProfileRequest, uploadAvatarRequest, resetCurrentTraineeDataRequest } from "@/lib/auth/api"
import type { AppProfile, UpdateProfileInput, UploadAvatarInput } from "@/lib/auth/types"
import { queryKeys } from "./keys"
import { userQueryKey } from "./scoped"
import { requireAccessToken } from "./token"

// Takes the profile explicitly because AuthProvider itself observes this query.
export function useCurrentProfile(profile: AppProfile | null, enabled: boolean) {
  return useQuery({
    queryKey: userQueryKey(queryKeys.profile.current(), profile?.id),
    queryFn: async () => fetchCurrentProfile(await requireAccessToken()),
    initialData: profile ?? undefined,
    enabled: enabled && Boolean(profile?.id),
    staleTime: 300_000,
  })
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => updateProfileRequest(await requireAccessToken(), input),
  })
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: async (input: UploadAvatarInput) => uploadAvatarRequest(await requireAccessToken(), input),
  })
}

export function useResetTraineeData() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => resetCurrentTraineeDataRequest(await requireAccessToken()),
    onSuccess: async () => {
      await Promise.all([queryKeys.progress.all, queryKeys.workouts.all, queryKeys.meals.all, queryKeys.profile.all]
        .map((queryKey) => client.invalidateQueries({ queryKey })))
    },
  })
}
