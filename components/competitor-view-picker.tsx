'use client'

import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'

export interface CompetitorOption {
  id: string
  brandName: string
}

export function CompetitorViewPicker({
  competitors,
  currentCompetitorId,
  basePath = '/dashboard',
  sessionId,
  projectId,
  promptType,
}: {
  competitors: CompetitorOption[]
  currentCompetitorId?: string
  basePath?: string
  sessionId?: string
  projectId?: string
  promptType?: string
}) {
  const router = useRouter()

  function handleChange(id: string) {
    const params = new URLSearchParams()
    if (projectId) params.set('project', projectId)
    if (promptType) params.set('type', promptType)
    // A run-session snapshot from one lens rarely lines up with another —
    // switching who we're viewing drops it, same as switching projects does.
    if (sessionId) params.set('session', sessionId)
    if (id) params.set('competitor', id)
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  if (competitors.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-[#5a7a85] shrink-0" />
      <div className="flex flex-col">
        <label className="text-[10px] font-semibold text-[#8aadb8] uppercase tracking-wider mb-0.5">
          Viewing
        </label>
        <select
          value={currentCompetitorId ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className="text-sm font-medium text-[#084c61] bg-white border border-[#dde6ea] rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-[#177e89] cursor-pointer min-w-[180px]"
        >
          <option value="">Your Brand</option>
          {competitors.map((c) => (
            <option key={c.id} value={c.id}>{c.brandName}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
