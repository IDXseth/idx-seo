import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { PlatformMentionChart } from '@/components/platform-chart'
import { PLATFORM_LABELS, PLATFORM_COLORS, formatPercent, cn } from '@/lib/utils'
import { ChevronLeft, Target, Quote, FileText, ExternalLink } from 'lucide-react'

interface Citation {
  id: string
  url: string
  title: string
  domain: string
}

interface Result {
  id: string
  platform: string
  isMentioned: boolean
  isCited: boolean
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
}

export function SegmentDetail({
  title,
  backHref,
  backLabel,
  overview,
  platformStats,
  topDomains,
  prompts,
}: SegmentDetailProps) {
  const platforms = platformStats.map((p) => p.platform)
  const maxDomainCount = topDomains[0]?.count ?? 1

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href={backHref} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500">{title}</span>
      </div>

      {/* Page title */}
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <FileText className="h-5 w-5 text-indigo-600" />, bg: 'bg-indigo-50', label: 'Prompts', value: overview.promptCount },
          { icon: <Target className="h-5 w-5 text-emerald-600" />, bg: 'bg-emerald-50', label: 'Mention Rate', value: formatPercent(overview.mentionRate) },
          { icon: <Quote className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50', label: 'Citation Rate', value: formatPercent(overview.citationRate) },
        ].map(({ icon, bg, label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
              <p className="text-xs font-medium text-slate-500">{label}</p>
            </div>
            <p className="text-3xl font-bold text-slate-900 leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Platform Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Performance by Platform</h2>
        <PlatformMentionChart data={platformStats} />
      </div>

      {/* Top Citation Sources */}
      {topDomains.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-5">Top Citation Sources</h2>
          <div className="space-y-3">
            {topDomains.map((d) => (
              <div key={d.domain} className="flex items-center gap-4">
                <span className="text-sm text-slate-700 font-medium w-48 truncate flex-shrink-0">{d.domain}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${(d.count / maxDomainCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 w-16 text-right flex-shrink-0">
                  {d.count} · {formatPercent(d.percentage)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prompts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">All Prompts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 font-medium text-slate-500 text-xs min-w-[220px]">Prompt</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs">Category</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs">Level of Care</th>
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
            <tbody className="divide-y divide-slate-50">
              {prompts.map((prompt) => (
                <tr
                  key={prompt.id}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => { window.location.href = `/results/${prompt.id}` }}
                >
                  <td className="px-6 py-4">
                    <p className="line-clamp-2 text-slate-800 text-xs leading-relaxed">{prompt.promptText}</p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={prompt.promptType === 'brand' ? 'default' : 'secondary'}>
                      {prompt.promptType}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-slate-500 text-xs">{prompt.category || '—'}</td>
                  <td className="px-4 py-4 text-slate-500 text-xs">{prompt.levelOfCare || '—'}</td>
                  {platforms.map((platform) => {
                    const result = prompt.results.find((r) => r.platform === platform)
                    if (!result) return <td key={platform} className="px-4 py-4 text-slate-300 text-xs">—</td>
                    return (
                      <td key={platform} className="px-4 py-4">
                        <PlatformCell isMentioned={result.isMentioned} isCited={result.isCited} />
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

function PlatformCell({ isMentioned, isCited }: { isMentioned: boolean; isCited: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold w-fit',
        isMentioned ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
      )}>
        {isMentioned ? 'Mentioned' : 'Not Mentioned'}
      </span>
      {isCited && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 w-fit">
          Cited
        </span>
      )}
    </div>
  )
}
