import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * `text-micro` is a project font size (`--text-micro` in globals.css), but
 * tailwind-merge only knows Tailwind's stock scale, so it files the class under
 * text colour instead. Any `cn("text-micro", "text-muted-foreground")` then drops
 * the size and the element silently falls back to the 16px body default.
 * Registering it here keeps the two in separate groups.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
