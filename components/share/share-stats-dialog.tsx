"use client"

import { Download, Loader2, Share2, X } from "lucide-react"
import { useId, useRef, useState, useSyncExternalStore } from "react"

import { useLocale } from "@/components/providers/locale-provider"
import { useToast } from "@/components/providers/toast-provider"
import { StatsShareCard } from "@/components/share/stats-share-card"
import { BottomSheet, BottomSheetBody, BottomSheetFooter, BottomSheetHeader } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { canShareImageFile, downloadImage, renderNodeToPng, shareOrDownloadImage } from "@/lib/share/share-image"
import {
  buildShareFileName,
  SHARE_CARD_FORMAT_IDS,
  SHARE_CARD_FORMATS,
  type ShareCardData,
  type ShareCardFormatId,
} from "@/lib/share/stats-card"
import { cn } from "@/lib/utils"

/**
 * Preview widths, in CSS pixels. The card lays out at its true 1080px and is
 * scaled down by an ancestor transform, so what the trainee approves here is
 * pixel-for-pixel what gets exported.
 */
const PREVIEW_WIDTH: Record<ShareCardFormatId, number> = { square: 288, story: 236 }

/** The capability never changes for a given browser, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {}

export function ShareStatsDialog({
  data,
  fileNamePrefix = "yeahbuddy",
  onClose,
  shareText,
  shareTitle,
}: {
  data: ShareCardData
  fileNamePrefix?: string
  onClose: () => void
  shareText?: string
  shareTitle?: string
}) {
  const { messages } = useLocale()
  const copy = messages.progressPage.share
  const { toast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  const [format, setFormat] = useState<ShareCardFormatId>("square")
  const [busy, setBusy] = useState<"download" | "share" | null>(null)
  // Probed on the client only: the server has no `navigator`, and branching the
  // markup on it during render would mismatch hydration.
  const nativeShare = useSyncExternalStore(subscribeToNothing, canShareImageFile, () => false)

  const size = SHARE_CARD_FORMATS[format]
  const scale = PREVIEW_WIDTH[format] / size.width

  const run = async (intent: "download" | "share") => {
    const node = cardRef.current
    if (!node || busy) return

    setBusy(intent)
    try {
      const blob = await renderNodeToPng(node)
      const fileName = buildShareFileName(fileNamePrefix, format, new Date())

      // "Save image" means the file, not the share sheet — routing it through
      // the sheet would hide the one action the trainee explicitly asked for.
      if (intent === "download") {
        downloadImage(blob, fileName)
        toast({ title: copy.savedToast, tone: "success" })
        onClose()
        return
      }

      const outcome = await shareOrDownloadImage(blob, fileName, { text: shareText, title: shareTitle })
      if (outcome === "cancelled") return
      if (outcome === "downloaded") toast({ title: copy.savedToast, tone: "success" })
      onClose()
    } catch {
      toast({ title: copy.errorToast, tone: "error" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <BottomSheet labelledBy={titleId} onClose={onClose}>
      <BottomSheetHeader>
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold tracking-tight text-foreground">
            {copy.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="-mr-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:size-11"
        >
          <X className="size-4" />
        </button>
      </BottomSheetHeader>

      <BottomSheetBody className="flex flex-col items-center gap-4">
        <div role="radiogroup" aria-label={copy.formatLabel} className="inline-flex rounded-full border border-border bg-card p-0.5">
          {SHARE_CARD_FORMAT_IDS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={format === option}
              onClick={() => setFormat(option)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-10",
                format === option ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {copy.formats[option]}
            </button>
          ))}
        </div>

        {/* The window clips the full-size card down to preview scale. The card
            node inside keeps its own 1080px box, which is what gets serialised. */}
        <div
          className="relative overflow-hidden rounded-2xl border border-border shadow-lg"
          style={{ height: Math.round(size.height * scale), width: Math.round(size.width * scale) }}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
            <StatsShareCard cardRef={cardRef} data={data} format={format} />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">{nativeShare ? copy.hintNative : copy.hintDownload}</p>
      </BottomSheetBody>

      <BottomSheetFooter className="flex-col gap-2 sm:flex-row">
        {nativeShare ? (
          <Button className="w-full" disabled={busy !== null} onClick={() => void run("share")}>
            {busy === "share" ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
            {busy === "share" ? copy.preparing : copy.share}
          </Button>
        ) : null}
        <Button
          className="w-full"
          variant={nativeShare ? "outline" : "default"}
          disabled={busy !== null}
          onClick={() => void run("download")}
        >
          {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {busy === "download" ? copy.preparing : copy.download}
        </Button>
      </BottomSheetFooter>
    </BottomSheet>
  )
}
