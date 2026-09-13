'use client'

import * as React from'react'
import * as TabsPrimitive from'@radix-ui/react-tabs'
import { cva, type VariantProps } from'class-variance-authority'

import { cn } from'@/lib/utils'

const tabsListVariants = cva('', {
  variants: {
    variant: {
      default:'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
      // Full-width row of equal options, e.g. choosing an import source.
      segmented:'grid w-full auto-cols-fr grid-flow-col gap-1 rounded-xl border border-border bg-surface-subtle p-1',
    },
  },
  defaultVariants: { variant:'default' },
})

const tabsTriggerVariants = cva(
"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:'data-[state=active]:bg-background text-foreground h-[calc(100%-1px)] flex-1 px-2 py-1',
        // Stacks icon over label on phones so three options fit, and fills the
        // selected option with primary so the choice reads at a glance.
        segmented:
'min-h-11 min-w-0 flex-col gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-hover sm:min-h-12 sm:flex-row sm:gap-2.5 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:hover:bg-primary',
      },
    },
    defaultVariants: { variant:'default' },
  },
)

type TabsVariant = NonNullable<VariantProps<typeof tabsListVariants>['variant']>

// The list owns the variant; its triggers inherit it, so a call site sets it once.
const TabsVariantContext = React.createContext<TabsVariant>('default')

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  variant ='default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    </TabsVariantContext.Provider>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsVariantContext)

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
