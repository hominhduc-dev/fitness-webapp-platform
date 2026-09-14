import Image from "next/image"

import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
  markClassName?: string
  textClassName?: string
}

export function BrandLogo({ className, markClassName, textClassName }: BrandLogoProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Image
        src="/yeahbuddy-mark.png"
        alt=""
        width={1200}
        height={1200}
        priority
        className={cn("size-8 shrink-0 rounded-lg object-cover", markClassName)}
      />
      <span className={cn("truncate text-lg font-bold tracking-tight text-foreground", textClassName)}>YeahBuddy</span>
    </span>
  )
}
