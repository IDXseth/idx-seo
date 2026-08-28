'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export type PromptTypeFilter = 'all' | 'brand' | 'nonbrand'

const OPTIONS: [PromptTypeFilter, string][] = [
  ['all', 'All'],
  ['brand', 'Brand'],
  ['nonbrand', 'Non-brand'],
]

export function PromptTypeToggle({
  value,
  basePath,
  sessionId,
  projectId,
}: {
  value: PromptTypeFilter
  basePath: string
  sessionId?: string
  projectId?: string
}) {
  const router = useRouter()

  function handleChange(type: PromptTypeFilter) {
    const params = new URLSearchParams()
    if (projectId) params.set('project', projectId)
    if (sessionId) params.set('session', sessionId)
    if (type !== 'all') params.set('type', type)
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  return (
    <div className="flex items-center gap-0.5 bg-[#f0f4f7] rounded-lg p-1">
      {OPTIONS.map(([type, label]) => (
        <button
          key={type}
          onClick={() => handleChange(type)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-colors',
            value === type
              ? 'bg-white text-[#084c61] shadow-sm'
              : 'text-[#5a7a85] hover:text-[#084c61]'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
