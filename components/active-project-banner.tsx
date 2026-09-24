'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertCircle, FolderKanban } from 'lucide-react'

// Tells the user which project new prompts will be added to — uploads always
// go into the active project chosen in the nav.
export function ActiveProjectBanner() {
  const [state, setState] = useState<{ name: string | null; canCreate: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const active = data.projects.find((p: { id: string }) => p.id === data.activeProjectId)
        setState({ name: active?.name ?? null, canCreate: data.canCreate })
      })
      .catch(() => {})
  }, [])

  if (!state) return null

  if (!state.name) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        {state.canCreate ? (
          <span>Prompts belong to a project. <Link href="/projects/new" className="font-semibold underline">Create a project</Link> before uploading.</span>
        ) : (
          <span>Prompts belong to a project, and none has been shared with you yet.</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm text-[#084c61] bg-white border border-[#dde6ea] rounded-lg px-3 py-2 mb-6">
      <FolderKanban className="h-4 w-4 text-[#177e89] flex-shrink-0" />
      <span>Adding prompts to <span className="font-semibold">{state.name}</span> — switch projects in the top bar.</span>
    </div>
  )
}
