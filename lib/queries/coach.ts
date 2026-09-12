"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/queries/keys"
import { requireAccessToken } from "@/lib/queries/token"
import {
  assignCoachProgram,
  createCoachBodyMetric,
  createCoachCheckIn,
  createCoachRequest,
  unassignCoachProgram,
  updateCoachRequestStatus,
} from "@/lib/fitness/api"

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
