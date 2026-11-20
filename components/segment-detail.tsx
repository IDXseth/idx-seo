'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Scorecard } from '@/components/scorecard'
import { PlatformMentionChart } from '@/components/platform-chart'
import { BrandScorecards } from '@/components/brand-scorecards'
import { BrandTrendChart } from '@/components/brand-trend-chart'
import { RunSessionPicker, SessionOption } from '@/components/run-session-picker'
import { PromptTypeToggle, PromptTypeFilter } from '@/components/prompt-type-toggle'
import { PromptSetPicker, PromptSetOption } from '@/components/prompt-set-picker'
import { CareLevelPicker } from '@/components/care-level-picker'
import { TrendCharts, TrendPoint } from '@/components/trend-charts'
import { SentimentBreakdown } from '@/components/sentiment-breakdown'
import { PLATFORM_LABELS, PLATFORM_COLORS, formatPercent, slugify, cn } from '@/lib/utils'
import { ChevronLeft, Target, Quote, FileText, ExternalLink } from 'lucide-react'
import { CompetitorComparison } from '@/components/competitor-comparison'
import { PRESET_LABELS, type SegmentLabels } from '@/lib/segment-labels'
import type { CompetitorLeaderboardEntry, BrandComparison, BrandTrendSeries } from '@/lib/competitor-stats'

interface Citation {
  id: string
  url: string
  title: string
  domain: string
  isExplicitCitation: boolean
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

interface CommunityStat {
  communityName: string
  city: string
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
  communityStats?: CommunityStat[]
  competitorLeaderboard?: CompetitorLeaderboardEntry[] | null
  brandComparison?: BrandComparison | null
  brandTrend?: BrandTrendSeries[]
  promptTypeFilter?: PromptTypeFilter
  projectId?: string
  promptSets?: PromptSetOption[]
  careLevel?: string
  careLevels?: string[]
  careLevelBreakdown?: Array<{ levelOfCare: string; promptCount: number; mentionRate: number; citationRate: number }>
  // The dimension + value this page is itself scoped to (e.g. { key: 'market', value: 'Cincinnati' }).
  // Carried into each level-of-care breakdown card's link so drilling into a level of care
  // from within Cincinnati lands on Cincinnati + that level, not the unfiltered level-of-care view.
  segmentDrillParam?: { key: string; value: string }
  labels?: SegmentLabels  // the project's names for its dimensions
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
  communityStats,
  competitorLeaderboard,
  brandComparison,
  brandTrend,
  promptTypeFilter = 'all',
  projectId,
  promptSets,
  careLevel,
  careLevels,
  careLevelBreakdown,
  segmentDrillParam,
  labels = PRESET_LABELS['senior-living'],
}: SegmentDetailProps) {
  const platforms = platformStats.map((p) => p.platform)

  const maxDomainCount = topDomains[0]?.count ?? 1

  const drillParams = new URLSearchParams()
  if (projectId) drillParams.set('project', projectId)
  if (sessionId) drillParams.set('session', sessionId)
  if (promptTypeFilter !== 'all') drillParams.set('type', promptTypeFilter)
  if (careLevel) drillParams.set('careLevel', careLevel)
  const drillQuery = drillParams.toString() ? `?${drillParams.toString()}` : ''

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href={backHref} className="flex items-center gap-1 text-sm text-(--c-accent) hover:text-(--c-ink) font-medium transition-colors">
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <span className="text-(--c-faint)">/</span>
        <span className="text-sm text-(--c-muted)">{title}</span>
      </div>

      {/* Page title + controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-(--c-ink)" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>{title}</h1>
          {sessionId && (
            <p className="text-xs text-(--c-subtle) mt-1">
              Filtered to a single run snapshot — <Link
                href={(() => {
                  const [path, query] = backHref.split('?')
                  const params = new URLSearchParams(query)
                  params.delete('session')
                  const qs = params.toString()
                  return qs ? `${path}?${qs}` : path
                })()}
                className="underline hover:text-(--c-ink)"
              >view all runs</Link>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {promptSets && (
            <PromptSetPicker
              promptSets={promptSets}
              currentSetId={projectId}
              basePath={basePath ?? '/dashboard'}
              promptType={promptTypeFilter === 'all' ? undefined : promptTypeFilter}
            />
          )}
          <PromptTypeToggle value={promptTypeFilter} basePath={basePath ?? '/dashboard'} sessionId={sessionId} projectId={projectId} />
          {careLevels && (
            <CareLevelPicker
              label={labels.levelOfCare}
              levels={careLevels}
              currentLevel={careLevel}
              basePath={basePath ?? '/dashboard'}
              promptType={promptTypeFilter === 'all' ? undefined : promptTypeFilter}
              projectId={projectId}
              sessionId={sessionId}
            />
          )}
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
          { icon: <FileText className="h-5 w-5 text-(--c-ink)" />, bg: 'bg-(--c-tint)', label: 'Prompts', value: overview.promptCount },
          { icon: <Target className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-50', label: 'Mention Rate', value: formatPercent(overview.mentionRate) },
          { icon: <Quote className="h-5 w-5 text-(--c-accent)" />, bg: 'bg-(--c-tint)', label: 'Citation Rate', value: formatPercent(overview.citationRate) },
        ].map(({ icon, bg, label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-(--c-line) p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
              <p className="text-xs font-medium text-(--c-muted)">{label}</p>
            </div>
            <p className="text-3xl font-bold text-(--c-ink) leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Communities in this market */}
      {communityStats && communityStats.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-(--c-ink) mb-4">{labels.entity} breakdown in {title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {communityStats.map((c) => (
              <Scorecard
                key={c.communityName}
                title={c.communityName}
                subtitle={c.city}
                mentionRate={c.mentionRate}
                citationRate={c.citationRate}
                promptCount={c.promptCount}
                href={`/dashboard/community/${encodeURIComponent(slugify(c.communityName))}${drillQuery}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Competitor comparison */}
      {competitorLeaderboard && competitorLeaderboard.length > 0 && (
        <CompetitorComparison entries={competitorLeaderboard} />
      )}

      {/* Brand trend — all brands, aggregate view only */}
      {!sessionId && brandTrend && brandTrend.length > 1 && (
        <div className="bg-white rounded-xl border border-(--c-line) p-6">
          <h2 className="text-sm font-semibold text-(--c-ink) mb-1">Mention & Citation Rate Trend — All Brands</h2>
          <p className="text-xs text-(--c-subtle) mb-4">How each tracked brand&apos;s visibility has moved across run sessions</p>
          <BrandTrendChart brands={brandTrend} />
        </div>
      )}

      {/* Trend charts — aggregate view only */}
      {!sessionId && trendData && trendData.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-(--c-ink) mb-4">Performance Over Time</h2>
          <TrendCharts data={trendData} />
        </div>
      )}

      {/* Mention & Citation Rate by Brand, or Platform Chart + Sentiment Breakdown */}
      {brandComparison && brandComparison.brands.length > 1 ? (
        <>
          <div>
            <h2 className="text-sm font-semibold text-(--c-ink) mb-4">Mention & Citation Rate by Brand</h2>
            <BrandScorecards brands={brandComparison.brands} promptCount={overview.promptCount} />
          </div>
          <SentimentBreakdown results={prompts.flatMap((p) => p.results)} />
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-(--c-line) p-6">
            <h2 className="text-sm font-semibold text-(--c-ink) mb-4">Performance by Platform</h2>
            <PlatformMentionChart data={platformStats} />
          </div>
          <SentimentBreakdown results={prompts.flatMap((p) => p.results)} />
        </div>
      )}

      {/* Breakdown by Level of Care */}
      {careLevelBreakdown && careLevelBreakdown.length > 1 && (
        <div>
          <h2 className="text-sm font-semibold text-(--c-ink) mb-4">Breakdown by {labels.levelOfCare}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {careLevelBreakdown.map((c) => {
              const params = new URLSearchParams()
              if (projectId) params.set('project', projectId)
              if (sessionId) params.set('session', sessionId)
              if (promptTypeFilter !== 'all') params.set('type', promptTypeFilter)
              if (segmentDrillParam) params.set(segmentDrillParam.key, segmentDrillParam.value)
              const qs = params.toString()
              return (
                <Scorecard
                  key={c.levelOfCare}
                  title={c.levelOfCare}
                  mentionRate={c.mentionRate}
                  citationRate={c.citationRate}
                  promptCount={c.promptCount}
                  href={`/dashboard/care-level/${encodeURIComponent(c.levelOfCare)}${qs ? `?${qs}` : ''}`}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Top Citation Sources */}
      {topDomains.length > 0 && (
        <div className="bg-white rounded-xl border border-(--c-line) p-6">
          <h2 className="text-sm font-semibold text-(--c-ink) mb-5">Top Citation Sources</h2>
          <div className="space-y-3">
            {topDomains.map((d) => (
              <div key={d.domain} className="flex items-center gap-4">
                <span className="text-sm text-(--c-ink) font-medium w-48 truncate flex-shrink-0">{d.domain}</span>
                <div className="flex-1 h-2 bg-(--c-line-soft) rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(d.count / maxDomainCount) * 100}%`, background: 'var(--c-accent)' }}
                  />
                </div>
                <span className="text-xs text-(--c-muted) w-16 text-right flex-shrink-0">
                  {d.count} · {formatPercent(d.percentage)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Citation Pages */}
      {(() => {
        const allCitations = prompts.flatMap((p) => p.results.flatMap((r) => r.citations)).filter((c) => c.isExplicitCitation)
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
          <div className="bg-white rounded-xl border border-(--c-line) p-6">
            <h2 className="text-sm font-semibold text-(--c-ink) mb-5">Top Citation Pages</h2>
            <div className="space-y-2">
              {topUrls.map(({ url, title, domain, count }) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-(--c-surface) hover:bg-(--c-tint) transition-colors group"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-(--c-subtle) flex-shrink-0 group-hover:text-(--c-accent) transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-(--c-ink) truncate">{title}</p>
                    <p className="text-[10px] text-(--c-subtle)">{domain}</p>
                  </div>
                  <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-(--c-tint) text-(--c-ink)">
                    {count}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Prompts Table */}
      <div className="bg-white rounded-xl border border-(--c-line) overflow-hidden">
        <div className="px-6 py-4 border-b border-(--c-line-soft)">
          <h2 className="text-sm font-semibold text-(--c-ink)">
            {promptTypeFilter === 'all' ? 'All Prompts' : promptTypeFilter === 'brand' ? 'Brand Prompts' : 'Non-brand Prompts'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--c-line-soft) bg-(--c-surface)">
                <th className="text-left px-6 py-3 font-medium text-(--c-muted) text-xs min-w-[220px]">Prompt</th>
                <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Type</th>
                {showCommunity && (
                  <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs min-w-[160px]">{labels.entity}</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Category</th>
                <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">{labels.levelOfCare}</th>
                <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Sentiment</th>
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
            <tbody className="divide-y divide-(--c-page)">
              {prompts.map((prompt) => (
                <tr
                  key={prompt.id}
                  className="hover:bg-(--c-surface) cursor-pointer transition-colors"
                  onClick={() => { window.location.href = `/results/${prompt.id}` }}
                >
                  <td className="px-6 py-4">
                    <p className="line-clamp-2 text-(--c-text) text-xs leading-relaxed">{prompt.promptText}</p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={prompt.promptType === 'brand' ? 'default' : 'secondary'}>
                      {prompt.promptType}
                    </Badge>
                  </td>
                  {showCommunity && (
                    <td className="px-4 py-4">
                      <p className="text-(--c-ink) text-xs font-medium">{prompt.communityName || '—'}</p>
                      {prompt.city && <p className="text-(--c-subtle) text-[10px] mt-0.5">{prompt.city}</p>}
                    </td>
                  )}
                  <td className="px-4 py-4 text-(--c-muted) text-xs">{prompt.category || '—'}</td>
                  <td className="px-4 py-4 text-(--c-muted) text-xs">{prompt.levelOfCare || '—'}</td>
                  <td className="px-4 py-4">
                    {(() => {
                      // Sentiment only means something on a response that actually
                      // mentions the brand — a majority over unmentioned responses too
                      // would misrepresent prompts where the brand barely came up.
                      const mentioned = prompt.results.filter((r) => r.isMentioned)
                      if (mentioned.length === 0) return <span className="text-(--c-faint) text-xs">—</span>
                      const pos = mentioned.filter((r) => r.sentiment === 'positive').length
                      const neg = mentioned.filter((r) => r.sentiment === 'negative').length
                      const neu = mentioned.filter((r) => r.sentiment === 'neutral').length
                      const majority = pos >= neg && pos >= neu ? 'positive' : neg >= pos && neg >= neu ? 'negative' : 'neutral'
                      if (majority === 'positive') return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 w-fit">Positive</span>
                      if (majority === 'negative') return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 w-fit">Negative</span>
                      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-(--c-page) text-(--c-subtle) w-fit">Neutral</span>
                    })()}
                  </td>
                  {platforms.map((platform) => {
                    const result = prompt.results.find((r) => r.platform === platform)
                    if (!result) return <td key={platform} className="px-4 py-4 text-(--c-faint) text-xs">—</td>
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

function PlatformCell({ responseText, isMentioned, isCited }: { responseText: string; isMentioned: boolean; isCited: boolean }) {
  const isNoAIO = responseText?.startsWith('[No AI Overview]')
  const isError = responseText?.startsWith('[Error]') || responseText?.startsWith('[Timeout]')
  if (isNoAIO || isError) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-(--c-page) text-(--c-faint) w-fit italic">
        {isNoAIO ? 'No AI Overview' : 'Error'}
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <span className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold w-fit',
        isMentioned ? 'bg-emerald-50 text-emerald-700' : 'bg-(--c-page) text-(--c-subtle)'
      )}>
        {isMentioned ? 'Mentioned' : 'Not Mentioned'}
      </span>
      {isCited && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-(--c-tint) text-(--c-ink) w-fit">
          Cited
        </span>
      )}
    </div>
  )
}
