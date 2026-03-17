"use client"

import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

const AuthModal = dynamic(() => import("./auth-modal").then((mod) => mod.AuthModal), {
  ssr: false,
})

export function AuthModalLauncher() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const authMode = searchParams.get("auth")
  const isOpen = authMode === "login" || authMode === "register"

  if (!isOpen) {
    return null
  }

  const handleOpenChange = (open: boolean) => {
    if (open) {
      return
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("auth")
    nextParams.delete("error")

    const nextQuery = nextParams.toString()
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }

  return (
    <AuthModal
      defaultTab={authMode}
      onOpenChange={handleOpenChange}
      open
      redirectToPath={searchParams.get("next")}
    />
  )
}
