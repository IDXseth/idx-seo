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
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-600 shadow-sm group-hover:bg-indigo-700 transition-colors">
              <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5 text-white" aria-hidden>
                <circle cx="10" cy="10" r="3" fill="white" />
                <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.05 5.05l1.41 1.41M13.54 13.54l1.41 1.41M5.05 14.95l1.41-1.41M13.54 6.46l1.41-1.41" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-none">AI Mention Monitor</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">Senior Living Intelligence</p>
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
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-indigo-600' : 'text-slate-400')} />
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
