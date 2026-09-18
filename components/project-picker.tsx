'use client'

import { useRouter } from 'next/navigation'
import { Layers } from 'lucide-react'

export interface ProjectOption {
  id: string
  name: string
}

export function ProjectPicker({
  projects,
  currentProjectId,
  basePath = '/dashboard',
  promptType,
}: {
  projects: ProjectOption[]
  currentProjectId?: string
  basePath?: string
  promptType?: string
}) {
  const router = useRouter()

  function handleChange(id: string) {
    const params = new URLSearchParams()
    if (id) params.set('project', id)
    // Switching projects drops the run-snapshot filter — a session picked in one
    // project's history rarely applies to another — but keeps the brand/non-brand toggle.
    if (promptType) params.set('type', promptType)
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  if (projects.length < 1) return null

  return (
    <div className="flex items-center gap-2">
      <Layers className="h-4 w-4 text-[#5a7a85] shrink-0" />
      <div className="flex flex-col">
        <label className="text-[10px] font-semibold text-[#8aadb8] uppercase tracking-wider mb-0.5">
          Project
        </label>
        <select
          value={currentProjectId ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          className="text-sm font-medium text-[#084c61] bg-white border border-[#dde6ea] rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-[#177e89] cursor-pointer min-w-[200px]"
        >
          <option value="">All projects (aggregate)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
