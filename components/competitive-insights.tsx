import Link from 'next/link'
import { PieChart, Quote, Target } from 'lucide-react'
import { PLATFORMS, PLATFORM_LABELS, formatPercent, cn } from '@/lib/utils'
import { brandColor, OTHER_COLOR } from '@/lib/brand-palette'
import type { CompetitorLeaderboardEntry } from '@/lib/competitor-stats'
import type { CitationSources, VisibilityGap } from '@/lib/competitive'

// Server-rendered competitive views for the dashboard. Bars follow the
// dataviz marks spec: 2px surface gaps between stacked segments, rounded ends,
// a hover tooltip per segment, a legend, and a table view — the brand palette
// has low-contrast slots, so values are never conveyed by color alone.

function Card({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-(--c-line) overflow-hidden">
      <div className="px-6 py-4 border-b border-(--c-line-soft)">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-(--c-ink)">{title}</h2>
        </div>
        {subtitle && <p className="text-xs text-(--c-subtle) mt-1">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

interface Segment {
  id: string
  label: string
  color: string
  value: number   // share of the bar, 0–1
  detail: string  // tooltip text after the label
}

// One 100%-stacked horizontal bar. Segments under 1% are dropped from the bar
// (they'd render as slivers) but stay in the legend and table.
function StackedBar({ segments, ariaLabel }: { segments: Segment[]; ariaLabel: string }) {
  const visible = segments.filter((s) => s.value >= 0.01)
  if (visible.length === 0) return <div className="h-4 rounded bg-(--c-line-soft)" aria-label={`${ariaLabel}: no data`} />
  return (
    <div className="flex h-4 gap-[2px]" role="img" aria-label={`${ariaLabel}: ${segments.map((s) => `${s.label} ${formatPercent(s.value)}`).join(', ')}`}>
      {visible.map((s, i) => (
        <div
          key={s.id}
          className={cn('group relative h-full', i === 0 && 'rounded-l', i === visible.length - 1 && 'rounded-r')}
          style={{ flexGrow: s.value, flexBasis: 0, backgroundColor: s.color }}
        >
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-(--c-line) bg-white px-2.5 py-1.5 text-xs shadow-md group-hover:block">
            <span className="font-semibold text-(--c-ink)">{s.label}</span>
            <span className="text-(--c-muted)"> · {formatPercent(s.value)} · {s.detail}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Legend({ items }: { items: Array<{ id: string; label: string; color: string; value?: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-1.5 text-xs">
          <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: it.color }} />
          <span className="text-(--c-text)">{it.label}</span>
          {it.value && <span className="text-(--c-muted) font-semibold">{it.value}</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Share of voice by platform ──────────────────────────────────────────────

export function ShareOfVoiceByPlatform({ entries }: { entries: CompetitorLeaderboardEntry[] }) {
  // Legend and stacking in the fixed palette order, not leaderboard rank.
  const brands = [...entries].sort((a, b) => a.colorIndex - b.colorIndex)
  const rows = PLATFORMS.map((platform) => {
    const total = brands.reduce((sum, b) => sum + (b.platformMentions[platform] ?? 0), 0)
    return {
      platform,
      total,
      segments: brands.map((b) => {
        const mentions = b.platformMentions[platform] ?? 0
        return {
          id: b.id,
          label: b.brandName,
          color: brandColor(b.colorIndex),
          value: total > 0 ? mentions / total : 0,
          detail: `${mentions} mention${mentions === 1 ? '' : 's'}`,
        }
      }),
    }
  })

  return (
    <Card
      icon={<PieChart className="h-4 w-4 text-(--c-accent)" />}
      title="Share of Voice by Platform"
      subtitle="Of all tracked-brand mentions on each platform, the share that went to each brand."
    >
      <div className="mb-4">
        <Legend items={brands.map((b) => ({ id: b.id, label: b.brandName, color: brandColor(b.colorIndex), value: formatPercent(b.shareOfVoice) }))} />
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.platform} className="grid grid-cols-[140px_1fr_64px] items-center gap-4">
            <span className="text-xs font-medium text-(--c-text)">{PLATFORM_LABELS[r.platform]}</span>
            <StackedBar segments={r.segments} ariaLabel={`${PLATFORM_LABELS[r.platform]} share of voice`} />
            <span className="text-[10px] text-(--c-subtle) text-right">{r.total} mention{r.total === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>
      <details className="mt-5 text-xs">
        <summary className="cursor-pointer text-(--c-accent) font-medium">Show as table</summary>
        <div className="overflow-x-auto mt-3">
          <table className="w-full">
            <thead>
              <tr className="text-(--c-muted) border-b border-(--c-line-soft)">
                <th className="text-left font-medium py-2 pr-4">Platform</th>
                {brands.map((b) => <th key={b.id} className="text-right font-medium py-2 px-2">{b.brandName}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-(--c-page)">
              {rows.map((r) => (
                <tr key={r.platform}>
                  <td className="py-2 pr-4 text-(--c-text)">{PLATFORM_LABELS[r.platform]}</td>
                  {r.segments.map((s) => <td key={s.id} className="py-2 px-2 text-right text-(--c-ink)">{formatPercent(s.value)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  )
}

// ─── Citation sources ────────────────────────────────────────────────────────

export function CitationSourcesCard({ sources, entries }: { sources: CitationSources; entries: CompetitorLeaderboardEntry[] }) {
  const colorOf = new Map(entries.map((e) => [e.id, brandColor(e.colorIndex)]))
  const segments: Segment[] = sources.buckets.map((b) => ({
    id: b.id,
    label: b.label,
    color: b.id === 'other' ? OTHER_COLOR : colorOf.get(b.id) ?? OTHER_COLOR,
    value: b.share,
    detail: `${b.count} citation${b.count === 1 ? '' : 's'}`,
  }))

  return (
    <Card
      icon={<Quote className="h-4 w-4 text-(--c-accent)" />}
      title="Citation Sources"
      subtitle="Who the AI platforms explicitly cite: your sites, tracked competitors, or other sites."
    >
      {sources.total === 0 ? (
        <p className="text-sm text-(--c-subtle)">No citations recorded yet.</p>
      ) : (
        <>
          <StackedBar segments={segments} ariaLabel="Citation sources" />
          <div className="mt-3">
            <Legend items={segments.map((s) => ({ id: s.id, label: s.label, color: s.color, value: formatPercent(s.value) }))} />
          </div>
          <p className="text-[10px] text-(--c-subtle) mt-2">{sources.total.toLocaleString()} citations in total</p>

          {sources.thirdParty.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-(--c-ink) mb-2">Most-cited other sites</p>
              <p className="text-xs text-(--c-subtle) mb-3">Directories, review sites and publishers AI relies on — places to earn a listing or mention.</p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-(--c-page)">
                  {sources.thirdParty.map((d) => (
                    <tr key={d.domain}>
                      <td className="py-2 pr-4 text-(--c-text)">{d.domain}</td>
                      <td className="py-2 px-2 text-right text-(--c-muted)">{d.count}</td>
                      <td className="py-2 pl-2 text-right font-semibold text-(--c-ink) w-16">{formatPercent(d.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

// ─── Visibility gaps ─────────────────────────────────────────────────────────

export function VisibilityGapsTable({ gaps, entityLabel }: { gaps: VisibilityGap[]; entityLabel: string }) {
  return (
    <Card
      icon={<Target className="h-4 w-4 text-(--c-accent)" />}
      title="Visibility Gaps"
      subtitle="Prompts where a competitor is mentioned and you aren't, most frequent first."
    >
      {gaps.length === 0 ? (
        <p className="text-sm text-(--c-subtle)">No gaps — wherever a tracked competitor is mentioned, you are too.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-(--c-muted) border-b border-(--c-line-soft)">
                <th className="text-left font-medium py-2 pr-4">Prompt</th>
                <th className="text-left font-medium py-2 px-2">{entityLabel}</th>
                <th className="text-left font-medium py-2 px-2">Competitors mentioned instead</th>
                <th className="text-right font-medium py-2 pl-2" title="Responses where a competitor was mentioned and you weren't, of all responses to this prompt">Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--c-page)">
              {gaps.map((g) => (
                <tr key={g.promptId} className="align-top">
                  <td className="py-2.5 pr-4 max-w-md">
                    <Link href={`/results/${g.promptId}`} className="text-(--c-ink) hover:underline">{g.promptText}</Link>
                  </td>
                  <td className="py-2.5 px-2 text-(--c-muted) whitespace-nowrap">{g.entityName || '—'}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex flex-wrap gap-1">
                      {g.competitors.map((c) => (
                        <span key={c.id} className="inline-flex items-center rounded-full bg-(--c-page) px-2 py-0.5 text-[10px] text-(--c-ink)">
                          {c.brandName}{c.count > 1 ? ` ×${c.count}` : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 pl-2 text-right whitespace-nowrap font-semibold text-(--c-ink)">{g.gapResponses} of {g.totalResponses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
