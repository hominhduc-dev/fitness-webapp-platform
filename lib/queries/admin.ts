"use client"

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query"
import * as api from "@/lib/admin/api"
import { queryKeys } from "@/lib/queries/keys"
import { useUserQuery } from "@/lib/queries/scoped"
import { requireAccessToken } from "@/lib/queries/token"

type Result<F extends (...args: never[]) => unknown> = Awaited<ReturnType<F>>
type Args<F> = F extends (token: string, ...args: infer A) => unknown ? A : never

export function useAdminDashboard(initialData?: Result<typeof api.fetchAdminDashboard>) {
  return useUserQuery<Result<typeof api.fetchAdminDashboard>>({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: async () => api.fetchAdminDashboard(await requireAccessToken()),
    initialData,
    staleTime: 30_000,
  })
}

export function useAdminUsers(options?: Args<typeof api.fetchAdminUsers>[0], initialData?: Result<typeof api.fetchAdminUsers>) {
  return useUserQuery<Result<typeof api.fetchAdminUsers>>({
    queryKey:  [...queryKeys.admin.users(), options ?? {}],
    queryFn: async () => api.fetchAdminUsers(await requireAccessToken(), options),
    initialData,
    staleTime: 30_000,
  })
}

export function useAdminUserDetail(userId: string, initialData?: Result<typeof api.fetchAdminUserDetail>) {
  return useUserQuery<Result<typeof api.fetchAdminUserDetail>>({
    queryKey: queryKeys.admin.userDetail(userId),
    queryFn: async () => api.fetchAdminUserDetail(await requireAccessToken(), userId),
    initialData,
    staleTime: 30_000,
    enabled: Boolean(userId),
  })
}

export function useAdminCoachRequests(options?: Args<typeof api.fetchAdminCoachRequests>[0], initialData?: Result<typeof api.fetchAdminCoachRequests>) {
  return useUserQuery<Result<typeof api.fetchAdminCoachRequests>>({
    queryKey:  [...queryKeys.admin.coachRequests(), options ?? {}],
    queryFn: async () => api.fetchAdminCoachRequests(await requireAccessToken(), options),
    initialData,
    staleTime: 30_000,
  })
}

export function useAdminConnections(options?: Args<typeof api.fetchAdminConnections>[0], initialData?: Result<typeof api.fetchAdminConnections>) {
  return useUserQuery<Result<typeof api.fetchAdminConnections>>({
    queryKey:  [...queryKeys.admin.connections(), options ?? {}],
    queryFn: async () => api.fetchAdminConnections(await requireAccessToken(), options),
    initialData,
    staleTime: 30_000,
  })
}

export function useAdminPrograms(options?: Args<typeof api.fetchAdminPrograms>[0], initialData?: Result<typeof api.fetchAdminPrograms>) {
  return useUserQuery<Result<typeof api.fetchAdminPrograms>>({
    queryKey:  [...queryKeys.admin.programs(), options ?? {}],
    queryFn: async () => api.fetchAdminPrograms(await requireAccessToken(), options),
    initialData,
    staleTime: 30_000,
  })
}

export function useAdminExercises(options?: Args<typeof api.fetchAdminExercises>[0], initialData?: Result<typeof api.fetchAdminExercises>) {
  return useUserQuery<Result<typeof api.fetchAdminExercises>>({
    queryKey:  [...queryKeys.admin.exercises(), options ?? {}],
    queryFn: async () => api.fetchAdminExercises(await requireAccessToken(), options),
    initialData,
    staleTime: 30_000,
  })
}

export function useAdminExerciseImportRequests(options?: Args<typeof api.fetchAdminExerciseImportRequests>[0], initialData?: Result<typeof api.fetchAdminExerciseImportRequests>) {
  return useUserQuery<Result<typeof api.fetchAdminExerciseImportRequests>>({
    queryKey:  [...queryKeys.admin.exerciseImportRequests(), options ?? null],
    queryFn: async () => api.fetchAdminExerciseImportRequests(await requireAccessToken(), options),
    initialData,
    staleTime: 30_000,
  })
}

export function useAdminAuditLogs(options?: Args<typeof api.fetchAdminAuditLogs>[0], initialData?: Result<typeof api.fetchAdminAuditLogs>) {
  return useUserQuery<Result<typeof api.fetchAdminAuditLogs>>({
    queryKey:  [...queryKeys.admin.auditLogs(), options ?? {}],
    queryFn: async () => api.fetchAdminAuditLogs(await requireAccessToken(), options),
    initialData,
    staleTime: 30_000,
  })
}

function useAdminMutation<A extends unknown[], T>(fn: (token: string, ...args: A) => Promise<T>, domains: readonly QueryKey[]) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (args: A) => fn(await requireAccessToken(), ...args),
    onSuccess: async () => {
      await Promise.all(domains.map((queryKey) => client.invalidateQueries({ queryKey })))
    },
  })
}

export function useAssignAdminCoachConnection() {
  return useAdminMutation(api.assignAdminCoachConnection, [queryKeys.admin.all, queryKeys.coach.all, queryKeys.workouts.all, queryKeys.profile.all])
}

export function useBulkApproveAdminMuscleProfilesRequest() {
  return useAdminMutation(api.bulkApproveAdminMuscleProfilesRequest, [queryKeys.admin.all, queryKeys.exercises.all, queryKeys.coach.all, queryKeys.workouts.all])
}

export function useBulkDeleteAdminExercisesRequest() {
  return useAdminMutation(api.bulkDeleteAdminExercisesRequest, [queryKeys.admin.all, queryKeys.exercises.all, queryKeys.coach.all, queryKeys.workouts.all])
}

export function useCreateAdminExerciseRequest() {
  return useAdminMutation(api.createAdminExerciseRequest, [queryKeys.admin.all, queryKeys.exercises.all, queryKeys.coach.all, queryKeys.workouts.all])
}

export function useDeleteAdminCoachRequestRequest() {
  return useAdminMutation(api.deleteAdminCoachRequestRequest, [queryKeys.admin.all, queryKeys.coach.all, queryKeys.workouts.all, queryKeys.profile.all])
}

export function useDeleteAdminExerciseGroupRequest() {
  return useAdminMutation(api.deleteAdminExerciseGroupRequest, [queryKeys.admin.all, queryKeys.exercises.all, queryKeys.coach.all, queryKeys.workouts.all])
}

export function useDeleteAdminExerciseRequest() {
  return useAdminMutation(api.deleteAdminExerciseRequest, [queryKeys.admin.all, queryKeys.exercises.all, queryKeys.coach.all, queryKeys.workouts.all])
}

export function useDeleteAdminProgramRequest() {
  return useAdminMutation(api.deleteAdminProgramRequest, [queryKeys.admin.all, queryKeys.coach.all, queryKeys.workouts.all, queryKeys.profile.all])
}

export function useApplyExerciseSyncRequest() {
  return useAdminMutation(api.applyExerciseSyncRequest, [queryKeys.admin.all, queryKeys.exercises.all, queryKeys.coach.all, queryKeys.workouts.all])
}

export function useImportAdminExercisesRequest() {
  return useAdminMutation(api.importAdminExercisesRequest, [queryKeys.admin.all, queryKeys.exercises.all, queryKeys.coach.all, queryKeys.workouts.all])
}

export function usePreviewExerciseSyncRequest() {
  return useAdminMutation(api.previewExerciseSyncRequest, [])
}

export function useRemoveAdminCoachConnection() {
  return useAdminMutation(api.removeAdminCoachConnection, [queryKeys.admin.all, queryKeys.coach.all, queryKeys.workouts.all, queryKeys.profile.all])
}

export function useResetAdminUserPasswordRequest() {
  return useAdminMutation(api.resetAdminUserPasswordRequest, [queryKeys.admin.all])
}

export function useReviewAdminExerciseImportRequest() {
  return useAdminMutation(api.reviewAdminExerciseImportRequest, [queryKeys.admin.all, queryKeys.exercises.all, queryKeys.coach.all, queryKeys.workouts.all])
}

export function useUpdateAdminCoachRequestStatus() {
  return useAdminMutation(api.updateAdminCoachRequestStatus, [queryKeys.admin.all, queryKeys.coach.all, queryKeys.workouts.all, queryKeys.profile.all])
}

export function useUpdateAdminExerciseRequest() {
  return useAdminMutation(api.updateAdminExerciseRequest, [queryKeys.admin.all, queryKeys.exercises.all, queryKeys.coach.all, queryKeys.workouts.all])
}

export function useUpdateAdminUserRequest() {
  return useAdminMutation(api.updateAdminUserRequest, [queryKeys.admin.all, queryKeys.coach.all, queryKeys.workouts.all, queryKeys.profile.all])
}
