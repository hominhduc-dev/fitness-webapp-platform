"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/queries/keys"
import { requireAccessToken } from "@/lib/queries/token"
import {
  approveTraineeExerciseSwap,
  rejectTraineeExerciseSwap,
  assignCoachProgram,
  createCoachBodyMetric,
  createCoachCheckIn,
  createCoachNote,
  deleteCoachNote,
  updateCoachNote,
  createCoachRequest,
  inviteTrainee,
  unassignCoachProgram,
  updateCoachRequestStatus,
  cancelCoachRequest,
  fetchCoachInvites,
  respondToCoachInvite,
  createCoachTraineeInsight,
  fetchCoachTraineeInsight,
  type CoachInsightWindow,
} from "@/lib/fitness/api"

export function useApproveTraineeExerciseSwap() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) =>
      approveTraineeExerciseSwap(await requireAccessToken(), notificationId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
    },
  })
}

export function useRejectTraineeExerciseSwap() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationId: string) =>
      rejectTraineeExerciseSwap(await requireAccessToken(), notificationId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

export function useAssignCoachProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ programId, traineeId }: { programId: string; traineeId: string }) =>
      assignCoachProgram(await requireAccessToken(), programId, traineeId),
    onSuccess: (_result, { traineeId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.traineeDetail(traineeId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all })
    },
  })
}

export function useUnassignCoachProgram() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ programId, traineeId }: { programId: string; traineeId: string }) =>
      unassignCoachProgram(await requireAccessToken(), programId, traineeId),
    onSuccess: (_result, { traineeId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.traineeDetail(traineeId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all })
    },
  })
}

export function useCreateCoachBodyMetric() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      traineeId,
      input,
    }: {
      traineeId: string
      input: Parameters<typeof createCoachBodyMetric>[2]
    }) => createCoachBodyMetric(await requireAccessToken(), traineeId, input),
    onSuccess: (_result, { traineeId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.bodyMetrics(traineeId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.traineeDetail(traineeId) })
    },
  })
}

export function useCreateCoachCheckIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      traineeId,
      input,
    }: {
      traineeId: string
      input: Parameters<typeof createCoachCheckIn>[2]
    }) => createCoachCheckIn(await requireAccessToken(), traineeId, input),
    onSuccess: (_result, { traineeId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.traineeDetail(traineeId) })
    },
  })
}

export function useCreateCoachRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (coachId: string) => createCoachRequest(await requireAccessToken(), coachId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.discover() })
    },
  })
}

export function useInviteTrainee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (identifier: string) => inviteTrainee(await requireAccessToken(), identifier),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all })
    },
  })
}

export function useUpdateCoachRequestStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: string
      status: "approved" | "rejected"
    }) => updateCoachRequestStatus(await requireAccessToken(), requestId, status),
    onSuccess: () => {
      // Approving a request changes the roster, so the sidebar badge and the
      // trainee list both move. Today the badge never updates after mount.
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all })
    },
  })
}

/** Coaches' invitations waiting on the signed-in trainee; only fetched for trainees. */
export function useCoachInvites(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: async () => fetchCoachInvites(await requireAccessToken()),
    queryKey: queryKeys.coach.invites(),
    staleTime: 60_000,
  })
}

export function useRespondToCoachInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: "approved" | "rejected" }) =>
      respondToCoachInvite(await requireAccessToken(), requestId, status),
    onSuccess: () => {
      // Accepting gives the trainee a coach, which the dashboard and find-coach page both show.
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all })
    },
  })
}

export function useCancelCoachRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (requestId: string) => cancelCoachRequest(await requireAccessToken(), requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.coach.all })
    },
  })
}

/** A coach's private note about a trainee: add, edit or delete. Refreshes the trainee page. */
export function useCoachNoteMutations(traineeId: string) {
  const queryClient = useQueryClient()
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.coach.traineeDetail(traineeId) })

  return {
    create: useMutation({
      mutationFn: async (body: string) => createCoachNote(await requireAccessToken(), traineeId, body),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: async (noteId: string) => deleteCoachNote(await requireAccessToken(), traineeId, noteId),
      onSettled: refresh,
    }),
    update: useMutation({
      mutationFn: async ({ body, noteId }: { body: string; noteId: string }) =>
        updateCoachNote(await requireAccessToken(), traineeId, noteId, body),
      onSettled: refresh,
    }),
  }
}

/** The saved AI report for a trainee and window; reading it never calls the AI. */
export function useCoachTraineeInsight(traineeId: string, days: CoachInsightWindow, locale: "vi" | "en") {
  return useQuery({
    queryFn: async () => fetchCoachTraineeInsight(await requireAccessToken(), traineeId, days, locale),
    queryKey: queryKeys.coach.traineeInsight(traineeId, days, locale),
  })
}

export function useCreateCoachTraineeInsight(traineeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { days: CoachInsightWindow; locale: "vi" | "en" }) =>
      createCoachTraineeInsight(await requireAccessToken(), traineeId, input),
    onSuccess: (insight) => {
      queryClient.setQueryData(queryKeys.coach.traineeInsight(traineeId, insight.days, insight.locale), insight)
    },
  })
}
