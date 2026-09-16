"use client"

import { useSyncExternalStore } from "react"

import { getOfflineSyncStatus, getServerOfflineSyncStatus, subscribeToOfflineSyncStatus } from "@/lib/offline/sync"

export function useOfflineSyncStatus() {
  return useSyncExternalStore(subscribeToOfflineSyncStatus, getOfflineSyncStatus, getServerOfflineSyncStatus)
}
