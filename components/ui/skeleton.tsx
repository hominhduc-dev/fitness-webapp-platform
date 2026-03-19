import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'rounded-md bg-[linear-gradient(110deg,rgba(239,243,255,0.92),rgba(255,255,255,0.98),rgba(239,243,255,0.92))] bg-[length:200%_100%] animate-[skeleton-shimmer_1.5s_linear_infinite]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
