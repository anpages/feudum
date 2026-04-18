import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('card-medieval', className)} {...props}>
      <div className="card-corner-tr" />
      <div className="card-corner-bl" />
      {children}
    </div>
  )
}
