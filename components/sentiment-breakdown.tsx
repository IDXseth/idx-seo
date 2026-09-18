'use client'

import { useMemo, useState } from 'react'
import { countSentiments, SentimentRow } from '@/lib/sentiment'
import { SentimentPieChart } from '@/components/sentiment-pie-chart'
import { cn } from '@/lib/utils'

type TypeFilter = 'all' | 'brand' | 'nonbrand'

export function SentimentBreakdown({
  rows,
  title = 'Sentiment Breakdown',
}: {
  rows: SentimentRow[]
  title?: string
}) {
  const [projectId, setProjectId] = useState('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  const projects = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) map.set(r.projectId, r.projectName)
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const hasBrand = rows.some((r) => r.promptType === 'brand')
  const hasNonbrand = rows.some((r) => r.promptType === 'nonbrand')

  const filteredRows = rows.filter(
    (r) =>
      (projectId === 'all' || r.projectId === projectId) &&
      (typeFilter === 'all' || r.promptType === typeFilter)
  )
  const counts = countSentiments(filteredRows)

  return (
    <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-sm font-semibold text-[#084c61]">{title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {projects.length > 1 && (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="text-xs font-medium text-[#084c61] bg-white border border-[#dde6ea] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#177e89] cursor-pointer"
            >
              <option value="all">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {hasBrand && hasNonbrand && (
            <div className="flex items-center gap-0.5 bg-[#f0f4f7] rounded-lg p-1">
              {([['all', 'All'], ['brand', 'Brand'], ['nonbrand', 'Non-brand']] as [TypeFilter, string][]).map(
                ([type, label]) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                      typeFilter === type
                        ? 'bg-white text-[#084c61] shadow-sm'
                        : 'text-[#5a7a85] hover:text-[#084c61]'
                    )}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
      <SentimentPieChart counts={counts} />
    </div>
  )
}
