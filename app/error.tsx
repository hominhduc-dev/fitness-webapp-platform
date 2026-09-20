"use client"

import { useEffect } from "react"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/ui/brand-logo"

// No locale provider exists above this boundary — it can fire from inside
// `(shell)/layout.tsx` itself, before any provider mounts — so the copy is
// resolved from the raw cookie instead of the full i18n system (mirrors
// `AppSplash`'s reasoning for the same constraint).
const COPY = {
  en: {
    heading: "Something went wrong",
    body: "We couldn't load this page. Your session is fine — this was a temporary problem loading data.",
    retry: "Try again",
  },
  vi: {
    heading: "Đã có lỗi xảy ra",
    body: "Không thể tải trang này. Phiên đăng nhập của bạn vẫn còn hiệu lực — đây chỉ là sự cố tạm thời khi tải dữ liệu.",
    retry: "Thử lại",
  },
} as const

function readLocale(): keyof typeof COPY {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|; )yeahbuddy-locale=([^;]+)/)
  return match?.[1] === "vi" ? "vi" : "en"
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const copy = COPY[readLocale()]

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <BrandLogo markClassName="size-9 rounded-none sm:size-10" textClassName="text-2xl font-bold tracking-tight" />
      <div className="max-w-sm space-y-2">
        <h1 className="text-lg font-semibold">{copy.heading}</h1>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      </div>
      <Button onClick={() => reset()}>
        <RefreshCw />
        {copy.retry}
      </Button>
    </div>
  )
}
