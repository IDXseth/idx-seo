'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { BarChart3, Upload, Play, ChevronDown, LogOut, User } from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/run', label: 'Run Prompts', icon: Play },
]

function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!session?.user) return null

  const user = session.user
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.slice(0, 2).toUpperCase() ?? 'U'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt={user.name ?? 'User'} className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
        )}
        <span className="text-sm font-medium max-w-[120px] truncate hidden sm:block">
          {user.name ?? user.email}
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-white/60 transition-transform hidden sm:block', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-[#dde6ea] shadow-lg overflow-hidden z-50">
          {/* User info */}
          <div className="px-4 py-3 border-b border-[#dde6ea]">
            <p className="text-sm font-semibold text-[#084c61] truncate">{user.name ?? 'User'}</p>
            <p className="text-xs text-[#8aadb8] truncate">{user.email}</p>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              disabled
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#5a7a85] opacity-50 cursor-not-allowed"
            >
              <User className="h-4 w-4" />
              Profile
            </button>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50" style={{ background: 'linear-gradient(90deg, #084c61 0%, #054166 100%)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-white/15 group-hover:bg-white/25 transition-colors flex-shrink-0">
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

          {/* Nav links + user menu */}
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

            {/* Divider */}
            <div className="h-5 w-px bg-white/20 mx-1" />

            {/* User menu */}
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}
