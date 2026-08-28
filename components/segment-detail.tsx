'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { PlatformMentionChart } from '@/components/platform-chart'
import { BrandComparisonChart } from '@/components/brand-comparison-chart'
import { RunSessionPicker, SessionOption } from '@/components/run-session-picker'
import { PromptTypeToggle, PromptTypeFilter } from '@/components/prompt-type-toggle'
import { ProjectPicker, ProjectOption } from '@/components/project-picker'
import { TrendCharts, TrendPoint } from '@/components/trend-charts'
import { PLATFORM_LABELS, PLATFORM_COLORS, formatPercent, cn } from '@/lib/utils'
import { ChevronLeft, Target, Quote, FileText, ExternalLink, Trophy } from 'lucide-react'
import type { CompetitorLeaderboardEntry, BrandComparison } from '@/lib/competitor-stats'

interface Citation {
  id: string
  url: string
  title: string
  domain: string
}

interface Result {
  id: string
  platform: string
  responseText: string
  isMentioned: boolean
  isCited: boolean
  sentiment: string
  citations: Citation[]
}

interface Prompt {
  id: string
  promptText: string
  promptType: string
  category: string
  communityName: string
  city: string
  market: string
  levelOfCare: string
  results: Result[]
}

interface PlatformStat {
  platform: string
  mentionRate: number
  citationRate: number
  total: number
}

interface TopDomain {
  domain: string
  count: number
  percentage: number
}

interface Overview {
  promptCount: number
  mentionRate: number
  citationRate: number
}

interface SegmentDetailProps {
  title: string
  backHref: string
  backLabel: string
  overview: Overview
  platformStats: PlatformStat[]
  topDomains: TopDomain[]
  prompts: Prompt[]
  sessionId?: string
  showCommunity?: boolean
  sessions?: SessionOption[]
  basePath?: string
  trendData?: TrendPoint[]
  competitorLeaderboard?: CompetitorLeaderboardEntry[] | null
  brandComparison?: BrandComparison | null
  promptTypeFilter?: PromptTypeFilter
  projectId?: string
  projects?: ProjectOption[]
}

export function SegmentDetail({
  title,
  backHref,
  backLabel,
  overview,
  platformStats,
  topDomains,
  prompts,
  sessionId,
  showCommunity = false,
  sessions,
  basePath,
  trendData,
  competitorLeaderboard,
  brandComparison,
  promptTypeFilter = 'all',
  projectId,
  projects,
}: SegmentDetailProps) {
  const platforms = platformStats.map((p) => p.platform)

  const maxDomainCount = topDomains[0]?.count ?? 1

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href={backHref} className="flex items-center gap-1 text-sm text-[#177e89] hover:text-[#084c61] font-medium transition-colors">
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <span className="text-[#b8cdd3]">/</span>
        <span className="text-sm text-[#5a7a85]">{title}</span>
      </div>

      {/* Page title + controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>{title}</h1>
          {sessionId && (
            <p className="text-xs text-[#8aadb8] mt-1">
              Filtered to a single run snapshot — <Link
                href={(() => {
                  const [path, query] = backHref.split('?')
                  const params = new URLSearchParams(query)
                  params.delete('session')
                  const qs = params.toString()
                  return qs ? `${path}?${qs}` : path
                })()}
                className="underline hover:text-[#084c61]"
              >view all runs</Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {projects && (
            <ProjectPicker
              projects={projects}
              currentProjectId={projectId}
              basePath={basePath ?? '/dashboard'}
              promptType={promptTypeFilter === 'all' ? undefined : promptTypeFilter}
            />
          )}
          <PromptTypeToggle value={promptTypeFilter} basePath={basePath ?? '/dashboard'} sessionId={sessionId} projectId={projectId} />
          {sessions && (
            <RunSessionPicker
              sessions={sessions}
              currentSessionId={sessionId}
              basePath={basePath}
              projectId={projectId}
              promptType={promptTypeFilter === 'all' ? undefined : promptTypeFilter}
            />
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <FileText className="h-5 w-5 text-[#084c61]" />, bg: 'bg-[#e6f2f5]', label: 'Prompts', value: overview.promptCount },
          { icon: <Target className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-50', label: 'Mention Rate', value: formatPercent(overview.mentionRate) },
          { icon: <Quote className="h-5 w-5 text-[#177e89]" />, bg: 'bg-[#e6f2f5]', label: 'Citation Rate', value: formatPercent(overview.citationRate) },
        ].map(({ icon, bg, label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-[#dde6ea] p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
              <p className="text-xs font-medium text-[#5a7a85]">{label}</p>
            </div>
            <p className="text-3xl font-bold text-[#084c61] leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Competitor comparison */}
      {competitorLeaderboard && competitorLeaderboard.length > 0 && (
        <CompetitorComparison entries={competitorLeaderboard} />
      )}

      {/* Trend charts — aggregate view only */}
      {!sessionId && trendData && trendData.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#084c61] mb-4">Performance Over Time</h2>
          <TrendCharts data={trendData} />
        </div>
      )}

      {/* Platform Chart */}
      <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
        <h2 className="text-sm font-semibold text-[#084c61] mb-4">
          {brandComparison && brandComparison.brands.length > 1 ? 'Performance by Platform — All Brands' : 'Performance by Platform'}
        </h2>
        {brandComparison && brandComparison.brands.length > 1 ? (
          <BrandComparisonChart brands={brandComparison.brands} anyBrand={brandComparison.anyBrand} />
        ) : (
          <PlatformMentionChart data={platformStats} />
        )}
      </div>

      {/* Top Citation Sources */}
      {topDomains.length > 0 && (
        <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
          <h2 className="text-sm font-semibold text-[#084c61] mb-5">Top Citation Sources</h2>
          <div className="space-y-3">
            {topDomains.map((d) => (
              <div key={d.domain} className="flex items-center gap-4">
                <span className="text-sm text-[#084c61] font-medium w-48 truncate flex-shrink-0">{d.domain}</span>
                <div className="flex-1 h-2 bg-[#eef3f5] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(d.count / maxDomainCount) * 100}%`, background: '#177e89' }}
                  />
                </div>
                <span className="text-xs text-[#5a7a85] w-16 text-right flex-shrink-0">
                  {d.count} · {formatPercent(d.percentage)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Citation Pages */}
      {(() => {
        const allCitations = prompts.flatMap((p) => p.results.flatMap((r) => r.citations))
        const urlMap = new Map<string, { title: string; domain: string; count: number }>()
        for (const c of allCitations) {
          if (!c.url) continue
          const existing = urlMap.get(c.url)
          if (existing) existing.count++
          else urlMap.set(c.url, { title: c.title || c.url, domain: c.domain, count: 1 })
        }
        const topUrls = [...urlMap.entries()]
          .map(([url, { title, domain, count }]) => ({ url, title, domain, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
        if (topUrls.length === 0) return null
        return (
          <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
            <h2 className="text-sm font-semibold text-[#084c61] mb-5">Top Citation Pages</h2>
            <div className="space-y-2">
              {topUrls.map(({ url, title, domain, count }) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-[#f5f8fa] hover:bg-[#e6f2f5] transition-colors group"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#8aadb8] flex-shrink-0 group-hover:text-[#177e89] transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#084c61] truncate">{title}</p>
                    <p className="text-[10px] text-[#8aadb8]">{domain}</p>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#e6f2f5] text-[#084c61]">
                    {count}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Prompts Table */}
      <div className="bg-white rounded-xl border border-[#dde6ea] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#eef3f5]">
          <h2 className="text-sm font-semibold text-[#084c61]">
            {promptTypeFilter === 'all' ? 'All Prompts' : promptTypeFilter === 'brand' ? 'Brand Prompts' : 'Non-brand Prompts'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eef3f5] bg-[#f5f8fa]">
                <th className="text-left px-6 py-3 font-medium text-[#5a7a85] text-xs min-w-[220px]">Prompt</th>
                <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Type</th>
                {showCommunity && (
                  <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs min-w-[160px]">Community</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Category</th>
                <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Level of Care</th>
                <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Sentiment</th>
                {platforms.map((platform) => (
                  <th
                    key={platform}
                    className="text-left px-4 py-3 font-semibold text-xs min-w-[100px]"
                    style={{ color: PLATFORM_COLORS[platform] }}
                  >
                    {PLATFORM_LABELS[platform]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f4f7]">
              {prompts.map((prompt) => (
                <tr
                  key={prompt.id}
                  className="hover:bg-[#f5f8fa] cursor-pointer transition-colors"
                  onClick={() => { window.location.href = `/results/${prompt.id}` }}
                >
                  <td className="px-6 py-4">
                    <p className="line-clamp-2 text-[#1a1a1a] text-xs leading-relaxed">{prompt.promptText}</p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={prompt.promptType === 'brand' ? 'default' : 'secondary'}>
                      {prompt.promptType}
                    </Badge>
                  </td>
                  {showCommunity && (
                    <td className="px-4 py-4">
                      <p className="text-[#084c61] text-xs font-medium">{prompt.communityName || '—'}</p>
                      {prompt.city && <p className="text-[#8aadb8] text-[10px] mt-0.5">{prompt.city}</p>}
                    </td>
                  )}
                  <td className="px-4 py-4 text-[#5a7a85] text-xs">{prompt.category || '—'}</td>
                  <td className="px-4 py-4 text-[#5a7a85] text-xs">{prompt.levelOfCare || '—'}</td>
                  <td className="px-4 py-4">
                    {(() => {
                      const pos = prompt.results.filter((r) => r.sentiment === 'positive').length
                      const neg = prompt.results.filter((r) => r.sentiment === 'negative').length
                      const neu = prompt.results.filter((r) => r.sentiment === 'neutral').length
                      const majority = pos >= neg && pos >= neu ? 'positive' : neg >= pos && neg >= neu ? 'negative' : 'neutral'
                      if (majority === 'positive') return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 w-fit">Positive</span>
                      if (majority === 'negative') return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 w-fit">Negative</span>
                      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#f0f4f7] text-[#8aadb8] w-fit">Neutral</span>
                    })()}
                  </td>
                  {platforms.map((platform) => {
                    const result = prompt.results.find((r) => r.platform === platform)
                    if (!result) return <td key={platform} className="px-4 py-4 text-[#b8cdd3] text-xs">—</td>
                    return (
                      <td key={platform} className="px-4 py-4">
                        <PlatformCell responseText={result.responseText} isMentioned={result.isMentioned} isCited={result.isCited} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function rateColor(rate: number) {
  if (rate >= 0.6) return { text: 'text-emerald-600', bar: 'bg-emerald-500' }
  if (rate >= 0.3) return { text: 'text-amber-600', bar: 'bg-amber-400' }
  return { text: 'text-rose-600', bar: 'bg-rose-400' }
}

function CompetitorComparison({ entries }: { entries: CompetitorLeaderboardEntry[] }) {
  const platforms = Object.keys(entries[0]?.platformMentionRates ?? {})
  const brandColors: Record<string, string> = {}
  const palette = ['#d97706', '#7c6fe0', '#e0708a', '#0ea5e9', '#65a30d', '#c026d3']
  let paletteIdx = 0
  for (const e of entries) {
    brandColors[e.id] = e.isYou ? '#177e89' : palette[paletteIdx++ % palette.length]
  }

  return (
    <div className="bg-white rounded-xl border border-[#dde6ea] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#eef3f5] flex items-center gap-2">
        <Trophy className="h-4 w-4 text-[#177e89]" />
        <h2 className="text-sm font-semibold text-[#084c61]">Competitor Comparison</h2>
      </div>

      {/* Leaderboard */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#eef3f5] bg-[#f5f8fa]">
              <th className="text-left px-6 py-3 font-medium text-[#5a7a85] text-xs">Brand</th>
              <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Mention Rate</th>
              <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Citation Rate</th>
              <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Sentiment</th>
              <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Share of Voice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f4f7]">
            {entries.map((e) => {
              const mc = rateColor(e.mentionRate)
              const cc = rateColor(e.citationRate)
              return (
                <tr key={e.id} className={cn(e.isYou && 'bg-[#e6f2f5]')}>
                  <td className={cn('px-6 py-3.5', e.isYou && 'border-l-2 border-[#177e89]')}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: brandColors[e.id] }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={cn('text-xs font-semibold truncate', e.isYou ? 'text-[#084c61]' : 'text-[#1a1a1a]')}>{e.brandName}</p>
                          {e.isYou && (
                            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-[#084c61] text-white">You</span>
                          )}
                        </div>
                        <p className="text-[10px] text-[#b8cdd3]">{e.domain}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 w-32">
                    <p className={cn('text-xs font-bold mb-1', mc.text)}>{formatPercent(e.mentionRate)}</p>
                    <div className="h-1.5 bg-[#eef3f5] rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', mc.bar)} style={{ width: `${Math.round(e.mentionRate * 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 w-32">
                    <p className={cn('text-xs font-bold mb-1', cc.text)}>{formatPercent(e.citationRate)}</p>
                    <div className="h-1.5 bg-[#eef3f5] rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', cc.bar)} style={{ width: `${Math.round(e.citationRate * 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 w-36">
                    {e.mentioned > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 flex h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500" style={{ width: `${Math.round(e.sentiment.positive * 100)}%` }} />
                          <div className="bg-slate-300" style={{ width: `${Math.round(e.sentiment.neutral * 100)}%` }} />
                          <div className="bg-rose-400" style={{ width: `${Math.round(e.sentiment.negative * 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-[#8aadb8] whitespace-nowrap">{formatPercent(e.sentiment.positive)} pos</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#b8cdd3]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-extrabold text-[#084c61]">{formatPercent(e.shareOfVoice)}</p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Platform breakdown */}
      {platforms.length > 0 && (
        <div className="px-6 py-5 border-t border-[#eef3f5]">
          <p className="text-xs font-semibold text-[#084c61] mb-1">Mention Rate by AI Platform</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColors[e.id] }} />
                <span className={cn('text-[11px]', e.isYou ? 'text-[#084c61] font-semibold' : 'text-[#5a7a85]')}>{e.brandName}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {platforms.map((platform) => (
              <div key={platform} className="grid grid-cols-[130px_1fr] gap-4 items-center">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform] }} />
                  <span className="text-xs font-medium text-[#1a1a1a]">{PLATFORM_LABELS[platform]}</span>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${entries.length}, 1fr)` }}>
                  {entries.map((e) => (
                    <div key={e.id}>
                      <div className="h-1 bg-[#eef3f5] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.round(e.platformMentionRates[platform] * 100)}%`, backgroundColor: brandColors[e.id] }}
                        />
                      </div>
                      <p className="text-[10px] text-[#8aadb8] mt-0.5">{formatPercent(e.platformMentionRates[platform])}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PlatformCell({ responseText, isMentioned, isCited }: { responseText: string; isMentioned: boolean; isCited: boolean }) {
  const isNoAIO = responseText?.startsWith('[No AI Overview]')
  const isError = responseText?.startsWith('[Error]') || responseText?.startsWith('[Timeout]')
  if (isNoAIO || isError) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#f0f4f7] text-[#b8cdd3] w-fit italic">
        {isNoAIO ? 'No AI Overview' : 'Error'}
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <span className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold w-fit',
        isMentioned ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f0f4f7] text-[#8aadb8]'
      )}>
        {isMentioned ? 'Mentioned' : 'Not Mentioned'}
      </span>
      {isCited && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#e6f2f5] text-[#084c61] w-fit">
          Cited
        </span>
      )}
    </div>
  )
}
