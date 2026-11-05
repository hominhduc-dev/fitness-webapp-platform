"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, FileSpreadsheet, ImagePlus, Upload } from "lucide-react"

import { useLocale } from "@/components/providers/locale-provider"
import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/ui/brand-icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { fetchGoogleConnection } from "@/lib/fitness/api"
import { programImportMessages } from "@/lib/i18n/messages/program-import"
import { useCoachData } from "@/lib/queries/coach-data"
import { queryKeys } from "@/lib/queries/keys"

export type ProgramImportSource = "excel" | "image" | "google"

export function ImportProgramMenu({ onSelect }: { onSelect: (source: ProgramImportSource) => void }) {
  const { locale, messages } = useLocale()
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const google = useCoachData(queryKeys.coach.googleConnection(), fetchGoogleConnection, undefined, open, 30_000)
  const sources: ProgramImportSource[] = ["excel", "image", ...(google.data?.configured ? ["google" as const] : [])]
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), 180)
  }
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl bg-transparent"
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return
            cancelClose()
            setOpen(true)
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") scheduleClose()
          }}
        >
          <Upload className="size-4" />
          {messages.coach.importProgram}
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[100] w-56 rounded-xl backdrop-blur-xl"
        onPointerEnter={cancelClose}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") scheduleClose()
        }}
      >
        {sources.map((source) => (
          <DropdownMenuItem key={source} className="min-h-11 cursor-pointer gap-3 rounded-lg" onSelect={() => {
            cancelClose()
            setOpen(false)
            onSelect(source)
          }}>
            {source === "excel" ? <FileSpreadsheet /> : source === "image" ? <ImagePlus /> : <GoogleIcon />}
            {programImportMessages[locale].sources[source].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
