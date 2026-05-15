'use client'

import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'

export interface SessionOption {
  id: string
  startedAt: string
  triggeredBy: string
  resultCount: number
}

function formatSessionLabel(s: SessionOption): string {
  const d = new Date(s.startedAt)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const trigger = s.triggeredBy === 'scheduled' ? 'scheduled' : 'manual'
  return `${date} at ${time} (${trigger})`
}

export function RunSessionPicker({
  sessions,
  currentSessionId,
}: {
  sessions: SessionOption[]
  currentSessionId?: string
}) {
  const router = useRouter()

  function handleChange(id: string) {
    router.push(id ? `/dashboard?session=${id}` : '/dashboard')
  }

  if (sessions.length < 2) return null

  const current = sessions.find((s) => s.id === currentSessionId)

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-[#5a7a85] shrink-0" />
      <div className="flex flex-col">
        <label className="text-[10px] font-semibold text-[#8aadb8] uppercase tracking-wider mb-0.5">
          Run snapshot
        </label>
        <select
          value={currentSessionId ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className="text-sm font-medium text-[#084c61] bg-white border border-[#dde6ea] rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-[#177e89] cursor-pointer min-w-[260px]"
        >
          <option value="">All runs (aggregate)</option>
          {[...sessions].reverse().map((s) => (
            <option key={s.id} value={s.id}>
              {formatSessionLabel(s)}
            </option>
          ))}
        </select>
      </div>
      {current && (
        <span className="text-xs text-[#8aadb8] hidden sm:block">
          {current.resultCount.toLocaleString()} results
        </span>
      )}
    </div>
  )
}
