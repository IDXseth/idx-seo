'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--c-ink) disabled:pointer-events-none disabled:opacity-50'

    const variantClasses = {
      default: 'bg-(--c-ink) text-white hover:bg-(--c-ink-hover)',
      outline: 'border border-(--c-line) bg-white hover:bg-(--c-surface) text-(--c-ink)',
      ghost: 'hover:bg-(--c-page) text-(--c-ink)',
      secondary: 'bg-(--c-line-soft) text-(--c-ink) hover:bg-(--c-line)',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
      link: 'text-(--c-accent) underline-offset-4 hover:underline',
    }

    const sizeClasses = {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 px-3 text-xs',
      lg: 'h-11 px-8',
      icon: 'h-10 w-10',
    }

    return (
      <button
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
