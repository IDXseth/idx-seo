'use client'

import { useRouter, useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()

  function handleChange(type: PromptTypeFilter) {
    // Seed from the current URL so any param this component doesn't know about
    // (level of care, a cross-segment scope like market=Cincinnati, competitor, …)
    // survives the navigation instead of being silently dropped.
    const params = new URLSearchParams(searchParams.toString())
    if (projectId) params.set('project', projectId)
    if (sessionId) params.set('session', sessionId)
    if (type !== 'all') params.set('type', type)
    else params.delete('type')
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
