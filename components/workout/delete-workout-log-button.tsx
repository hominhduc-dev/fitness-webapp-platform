"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RotateCcw } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
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
import { deleteWorkoutLog } from "@/lib/fitness/api"
import { cn } from "@/lib/utils"

type DeleteWorkoutLogButtonProps = {
  className?: string
  logId: string
  onDeleted?: () => void
  refreshOnSuccess?: boolean
  workoutId: string
}

export function DeleteWorkoutLogButton({
  className,
  logId,
  onDeleted,
  refreshOnSuccess = true,
  workoutId,
}: DeleteWorkoutLogButtonProps) {
  const router = useRouter()
  const { isLoading: authLoading, session } = useAuth()
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
      variant="ghost"
      size="icon-sm"
      className={cn(
        "h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
        className,
      )}
      disabled={authLoading || isDeleting}
      aria-label="Reset log"
    >
      {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
    </Button>
  )

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setError(null)
  }

  const handleDelete = async () => {
    if (!session?.access_token || isDeleting) return

    setIsDeleting(true)
    setError(null)

    try {
      await deleteWorkoutLog(session.access_token, workoutId, logId)
      onDeleted?.()
      handleOpenChange(false)
      if (refreshOnSuccess) {
        router.refresh()
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa log này.")
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
          <DialogTitle>Reset log buổi tập?</DialogTitle>
          <DialogDescription>
            Xóa log này sẽ đánh dấu ngày đó chưa hoàn thành. Dữ liệu số liệu đã lưu sẽ bị mất.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" className="bg-transparent" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button type="button" variant="destructive" className="gap-2" onClick={() => void handleDelete()} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {isDeleting ? "Đang xóa..." : "Reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
