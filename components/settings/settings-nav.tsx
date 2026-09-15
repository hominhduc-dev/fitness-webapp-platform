"use client"

import type { LucideIcon } from "lucide-react"
import { useEffect, useRef, useState, type MouseEvent } from "react"

import { cn } from "@/lib/utils"

export type SettingsSectionLink = {
  icon: LucideIcon
  id: string
  label: string
  tone?: "danger" | "default"
}

/**
 * Jump list for the settings sections: a scrollable chip row on phones, a
 * sticky rail on desktop. Both highlight the section currently in view, so the
 * page stays navigable without turning it into tabs — one Save still covers
 * every field because nothing is unmounted.
 */
export function SettingsNav({
  className,
  label,
  sections,
  variant,
}: {
  className?: string
  label: string
  sections: SettingsSectionLink[]
  variant: "chips" | "rail"
}) {
  const sectionKey = sections.map((section) => section.id).join("|")
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "")
  const visibleIds = useRef(new Set<string>())

  useEffect(() => {
    const ids = sectionKey.split("|").filter(Boolean)
    const elements = ids.map((id) => document.getElementById(id)).filter((element): element is HTMLElement => element != null)

    if (elements.length === 0 || typeof IntersectionObserver === "undefined") {
      return
    }

    visibleIds.current = new Set()

    // The top inset clears the sticky header; the bottom one keeps the last
    // section from stealing the highlight while its heading is still offscreen.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleIds.current.add(entry.target.id)
          } else {
            visibleIds.current.delete(entry.target.id)
          }
        }

        const topMost = ids.find((id) => visibleIds.current.has(id))

        if (topMost) {
          setActiveId(topMost)
        }
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: 0 },
    )

    elements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [sectionKey])

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)

    if (!target) {
      return
    }

    // Scrolling here instead of letting the hash land keeps the URL clean and
    // honours the section's scroll margin under the sticky header.
    event.preventDefault()
    const prefersReducedMotion =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" })
    setActiveId(id)
  }

  if (variant === "chips") {
    return (
      <nav
        aria-label={label}
        className={cn(
          "-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        <ul className="flex w-max items-center gap-1.5 py-1">
          {sections.map((section) => {
            const isActive = section.id === activeId

            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={isActive ? "true" : undefined}
                  onClick={(event) => handleClick(event, section.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary-soft text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                    !isActive && section.tone === "danger" && "text-destructive-text/80",
                  )}
                >
                  <section.icon aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
                  {section.label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    )
  }

  return (
    <nav aria-label={label} className={className}>
      <ul className="space-y-0.5">
        {sections.map((section) => {
          const isActive = section.id === activeId

          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "true" : undefined}
                onClick={(event) => handleClick(event, section.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary-soft font-medium text-primary"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                  !isActive && section.tone === "danger" && "text-destructive-text/80",
                )}
              >
                <section.icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{section.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
