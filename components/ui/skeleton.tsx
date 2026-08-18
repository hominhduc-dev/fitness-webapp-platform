import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'rounded-md bg-muted bg-[length:200%_100%] animate-[skeleton-shimmer_1.5s_linear_infinite]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
