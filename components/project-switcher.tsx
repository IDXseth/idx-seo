'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, FolderKanban, Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectItem {
  id: string
  name: string
  primaryDomain: string
  canEdit: boolean
}

interface ProjectsResponse {
  projects: ProjectItem[]
  activeProjectId: string | null
  canCreate: boolean
}

// The project (tracked brand) the whole app is working in. Switching reloads
// the current page without its query string, since filters like a prompt set
// or run snapshot belong to the previous project.
export function ProjectSwitcher() {
  const { status } = useSession()
  const pathname = usePathname()
  const [data, setData] = useState<ProjectsResponse | null>(null)
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
  }, [status, pathname])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (status !== 'authenticated' || !data) return null

  const active = data.projects.find((p) => p.id === data.activeProjectId) ?? null

  async function switchTo(id: string) {
    setOpen(false)
    if (id === data?.activeProjectId) return
    setSwitching(true)
    const res = await fetch('/api/projects/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: id }),
    })
    if (res.ok) window.location.assign(pathname.startsWith('/projects/') ? '/dashboard' : pathname)
    else setSwitching(false)
  }

  if (data.projects.length === 0) {
    return data.canCreate ? (
      <Link
        href="/projects/new"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#ffc857] text-[#084c61] hover:bg-[#ffd47a] transition-colors"
      >
        <Plus className="h-4 w-4" />
        New project
      </Link>
    ) : null
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={switching}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 text-white hover:bg-white/10 transition-colors disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <FolderKanban className="h-4 w-4 text-[#ffc857]" />
        <span className="text-sm font-semibold max-w-[160px] truncate">{switching ? 'Switching…' : active?.name ?? 'Select project'}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-white/60 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-xl border border-[#dde6ea] shadow-lg overflow-hidden z-50">
          <p className="px-4 pt-3 pb-1 text-xs font-semibold text-[#8aadb8] uppercase tracking-wide">Projects</p>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {data.projects.map((p) => (
              <li key={p.id}>
                <button
                  role="option"
                  aria-selected={p.id === active?.id}
                  onClick={() => switchTo(p.id)}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-[#f5f8fa] transition-colors"
                >
                  <Check className={cn('h-4 w-4 flex-shrink-0 text-[#177e89]', p.id !== active?.id && 'invisible')} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#084c61] truncate">{p.name}</span>
                    <span className="block text-xs text-[#8aadb8] truncate">{p.primaryDomain}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-[#dde6ea] py-1">
            {active && (
              <Link
                href={`/projects/${active.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#5a7a85] hover:bg-[#f5f8fa] transition-colors"
              >
                <Settings className="h-4 w-4" />
                {active.canEdit ? 'Project settings' : 'View project settings'}
              </Link>
            )}
            {data.canCreate && (
              <Link
                href="/projects/new"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#177e89] font-medium hover:bg-[#f5f8fa] transition-colors"
              >
                <Plus className="h-4 w-4" />
                New project
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
