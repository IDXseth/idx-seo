'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, BarChart2 } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { GscSiteSelector } from './gsc-site-selector'
import type { CommunityWithSitemapStatus, SitemapEntry, SitemapAnalysis, ActionItem } from '@/lib/sitemap'

interface Props {
  communities: CommunityWithSitemapStatus[]
  untrackedPages: SitemapEntry[]
  summary: SitemapAnalysis['summary']
  fetchedAt: string
  error: string | null
  gscEnabled: boolean
}

type FilterTab = 'all' | 'has_page' | 'no_page' | 'not_tracked'
type SortKey = 'priority' | 'score_asc' | 'score_desc' | 'name'

const CATEGORY_BADGE: Record<ActionItem['category'], string> = {
  page: 'bg-rose-100 text-rose-700',
  content: 'bg-teal-100 text-teal-700',
  technical: 'bg-amber-100 text-amber-700',
  monitoring: 'bg-gray-100 text-gray-600',
}

const PRIORITY_BADGE: Record<ActionItem['priority'], string> = {
  high: 'text-rose-600',
  medium: 'text-amber-600',
  low: 'text-gray-400',
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 60
      ? 'bg-emerald-100 text-emerald-700'
      : score >= 30
      ? 'bg-amber-100 text-amber-700'
      : 'bg-rose-100 text-rose-700'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score}
    </span>
  )
}

function StatusBadge({ status }: { status: CommunityWithSitemapStatus['sitemapStatus'] }) {
  const styles: Record<typeof status, string> = {
    has_page: 'bg-teal-100 text-teal-700',
    no_page: 'bg-rose-100 text-rose-700',
    not_tracked: 'bg-gray-100 text-gray-500',
  }
  const labels: Record<typeof status, string> = {
    has_page: 'Has Page',
    no_page: 'No Page',
    not_tracked: 'Not Tracked',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function ActionItemsPanel({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return <p className="text-xs text-[#8aadb8] py-2">No action items.</p>
  return (
    <ul className="space-y-3 py-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className={`text-xs font-bold mt-0.5 w-12 flex-shrink-0 ${PRIORITY_BADGE[item.priority]}`}>
            {item.priority.toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_BADGE[item.category]}`}>
                {item.category}
              </span>
              <span className="text-xs font-semibold text-[#084c61]">{item.label}</span>
            </div>
            <p className="text-xs text-[#5a7a85] leading-relaxed">{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function GscIndexBadge({ isIndexed }: { isIndexed: boolean }) {
  return isIndexed ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
      Indexed
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-700">
      Not indexed
    </span>
  )
}

function CommunityRow({
  c,
  rank,
  gscEnabled,
}: {
  c: CommunityWithSitemapStatus
  rank?: number
  gscEnabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const colSpan = gscEnabled ? 12 : 9
  return (
    <>
      <tr className="border-b border-[#f0f5f7] hover:bg-[#f9fbfc] transition-colors">
        <td className="px-4 py-3 text-center">
          {rank != null ? (
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#084c61] text-white text-xs font-bold">
              {rank}
            </span>
          ) : (
            <span className="text-[#c0d5dc] text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-[#084c61]">{c.communityName}</p>
        </td>
        <td className="px-4 py-3 text-sm text-[#5a7a85] whitespace-nowrap">{c.city}</td>
        <td className="px-4 py-3 text-center">
          <ScorePill score={c.visibilityScore} />
        </td>
        <td className="px-4 py-3 text-center text-sm text-[#5a7a85]">
          {Math.round(c.mentionRate * 100)}%
        </td>
        <td className="px-4 py-3 text-center text-sm text-[#5a7a85]">
          {Math.round(c.citationRate * 100)}%
        </td>
        <td className="px-4 py-3 text-center">
          <StatusBadge status={c.sitemapStatus} />
        </td>
        <td className="px-4 py-3 text-center">
          {c.sitemapUrl ? (
            <a
              href={c.sitemapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center text-[#177e89] hover:text-[#084c61] transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <span className="text-[#c0d5dc]">—</span>
          )}
        </td>
        {gscEnabled && (
          <>
            <td className="px-4 py-3 text-center">
              {c.gsc ? (
                <GscIndexBadge isIndexed={c.gsc.isIndexed} />
              ) : (
                <span className="text-[#c0d5dc] text-xs">—</span>
              )}
            </td>
            <td className="px-4 py-3 text-center text-sm text-[#5a7a85]">
              {c.gsc ? c.gsc.impressions.toLocaleString() : '—'}
            </td>
            <td className="px-4 py-3 text-center text-sm text-[#5a7a85]">
              {c.gsc?.position != null ? c.gsc.position.toFixed(1) : '—'}
            </td>
          </>
        )}
        <td className="px-4 py-3 text-center">
          {c.actionItems.length > 0 && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#177e89] hover:text-[#084c61] transition-colors"
            >
              Actions
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-[#f9fbfc]">
          <td colSpan={colSpan} className="px-8 pb-4">
            <ActionItemsPanel items={c.actionItems} />
          </td>
        </tr>
      )}
    </>
  )
}

export function OptimizationPriorityTable({ communities, untrackedPages, summary, fetchedAt, error, gscEnabled }: Props) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [sort, setSort] = useState<SortKey>('priority')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [googleConnected, setGoogleConnected] = useState(false)

  useEffect(() => {
    fetch('/api/gsc/sites').then(r => r.ok ? r.json() : { sites: [] }).then(d => {
      setGoogleConnected((d.sites ?? []).length > 0)
    }).catch(() => {})
  }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/gsc/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) setSyncMsg(`Error: ${json.error}`)
      else setSyncMsg(`Synced ${json.pagesUpdated} pages. Reload to see updated scores.`)
    } catch {
      setSyncMsg('Sync failed — check console.')
    } finally {
      setSyncing(false)
    }
  }

  const filtered = communities.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'has_page') return c.sitemapStatus === 'has_page'
    if (filter === 'no_page') return c.sitemapStatus === 'no_page'
    return false
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'priority') {
      const ap = a.optimizationPriority ?? 9999
      const bp = b.optimizationPriority ?? 9999
      return ap - bp
    }
    if (sort === 'score_asc') return a.visibilityScore - b.visibilityScore
    if (sort === 'score_desc') return b.visibilityScore - a.visibilityScore
    return a.communityName.localeCompare(b.communityName)
  })

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: communities.length },
    { key: 'has_page', label: 'Has Page', count: summary.withPage },
    { key: 'no_page', label: 'No Page', count: summary.noPage },
    { key: 'not_tracked', label: 'Not Tracked', count: summary.notTracked },
  ]

  return (
    <div className="space-y-6">
      {/* GSC not connected — show connect button */}
      {!gscEnabled && !googleConnected && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[#f0f5f7] border border-[#dde6ea] rounded-xl p-4">
          <BarChart2 className="h-5 w-5 text-[#177e89] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#084c61]">Connect Google Search Console</p>
            <p className="text-xs text-[#5a7a85] mt-0.5">
              Unlock index status, organic impressions, and position data per community. Scores will use the
              enhanced formula:{' '}
              <span className="font-mono text-[#084c61]">mention×0.35 + citation×0.35 + impressions×0.15 + indexed×0.15</span>
            </p>
          </div>
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard?tab=optimization' })}
            className="flex-shrink-0 px-4 py-2 rounded-lg bg-[#084c61] text-white text-xs font-semibold hover:bg-[#177e89] transition-colors whitespace-nowrap"
          >
            Connect with Google
          </button>
        </div>
      )}

      {/* GSC connected but no domain selected — show domain picker */}
      {!gscEnabled && googleConnected && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[#f0f5f7] border border-[#dde6ea] rounded-xl p-4">
          <BarChart2 className="h-5 w-5 text-[#177e89] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#084c61]">Select your Search Console property</p>
            <p className="text-xs text-[#5a7a85] mt-0.5">
              Google account connected. Choose which property to pull data from, then click Sync.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-white border border-[#dde6ea] rounded-lg overflow-visible">
              <GscSiteSelector />
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 rounded-lg bg-[#084c61] text-white text-xs font-semibold hover:bg-[#177e89] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </div>
      )}

      {/* GSC connected with data — sync button */}
      {gscEnabled && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <span className="text-xs text-emerald-700 font-medium flex-1">
            Search Console connected · scores include index status &amp; impressions
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      )}
      {syncMsg && (
        <p className="text-xs text-[#5a7a85] px-1">{syncMsg}</p>
      )}


      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Sitemap data unavailable.</span> Showing last known status.{' '}
            <span className="text-amber-600 text-xs">({error})</span>
          </p>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tracked Communities', value: summary.totalTracked },
          { label: 'Have a Page', value: summary.withPage, color: 'text-teal-600' },
          { label: 'Missing a Page', value: summary.noPage, color: 'text-rose-500' },
          { label: 'Not Yet Tracked', value: summary.notTracked, color: 'text-gray-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#dde6ea] p-4">
            <p className="text-xs font-medium text-[#5a7a85] mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color ?? 'text-[#084c61]'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#dde6ea] overflow-hidden">
        {/* Controls */}
        <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-[#f0f5f7]">
          {/* Filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {filterTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === t.key
                    ? 'bg-[#084c61] text-white'
                    : 'bg-[#f0f5f7] text-[#5a7a85] hover:bg-[#e4edf0]'
                }`}
              >
                {t.label}
                <span className={`ml-1.5 ${filter === t.key ? 'text-white/70' : 'text-[#8aadb8]'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="sm:ml-auto flex items-center gap-2">
            <span className="text-xs text-[#8aadb8]">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="text-xs border border-[#dde6ea] rounded-lg px-2.5 py-1.5 text-[#084c61] bg-white focus:outline-none focus:ring-1 focus:ring-[#177e89]"
            >
              <option value="priority">Priority (default)</option>
              <option value="score_asc">Score: Low → High</option>
              <option value="score_desc">Score: High → Low</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-[#f0f5f7]">
                {[
                  'Rank',
                  'Community',
                  'City',
                  'Score',
                  'Mention %',
                  'Citation %',
                  'Status',
                  'Page',
                  ...(gscEnabled ? ['Indexed', 'Impressions', 'Position'] : []),
                  'Actions',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-semibold text-[#8aadb8] uppercase tracking-wider text-center"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={gscEnabled ? 12 : 9}
                    className="px-4 py-10 text-center text-sm text-[#8aadb8]"
                  >
                    No communities match this filter.
                  </td>
                </tr>
              ) : (
                sorted.map((c) => (
                  <CommunityRow
                    key={c.communityName}
                    c={c}
                    rank={c.optimizationPriority ?? undefined}
                    gscEnabled={gscEnabled}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Untracked pages section */}
        {filter === 'not_tracked' && untrackedPages.length > 0 && (
          <div className="border-t border-[#f0f5f7] px-5 py-4">
            <p className="text-xs font-semibold text-[#5a7a85] mb-3">
              Sitemap pages not yet in monitoring ({untrackedPages.length})
            </p>
            <ul className="space-y-1.5">
              {untrackedPages.map((p) => (
                <li key={p.url} className="flex items-center gap-2">
                  <span className="text-xs text-[#5a7a85] truncate">{p.communitySlug}</span>
                  <span className="text-[#c0d5dc] text-xs">/</span>
                  <span className="text-xs text-[#8aadb8]">{p.citySlug}</span>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#177e89] hover:text-[#084c61] ml-auto flex-shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Freshness note */}
        <div className="px-5 py-3 border-t border-[#f0f5f7] bg-[#f9fbfc]">
          <p className="text-xs text-[#8aadb8]">
            Sitemap last fetched:{' '}
            {new Date(fetchedAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' · '}Refreshes hourly.
          </p>
        </div>
      </div>
    </div>
  )
}
