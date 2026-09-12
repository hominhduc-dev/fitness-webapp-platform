"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { useLocale } from "@/components/providers/locale-provider"
import { StatusToast, type StatusToastTone } from "@/components/ui/status-toast"

export type ToastOptions = {
  action?: ReactNode
  description?: ReactNode
  /**
   * Milliseconds before it dismisses itself. Defaults to six seconds for a
   * success and to never for an error, because a failure usually names
   * something the reader has to go and act on.
   */
  duration?: number | null
  title: string
  tone: StatusToastTone
}

type ToastRecord = ToastOptions & { id: string }

type ToastContextValue = {
  dismiss: (id: string) => void
  dismissAll: () => void
  toast: (options: ToastOptions) => string
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const DEFAULT_SUCCESS_DURATION_MS = 6000
/** Beyond this the oldest is dropped, so a burst cannot bury the whole screen. */
const MAX_VISIBLE = 3

/** Fires a toast from anywhere under `AppProviders`. */
export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }

  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { messages } = useLocale()
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((entry) => entry.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  const toast = useCallback((options: ToastOptions) => {
    counter.current += 1
    const id = `toast-${counter.current}`

    setToasts((current) => [...current, { ...options, id }].slice(-MAX_VISIBLE))

    return id
  }, [])

  const value = useMemo(() => ({ dismiss, dismissAll, toast }), [dismiss, dismissAll, toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport dismissLabel={messages.common.dismissNotification} onDismiss={dismiss} toasts={toasts} />
    </ToastContext.Provider>
  )
}

/**
 * The stack itself, portalled to `document.body`.
 *
 * The portal is what makes a toast usable from inside a dialog: Radix animates
 * its content with a transform, and a `position: fixed` child of a transformed
 * ancestor anchors to that ancestor rather than to the viewport.
 */
function ToastViewport({
  dismissLabel,
  onDismiss,
  toasts,
}: {
  dismissLabel: string
  onDismiss: (id: string) => void
  toasts: ToastRecord[]
}) {
  // A portal has no position in the parent tree, so rendering nothing on the
  // server and the stack on the client cannot mismatch during hydration.
  if (typeof document === "undefined" || toasts.length === 0) return null

  return createPortal(
    <div
      className={[
        "pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-center gap-2",
        "sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end",
      ].join(" ")}
    >
      {toasts.map((entry) => (
        <ToastItem key={entry.id} dismissLabel={dismissLabel} onDismiss={onDismiss} toast={entry} />
      ))}
    </div>,
    document.body,
  )
}

function ToastItem({
  dismissLabel,
  onDismiss,
  toast,
}: {
  dismissLabel: string
  onDismiss: (id: string) => void
  toast: ToastRecord
}) {
  const { duration, id, tone } = toast
  const resolvedDuration = duration === undefined ? (tone === "success" ? DEFAULT_SUCCESS_DURATION_MS : null) : duration

  useEffect(() => {
    if (!resolvedDuration) return

    const timer = setTimeout(() => onDismiss(id), resolvedDuration)

    return () => {
      clearTimeout(timer)
    }
  }, [id, onDismiss, resolvedDuration])

  return (
    <div className="w-full max-w-md">
      <StatusToast
        action={toast.action}
        description={toast.description}
        dismissLabel={dismissLabel}
        onDismiss={() => onDismiss(id)}
        title={toast.title}
        tone={tone}
      />
    </div>
  )
}
