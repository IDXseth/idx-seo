'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, ChevronDown, ChevronUp, AlertTriangle, FileWarning, Globe } from 'lucide-react'
import { cn, slugify, formatPercent } from '@/lib/utils'
import type { CommunityWithSitemapStatus, SitemapEntry, ActionItem } from '@/lib/sitemap'

type FilterTab = 'all' | 'has_page' | 'no_page' | 'not_tracked'
type SortKey = 'priority' | 'score_asc' | 'score_desc' | 'name'

interface Props {
  communities: CommunityWithSitemapStatus[]
  untrackedPages: SitemapEntry[]
  summary: {
    totalTracked: number
    withPage: number
    noPage: number
    notTracked: number
    avgScoreWithPage: number
  }
  fetchedAt: string
  error: string | null
}

export function OptimizationPriorityTable({ communities, untrackedPages, summary, fetchedAt, error }: Props) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [sort, setSort] = useState<SortKey>('priority')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const filtered = communities.filter(c => {
    if (filter === 'all') return true
    if (filter === 'has_page') return c.sitemapStatus === 'has_page'
    if (filter === 'no_page') return c.sitemapStatus === 'no_page'
    if (filter === 'not_tracked') return c.sitemapStatus === 'not_tracked'
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'priority') {
      // has_page ranked first, then by optimizationPriority, then no_page
      const statusOrder = { has_page: 0, no_page: 1, not_tracked: 2 }
      const statusDiff = statusOrder[a.sitemapStatus] - statusOrder[b.sitemapStatus]
      if (statusDiff !== 0) return statusDiff
      if (a.optimizationPriority !== null && b.optimizationPriority !== null)
        return a.optimizationPriority - b.optimizationPriority
      return 0
    }
    if (sort === 'score_asc') return a.visibilityScore - b.visibilityScore
    if (sort === 'score_desc') return b.visibilityScore - a.visibilityScore
    if (sort === 'name') return a.communityName.localeCompare(b.communityName)
    return 0
  })

  const fetchedDate = new Date(fetchedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Sitemap data unavailable</p>
            <p className="text-xs text-amber-700 mt-0.5">{error}. Page status may be inaccurate.</p>
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Tracked Communities" value={summary.totalTracked} color="text-[#084c61]" />
        <SummaryCard label="Have a Page" value={summary.withPage} color="text-teal-600" />
        <SummaryCard label="Missing a Page" value={summary.noPage} color="text-rose-600" />
        <SummaryCard label="Not Yet Tracked" value={summary.notTracked} color="text-[#8aadb8]" />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-[#dde6ea] bg-[#f8fafb] p-1">
          {([
            ['all', 'All'],
            ['has_page', 'Has Page'],
            ['no_page', 'No Page'],
            ['not_tracked', 'Not Tracked'],
          ] as [FilterTab, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                filter === value
                  ? 'bg-white text-[#084c61] shadow-sm border border-[#dde6ea]'
                  : 'text-[#5a7a85] hover:text-[#084c61]'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-xs text-[#8aadb8]">Sort:</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="text-xs text-[#084c61] border border-[#dde6ea] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#177e89]"
          >
            <option value="priority">Priority (default)</option>
            <option value="score_asc">Score: Low → High</option>
            <option value="score_desc">Score: High → Low</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#dde6ea] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eef3f5] bg-[#f8fafb]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#5a7a85] w-10">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#5a7a85]">Community</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#5a7a85] hidden sm:table-cell">City</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#5a7a85]">Score</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#5a7a85] hidden md:table-cell">Mention</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#5a7a85] hidden md:table-cell">Citation</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#5a7a85]">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#5a7a85]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-xs text-[#8aadb8]">
                    No communities match this filter
                  </td>
                </tr>
              ) : (
                sorted.map(c => (
                  <CommunityRow
                    key={c.communityName}
                    community={c}
                    expanded={expanded.has(c.communityName)}
                    onToggle={() => toggleExpand(c.communityName)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Not-tracked pages section */}
        {filter === 'not_tracked' && untrackedPages.length > 0 && (
          <div className="border-t border-[#eef3f5] px-4 py-4">
            <p className="text-xs font-semibold text-[#5a7a85] mb-3 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Sitemap pages not yet in your monitoring ({untrackedPages.length})
            </p>
            <div className="space-y-1.5">
              {untrackedPages.slice(0, 20).map(p => (
                <div key={p.url} className="flex items-center gap-2 text-xs text-[#5a7a85]">
                  <FileWarning className="h-3.5 w-3.5 text-[#b8cdd3] flex-shrink-0" />
                  <span className="font-medium text-[#084c61]">
                    {p.communitySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span className="text-[#b8cdd3]">·</span>
                  <span>{p.citySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[#177e89] hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
              {untrackedPages.length > 20 && (
                <p className="text-xs text-[#8aadb8] pt-1">
                  +{untrackedPages.length - 20} more pages not shown
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Freshness note */}
      <p className="text-[11px] text-[#b8cdd3] text-right">
        Sitemap last fetched: {fetchedDate}
      </p>
    </div>
  )
}

// ── Row component ─────────────────────────────────────────────────────────────

function CommunityRow({
  community: c,
  expanded,
  onToggle,
}: {
  community: CommunityWithSitemapStatus
  expanded: boolean
  onToggle: () => void
}) {
  const scoreColor =
    c.visibilityScore >= 60 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : c.visibilityScore >= 30 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200'

  return (
    <>
      <tr className={cn('border-b border-[#eef3f5] hover:bg-[#f8fafb] transition-colors', expanded && 'bg-[#f8fafb]')}>
        {/* Rank */}
        <td className="px-4 py-3 text-xs text-[#b8cdd3] font-medium">
          {c.optimizationPriority ?? '—'}
        </td>

        {/* Community name */}
        <td className="px-4 py-3">
          <Link
            href={`/dashboard/community/${encodeURIComponent(slugify(c.communityName))}`}
            className="font-medium text-[#084c61] hover:text-[#177e89] hover:underline text-xs leading-tight block"
          >
            {c.communityName}
          </Link>
          <span className="text-[11px] text-[#8aadb8]">{c.promptCount} prompt{c.promptCount !== 1 ? 's' : ''}</span>
        </td>

        {/* City */}
        <td className="px-4 py-3 text-xs text-[#5a7a85] hidden sm:table-cell">{c.city}</td>

        {/* Visibility score */}
        <td className="px-4 py-3 text-center">
          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full border', scoreColor)}>
            {c.visibilityScore}
          </span>
        </td>

        {/* Mention rate */}
        <td className="px-4 py-3 text-center hidden md:table-cell">
          <RateCell rate={c.mentionRate} />
        </td>

        {/* Citation rate */}
        <td className="px-4 py-3 text-center hidden md:table-cell">
          <RateCell rate={c.citationRate} />
        </td>

        {/* Status */}
        <td className="px-4 py-3 text-center">
          <StatusBadge status={c.sitemapStatus} url={c.sitemapUrl} />
        </td>

        {/* Actions toggle */}
        <td className="px-4 py-3 text-center">
          {c.actionItems.length > 0 && (
            <button
              onClick={onToggle}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#177e89] hover:text-[#084c61] transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" /> Hide</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> {c.actionItems.length} action{c.actionItems.length !== 1 ? 's' : ''}</>
              )}
            </button>
          )}
        </td>
      </tr>

      {/* Expanded action items */}
      {expanded && c.actionItems.length > 0 && (
        <tr className="border-b border-[#eef3f5] bg-[#f8fafb]">
          <td colSpan={8} className="px-6 py-4">
            <div className="space-y-3">
              {c.actionItems.map((item, i) => (
                <ActionItemRow key={i} item={item} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function RateCell({ rate }: { rate: number }) {
  const color =
    rate >= 0.6 ? 'text-emerald-600'
    : rate >= 0.3 ? 'text-amber-600'
    : 'text-rose-600'
  return <span className={cn('text-xs font-semibold', color)}>{formatPercent(rate)}</span>
}

function StatusBadge({ status, url }: { status: CommunityWithSitemapStatus['sitemapStatus']; url: string | null }) {
  if (status === 'has_page') {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-teal-50 text-teal-700 border-teal-200">
          Has Page
        </span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#b8cdd3] hover:text-[#177e89] transition-colors"
            title="View page"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    )
  }
  if (status === 'no_page') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200">
        No Page
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#f0f5f7] text-[#5a7a85] border-[#dde6ea]">
      Not Tracked
    </span>
  )
}

function ActionItemRow({ item }: { item: ActionItem }) {
  const priorityColor =
    item.priority === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200'
    : item.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-[#f0f5f7] text-[#5a7a85] border-[#dde6ea]'

  const categoryColor =
    item.category === 'page' ? 'bg-rose-50 text-rose-600 border-rose-200'
    : item.category === 'content' ? 'bg-teal-50 text-teal-700 border-teal-200'
    : item.category === 'technical' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-[#f0f5f7] text-[#5a7a85] border-[#dde6ea]'

  return (
    <div className="flex items-start gap-3">
      <div className="flex gap-1.5 flex-shrink-0 mt-0.5">
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border capitalize', priorityColor)}>
          {item.priority}
        </span>
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border capitalize', categoryColor)}>
          {item.category}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#084c61] leading-snug">{item.label}</p>
        <p className="text-[11px] text-[#5a7a85] mt-0.5 leading-relaxed">{item.detail}</p>
      </div>
    </div>
  )
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#dde6ea] p-4">
      <p className="text-xs text-[#5a7a85] mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
    </div>
  )
}
