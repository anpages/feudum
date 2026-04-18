import { type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const sizeClass: Record<Size, string> = {
  sm: 'text-[0.62rem] py-1 px-3',
  md: '',
  lg: 'text-[0.8rem] py-2.5 px-6',
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: ButtonProps) {
  return (
    <button className={cn('btn', variantClass[variant], sizeClass[size], className)} {...props}>
      {children}
    </button>
  )
}
