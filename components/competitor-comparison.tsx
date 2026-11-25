'use client'

import { Trophy } from 'lucide-react'
import { PLATFORM_LABELS, PLATFORM_COLORS, formatPercent, cn } from '@/lib/utils'
import { brandColor } from '@/lib/brand-palette'
import type { CompetitorLeaderboardEntry } from '@/lib/competitor-stats'

function rateColor(rate: number) {
  if (rate >= 0.6) return { text: 'text-emerald-600', bar: 'bg-emerald-500' }
  if (rate >= 0.3) return { text: 'text-amber-600', bar: 'bg-amber-400' }
  return { text: 'text-rose-600', bar: 'bg-rose-400' }
}

// Head-to-head leaderboard: your brand vs tracked competitors, plus each
// brand's mention rate per AI platform. Colors come from each entry's fixed
// colorIndex, so a brand matches its color in every other brand chart.
export function CompetitorComparison({ entries }: { entries: CompetitorLeaderboardEntry[] }) {
  const platforms = Object.keys(entries[0]?.platformMentionRates ?? {})
  const brandColors: Record<string, string> = Object.fromEntries(entries.map((e) => [e.id, brandColor(e.colorIndex)]))

  return (
    <div className="bg-white rounded-xl border border-(--c-line) overflow-hidden">
      <div className="px-6 py-4 border-b border-(--c-line-soft) flex items-center gap-2">
        <Trophy className="h-4 w-4 text-(--c-accent)" />
        <h2 className="text-sm font-semibold text-(--c-ink)">Competitor Comparison</h2>
      </div>

      {/* Leaderboard */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-(--c-line-soft) bg-(--c-surface)">
              <th className="text-left px-6 py-3 font-medium text-(--c-muted) text-xs">Brand</th>
              <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Mention Rate</th>
              <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Citation Rate</th>
              <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Sentiment</th>
              <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs">Share of Voice</th>
              <th className="text-left px-4 py-3 font-medium text-(--c-muted) text-xs" title="Average order in which the brand is named among tracked brands, when it's mentioned (1 = named first)">Avg. Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--c-page)">
            {entries.map((e) => {
              const mc = rateColor(e.mentionRate)
              const cc = rateColor(e.citationRate)
              return (
                <tr key={e.id} className={cn(e.isYou && 'bg-(--c-tint)')}>
                  <td className={cn('px-6 py-3.5', e.isYou && 'border-l-2 border-(--c-accent)')}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: brandColors[e.id] }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={cn('text-xs font-semibold truncate', e.isYou ? 'text-(--c-ink)' : 'text-(--c-text)')}>{e.brandName}</p>
                          {e.isYou && (
                            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-(--c-ink) text-white">You</span>
                          )}
                        </div>
                        <p className="text-[10px] text-(--c-faint)">{e.domain}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 w-32">
                    <p className={cn('text-xs font-bold mb-1', mc.text)}>{formatPercent(e.mentionRate)}</p>
                    <div className="h-1.5 bg-(--c-line-soft) rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', mc.bar)} style={{ width: `${Math.round(e.mentionRate * 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 w-32">
                    <p className={cn('text-xs font-bold mb-1', cc.text)}>{formatPercent(e.citationRate)}</p>
                    <div className="h-1.5 bg-(--c-line-soft) rounded-full overflow-hidden">
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
                        <span className="text-[10px] text-(--c-subtle) whitespace-nowrap">{formatPercent(e.sentiment.positive)} pos</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-(--c-faint)">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-extrabold text-(--c-ink)">{formatPercent(e.shareOfVoice)}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs font-semibold text-(--c-ink)">{e.avgPosition !== null ? `#${e.avgPosition.toFixed(1)}` : '—'}</p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Platform breakdown */}
      {platforms.length > 0 && (
        <div className="px-6 py-5 border-t border-(--c-line-soft)">
          <p className="text-xs font-semibold text-(--c-ink) mb-1">Mention Rate by AI Platform</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: brandColors[e.id] }} />
                <span className={cn('text-[11px]', e.isYou ? 'text-(--c-ink) font-semibold' : 'text-(--c-muted)')}>{e.brandName}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {platforms.map((platform) => (
              <div key={platform} className="grid grid-cols-[130px_1fr] gap-4 items-center">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[platform] }} />
                  <span className="text-xs font-medium text-(--c-text)">{PLATFORM_LABELS[platform]}</span>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${entries.length}, 1fr)` }}>
                  {entries.map((e) => (
                    <div key={e.id}>
                      <div className="h-1 bg-(--c-line-soft) rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.round(e.platformMentionRates[platform] * 100)}%`, backgroundColor: brandColors[e.id] }}
                        />
                      </div>
                      <p className="text-[10px] text-(--c-subtle) mt-0.5">{formatPercent(e.platformMentionRates[platform])}</p>
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
