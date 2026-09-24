'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Layers } from 'lucide-react'

export interface PromptSetOption {
  id: string
  name: string
}

// Filters the dashboard to one prompt set (an uploaded batch) within the active
// project. The URL param is still `project` for existing links.
export function PromptSetPicker({
  promptSets,
  currentSetId,
  basePath = '/dashboard',
  promptType,
}: {
  promptSets: PromptSetOption[]
  currentSetId?: string
  basePath?: string
  promptType?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(id: string) {
    // Seed from the current URL so any param this component doesn't know about
    // (level of care, a cross-segment scope like market=Cincinnati, competitor, …)
    // survives the navigation instead of being silently dropped.
    const params = new URLSearchParams(searchParams.toString())
    if (id) params.set('project', id)
    else params.delete('project')
    // Switching prompt sets drops the run-snapshot filter — a session picked in one
    // set's history rarely applies to another — but keeps the brand/non-brand toggle.
    params.delete('session')
    if (promptType) params.set('type', promptType)
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  if (promptSets.length < 1) return null

  return (
    <div className="flex items-center gap-2">
      <Layers className="h-4 w-4 text-[#5a7a85] shrink-0" />
      <div className="flex flex-col">
        <label className="text-[10px] font-semibold text-[#8aadb8] uppercase tracking-wider mb-0.5">
          Prompt set
        </label>
        <select
          value={currentSetId ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className="text-sm font-medium text-[#084c61] bg-white border border-[#dde6ea] rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-[#177e89] cursor-pointer min-w-[200px]"
        >
          <option value="">All prompt sets</option>
          {promptSets.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
