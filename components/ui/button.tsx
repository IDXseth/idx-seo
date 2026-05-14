'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084c61] disabled:pointer-events-none disabled:opacity-50'

    const variantClasses = {
      default: 'bg-[#084c61] text-white hover:bg-[#054166]',
      outline: 'border border-[#dde6ea] bg-white hover:bg-[#f5f8fa] text-[#084c61]',
      ghost: 'hover:bg-[#f0f4f7] text-[#084c61]',
      secondary: 'bg-[#eef3f5] text-[#084c61] hover:bg-[#dde6ea]',
      destructive: 'bg-red-600 text-white hover:bg-red-700',
      link: 'text-[#177e89] underline-offset-4 hover:underline',
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
