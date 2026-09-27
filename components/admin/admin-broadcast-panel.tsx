"use client"

import { Loader2, Megaphone, Send } from "lucide-react"
import { useState } from "react"

import { useToast } from "@/components/providers/toast-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AdminBroadcast, AdminBroadcastTarget } from "@/lib/admin/types"
import { useAdminBroadcastAudience, useAdminBroadcasts, useSendAdminBroadcast } from "@/lib/queries/admin"

const TITLE_MAX = 60
const MESSAGE_MAX = 180

const TARGETS: Array<{ en: string; value: AdminBroadcastTarget | ""; vi: string }> = [
  { en: "Their home screen", value: "", vi: "Trang chính của họ" },
  { en: "Dashboard", value: "/dashboard", vi: "Dashboard" },
  { en: "Workouts", value: "/workout", vi: "Buổi tập" },
  { en: "Schedule", value: "/schedule", vi: "Lịch tập" },
  { en: "Nutrition", value: "/meals", vi: "Dinh dưỡng" },
  { en: "Progress", value: "/progress", vi: "Tiến độ" },
  { en: "Profile & settings", value: "/profile", vi: "Hồ sơ & cài đặt" },
]

/** What the notice looks like on a phone's lock screen. */
function LockScreenPreview({ message, title }: { message: string; title: string }) {
  return (
    <div className="rounded-2xl bg-muted p-3">
      <div className="grid grid-cols-[1.75rem_1fr] gap-2 rounded-xl border border-border bg-card p-2.5 shadow-sm">
        <div className="grid size-7 place-items-center rounded-md bg-primary text-xs font-extrabold text-primary-foreground">Y</div>
        <div className="min-w-0">
          <div className="flex justify-between text-micro text-muted-foreground">
            <span>YEAHBUDDY</span>
            <span>now</span>
          </div>
          <p className="text-xs font-semibold text-foreground">{title || "…"}</p>
          <p className="text-xs text-muted-foreground">{message || "…"}</p>
        </div>
      </div>
    </div>
  )
}

function StatBar({ label, total, value }: { label: string; total: number; value: number }) {
  const share = total > 0 ? Math.min(value / total, 1) : 0
  return (
    <div className="space-y-1">
      <p className="font-mono text-xs text-muted-foreground tnum">{label}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  )
}

function BroadcastRow({ broadcast, locale }: { broadcast: AdminBroadcast; locale: "en" | "vi" }) {
  const devices = broadcast.push.sent + broadcast.push.failed + broadcast.push.pending
  const when = broadcast.createdAt.toLocaleString(locale === "en" ? "en-US" : "vi-VN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  })
  return (
    <div className="space-y-3 border-b border-border/60 px-4 py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium text-foreground">{broadcast.title}</p>
        <p className="font-mono text-xs text-muted-foreground tnum">
          {when} · {broadcast.sentBy}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{broadcast.message}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatBar
          label={
            locale === "en"
              ? `Push ${broadcast.push.sent}/${devices} devices${broadcast.push.failed ? ` · ${broadcast.push.failed} failed` : ""}${broadcast.push.pending ? ` · ${broadcast.push.pending} sending` : ""}`
              : `Push ${broadcast.push.sent}/${devices} thiết bị${broadcast.push.failed ? ` · lỗi ${broadcast.push.failed}` : ""}${broadcast.push.pending ? ` · đang gửi ${broadcast.push.pending}` : ""}`
          }
          total={devices}
          value={broadcast.push.sent}
        />
        <StatBar
          label={locale === "en" ? `Read ${broadcast.read}/${broadcast.recipientCount} people` : `Đã đọc ${broadcast.read}/${broadcast.recipientCount} người`}
          total={broadcast.recipientCount}
          value={broadcast.read}
        />
      </div>
    </div>
  )
}

/**
 * Admin notices to every active trainee and coach: compose, check the lock
 * screen preview and reach, confirm, then follow reads and push outcomes.
 */
export function AdminBroadcastPanel({ locale }: { locale: "en" | "vi" }) {
  const { toast } = useToast()
  const audience = useAdminBroadcastAudience()
  const history = useAdminBroadcasts()
  const send = useSendAdminBroadcast()
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [target, setTarget] = useState<AdminBroadcastTarget | "">("")
  const [confirming, setConfirming] = useState(false)
  const en = locale === "en"

  const reach = audience.data
  const pushless = reach ? reach.accounts - reach.usersWithPush : 0
  const canPreview = title.trim().length > 0 && message.trim().length > 0

  const handleSend = async () => {
    try {
      const result = await send.mutateAsync([{ message: message.trim(), target: target || null, title: title.trim() }])
      toast({ title: en ? `Sent to ${result.recipientCount} people.` : `Đã gửi tới ${result.recipientCount} người.`, tone: "success" })
      setConfirming(false)
      setTitle("")
      setMessage("")
      setTarget("")
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : en ? "Could not send the notice." : "Không gửi được thông báo.", tone: "error" })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Megaphone className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">{en ? "New notice" : "Thông báo mới"}</h2>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label htmlFor="broadcast-title">{en ? "Title" : "Tiêu đề"}</Label>
            <span className="font-mono text-xs text-muted-foreground tnum">{title.length}/{TITLE_MAX}</span>
          </div>
          <Input id="broadcast-title" maxLength={TITLE_MAX} value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label htmlFor="broadcast-message">{en ? "Message" : "Nội dung"}</Label>
            <span className="font-mono text-xs text-muted-foreground tnum">{message.length}/{MESSAGE_MAX}</span>
          </div>
          <Textarea id="broadcast-message" rows={3} maxLength={MESSAGE_MAX} value={message} onChange={(event) => setMessage(event.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="broadcast-target">{en ? "Opens when tapped" : "Mở trang khi chạm"}</Label>
          <select
            id="broadcast-target"
            value={target}
            onChange={(event) => setTarget(event.target.value as AdminBroadcastTarget | "")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {TARGETS.map((option) => (
              <option key={option.value} value={option.value}>
                {en ? option.en : option.vi}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg bg-surface-subtle px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">{en ? "Recipients: all active trainees and coaches" : "Người nhận: mọi trainee và coach đang hoạt động"}</p>
          <p className="mt-1 font-mono text-xs text-foreground tnum">
            {reach
              ? en
                ? `${reach.accounts} accounts · ${reach.usersWithPush} with push · ${reach.devices} devices`
                : `${reach.accounts} tài khoản · ${reach.usersWithPush} người có push · ${reach.devices} thiết bị`
              : "…"}
          </p>
        </div>

        <Button type="button" className="w-full" disabled={!canPreview} onClick={() => setConfirming(true)}>
          {en ? "Preview and send" : "Xem trước và gửi"}
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <h2 className="text-base font-semibold">{en ? "Sent" : "Đã gửi"}</h2>
          {history.isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" /> : null}
        </div>
        {history.isPending ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">{en ? "Loading…" : "Đang tải…"}</p>
        ) : (history.data ?? []).length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {en ? "No notices sent yet." : "Chưa gửi thông báo nào."}
          </p>
        ) : (
          (history.data ?? []).map((broadcast) => <BroadcastRow key={broadcast.id} broadcast={broadcast} locale={locale} />)
        )}
      </Card>

      <Dialog open={confirming} onOpenChange={(open) => { if (!send.isPending) setConfirming(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reach ? (en ? `Send to ${reach.accounts} people?` : `Gửi tới ${reach.accounts} người?`) : en ? "Send this notice?" : "Gửi thông báo này?"}</DialogTitle>
            <DialogDescription>
              {en
                ? "A notice can't be recalled once sent."
                : "Thông báo không thu hồi được sau khi gửi."}
              {pushless > 0
                ? en
                  ? ` ${pushless} people without push will only see it in their notifications.`
                  : ` ${pushless} người chưa bật push sẽ chỉ thấy trong chuông thông báo.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <LockScreenPreview message={message.trim()} title={title.trim()} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={send.isPending} onClick={() => setConfirming(false)}>
              {en ? "Edit" : "Sửa lại"}
            </Button>
            <Button type="button" disabled={send.isPending} onClick={() => void handleSend()}>
              {send.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
              {en ? "Send now" : "Gửi ngay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
