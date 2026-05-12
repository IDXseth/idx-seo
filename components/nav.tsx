'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BarChart3, Upload, Play } from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/run', label: 'Run Prompts', icon: Play },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50" style={{ background: 'linear-gradient(90deg, #084c61 0%, #054166 100%)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-white/15 group-hover:bg-white/25 transition-colors flex-shrink-0">
              {/* SL monogram */}
              <span className="text-white font-bold text-sm tracking-tight select-none">SL</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>
                Senior Lifestyle
              </p>
              <p className="text-[11px] text-white/65 leading-none mt-0.5 font-medium tracking-wide">
                AI Visibility Dashboard
              </p>
            </div>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-[#ffc857]' : 'text-white/50')} />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
