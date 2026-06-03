"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { deleteWorkout } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"

type DeleteWorkoutButtonProps = {
  className?: string
  confirmDescription?: string
  confirmTitle?: string
  label?: string
  onDeleted?: () => void
  refreshOnSuccess?: boolean
  size?: React.ComponentProps<typeof Button>["size"]
  variant?: React.ComponentProps<typeof Button>["variant"]
  workoutId: string
}

export function DeleteWorkoutButton({
  className,
  confirmDescription,
  confirmTitle,
  label,
  onDeleted,
  refreshOnSuccess = true,
  size = "icon",
  variant = "outline",
  workoutId,
}: DeleteWorkoutButtonProps) {
  const router = useRouter()
  const { isLoading: authLoading, session } = useAuth()
  const { messages } = useLocale()
  const [isMounted, setIsMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const triggerButton = (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(
        "shrink-0 text-destructive hover:bg-destructive-soft hover:text-destructive",
        className,
      )}
      disabled={authLoading || isDeleting}
      aria-label={label ? undefined : messages.workoutPage.deleteWorkoutAria}
    >
      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {label ? <span>{label}</span> : null}
    </Button>
  )

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)

    if (!nextOpen) {
      setError(null)
    }
  }

  const handleDelete = async () => {
    if (!session?.access_token || isDeleting) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      await deleteWorkout(session.access_token, workoutId)
      onDeleted?.()
      handleOpenChange(false)
      if (refreshOnSuccess) {
        router.refresh()
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : messages.workoutPage.deleteWorkoutError)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isMounted) {
    return triggerButton
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{confirmTitle ?? messages.workoutPage.deleteWorkoutTitle}</DialogTitle>
          <DialogDescription>{confirmDescription ?? messages.workoutPage.deleteWorkoutDescription}</DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" className="bg-transparent" onClick={() => handleOpenChange(false)}>
            {messages.common.cancel}
          </Button>
          <Button type="button" variant="destructive" className="gap-2" onClick={() => void handleDelete()} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {isDeleting ? messages.workoutPage.deleting : messages.workoutPage.deleteWorkout}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
