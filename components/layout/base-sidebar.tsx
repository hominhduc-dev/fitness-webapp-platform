"use client"

import * as React from "react"
import Link from "next/link"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
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
  compactBrand?: React.ReactNode
  /** Compact control beside the brand, e.g. the notification bell. */
  headerAction?: React.ReactNode
  footer: React.ReactNode
  cta?: React.ReactNode
  backLink?: React.ReactNode
  activeStyle?: "primary" | "muted"
  accessibilityLabels?: { expand: string; collapse: string }
}

export function BaseSidebar({
  sections,
  isActiveItem,
  collapsible = false,
  collapsed: persistedCollapsed = false,
  onToggleCollapse,
  brand,
  compactBrand,
  headerAction,
  footer,
  cta,
  backLink,
  activeStyle = "primary",
  accessibilityLabels = { expand: "Expand sidebar", collapse: "Collapse sidebar" },
}: BaseSidebarProps) {

  const collapsed = persistedCollapsed

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
          aria-label={isCollapsed ? item.label : undefined}
          title={isCollapsed ? item.label : undefined}
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
          isCollapsed && "h-11 justify-center px-2",
        )}
        aria-label={isCollapsed ? item.label : undefined}
        title={isCollapsed ? item.label : undefined}
      >
        <item.icon className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} strokeWidth={1.5} />
        {!isCollapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        {!isCollapsed && item.count != null ? (
          <span className="rounded-full bg-background px-2 py-0.5 font-mono text-micro leading-none text-muted-foreground">
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
        "shrink-0 transition-[width] duration-300 motion-reduce:transition-none",
        persistedCollapsed ? "w-[72px]" : "w-[232px]"
      )}
    >

        <div className={cn("flex h-full min-h-0 flex-col py-6", collapsed ? "px-2" : "px-3.5")}>
          <div className={cn("mb-4 flex gap-2", collapsed ? "flex-col items-center" : "flex-wrap items-center")}>
            {!collapsed && brand}
            {collapsible && (
              <Button type="button" variant="ghost" size="icon" className={cn("group/sidebar-toggle relative shrink-0 rounded-xl", !collapsed && "ml-auto")} onClick={onToggleCollapse} aria-expanded={!persistedCollapsed} aria-label={persistedCollapsed ? accessibilityLabels.expand : accessibilityLabels.collapse} title={persistedCollapsed ? accessibilityLabels.expand : accessibilityLabels.collapse}>
                {collapsed && compactBrand ? (
                  <>
                    <span className="pointer-events-none group-hover/sidebar-toggle:opacity-0 group-focus-visible/sidebar-toggle:opacity-0">{compactBrand}</span>
                    <PanelLeftOpen aria-hidden="true" className="absolute opacity-0 group-hover/sidebar-toggle:opacity-100 group-focus-visible/sidebar-toggle:opacity-100" />
                  </>
                ) : persistedCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
              </Button>
            )}
            {headerAction ? <div className={cn(!collapsed && "flex w-full justify-end")}>{headerAction}</div> : null}
          </div>
          {backLink && !collapsed && (
            <div className="mb-6 px-1 text-micro text-muted-foreground transition-colors hover:text-foreground">
              {backLink}
            </div>
          )}
          {cta && <div className={collapsed ? "mb-3" : "mb-7"}>{cta}</div>}
          
          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            {sections.map((section, idx) => (
              <React.Fragment key={idx}>
                {section.title && !collapsed && (
                  <p className={cn("label-micro mb-2 px-1 text-muted-foreground", idx > 0 && "mt-5")}>
                    {section.title}
                  </p>
                )}
                <nav className="flex flex-col gap-1">
                  {section.items.map((item) => renderItem(item, collapsed))}
                </nav>
              </React.Fragment>
            ))}
          </div>

          <div className="shrink-0 border-t border-border pt-4">
            {footer}
          </div>
        </div>

    </aside>
  )
}
