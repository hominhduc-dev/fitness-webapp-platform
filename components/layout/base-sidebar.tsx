"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { ShellNavItem } from "@/components/layout/shell-nav"

export interface SidebarSection {
  title?: string
  items: ShellNavItem[]
}

export interface BaseSidebarProps {
  sections: SidebarSection[]
  isActiveItem: (item: ShellNavItem) => boolean
  collapsible?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
  brand: React.ReactNode
  footer: React.ReactNode
  cta?: React.ReactNode
  backLink?: React.ReactNode
  activeStyle?: "primary" | "muted"
}

export function BaseSidebar({
  sections,
  isActiveItem,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  brand,
  footer,
  cta,
  backLink,
  activeStyle = "primary",
}: BaseSidebarProps) {
  const isFixed = !collapsible;

  const renderItem = (item: ShellNavItem, isCollapsed: boolean) => {
    const isActive = isActiveItem(item)

    if (activeStyle === "primary") {
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
            isActive
              ? "bg-primary-soft text-primary shadow-sm"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
            isCollapsed && "justify-center px-2",
          )}
        >
          <item.icon className={cn("h-5 w-5 shrink-0 transition-transform", isActive && "scale-105")} />
          {!isCollapsed && <span>{item.label}</span>}
        </Link>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
          isActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        {!isCollapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        {!isCollapsed && item.count != null ? (
          <span className="rounded-full bg-background px-2 py-0.5 font-mono text-[11px] leading-none text-muted-foreground">
            {item.count}
          </span>
        ) : null}
      </Link>
    )
  }

  return (
    <aside
      className={cn(
        "glass-surface sticky top-0 hidden h-dvh flex-col border-r border-border bg-sidebar md:flex",
        isFixed ? "w-[232px] shrink-0" : "transition-all duration-300",
        collapsible && collapsed ? "w-16" : "",
        collapsible && !collapsed ? "w-64" : ""
      )}
    >
      {isFixed ? (
        <div className="flex h-full min-h-0 flex-col px-3.5 py-6">
          <div className="mb-4 flex items-center gap-2 px-1">
            {brand}
          </div>
          {backLink && (
            <div className="mb-6 px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
              {backLink}
            </div>
          )}
          {cta && <div className="mb-7">{cta}</div>}
          
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            {sections.map((section, idx) => (
              <React.Fragment key={idx}>
                {section.title && (
                  <p className={cn("label-micro mb-2 px-1 text-muted-foreground", idx > 0 && "mt-5")}>
                    {section.title}
                  </p>
                )}
                <nav className="flex flex-col gap-1">
                  {section.items.map((item) => renderItem(item, false))}
                </nav>
              </React.Fragment>
            ))}
          </div>

          <div className="shrink-0 border-t border-border pt-4">
            {footer}
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            {!collapsed && (
              <div className="flex items-center gap-2">
                {brand}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className={cn(collapsed && "mx-auto")}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {sections.map((section, idx) => (
              <React.Fragment key={idx}>
                {section.title && !collapsed && (
                  <p className={cn("label-micro mb-2 px-3 text-muted-foreground", idx > 0 && "mt-5")}>
                    {section.title}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => renderItem(item, collapsed))}
                </div>
              </React.Fragment>
            ))}
          </nav>

          <div className="shrink-0 border-t border-sidebar-border p-2">
            {footer}
          </div>
        </>
      )}
    </aside>
  )
}
