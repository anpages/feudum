import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'gold' | 'crimson' | 'forest' | 'stone'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
}

const variantClass: Record<Variant, string> = {
  gold: 'badge-gold',
  crimson: 'badge-crimson',
  forest: 'badge-forest',
  stone: 'badge-stone',
}

export function Badge({ children, className, variant = 'gold', ...props }: BadgeProps) {
  return (
    <span className={cn('badge', variantClass[variant], className)} {...props}>
      {children}
    </span>
  )
}
