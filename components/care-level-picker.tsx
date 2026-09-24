'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Heart } from 'lucide-react'

export function CareLevelPicker({
  levels,
  currentLevel,
  basePath = '/dashboard',
  promptType,
  projectId,
  sessionId,
}: {
  levels: string[]
  currentLevel?: string
  basePath?: string
  promptType?: string
  projectId?: string
  sessionId?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(level: string) {
    // Seed from the current URL so any param this component doesn't know about
    // (a cross-segment scope like market=Cincinnati, competitor, …) survives the
    // navigation instead of being silently dropped.
    const params = new URLSearchParams(searchParams.toString())
    if (projectId) params.set('project', projectId)
    if (sessionId) params.set('session', sessionId)
    if (promptType) params.set('type', promptType)
    if (level) params.set('careLevel', level)
    else params.delete('careLevel')
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  if (levels.length < 2) return null

  return (
    <div className="flex items-center gap-2">
      <Heart className="h-4 w-4 text-[#5a7a85] shrink-0" />
      <div className="flex flex-col">
        <label className="text-[10px] font-semibold text-[#8aadb8] uppercase tracking-wider mb-0.5">
          Level of Care
        </label>
        <select
          value={currentLevel ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className="text-sm font-medium text-[#084c61] bg-white border border-[#dde6ea] rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-[#177e89] cursor-pointer min-w-[180px]"
        >
          <option value="">All levels of care</option>
          {levels.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
