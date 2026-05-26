'use client'

import { useRouter } from 'next/navigation'

const OPTIONS = [
  { value: '', label: 'All' },
  { value: 'brand', label: 'Brand' },
  { value: 'nonbrand', label: 'Non-brand' },
] as const

export function PromptTypeFilter({
  current,
  sessionId,
}: {
  current: string
  sessionId?: string
}) {
  const router = useRouter()

  function set(value: string) {
    const params = new URLSearchParams()
    if (value) params.set('type', value)
    if (sessionId) params.set('session', sessionId)
    const qs = params.toString()
    router.push(`/dashboard${qs ? `?${qs}` : ''}`)
  }

  return (
    <div className="flex items-center gap-0.5 bg-[#f0f4f7] rounded-lg p-1">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => set(value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            current === value
              ? 'bg-white text-[#084c61] shadow-sm'
              : 'text-[#5a7a85] hover:text-[#084c61]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
