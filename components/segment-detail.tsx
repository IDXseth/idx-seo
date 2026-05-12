import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { PlatformMentionChart } from '@/components/platform-chart'
import { PLATFORM_LABELS, PLATFORM_COLORS, formatPercent, cn } from '@/lib/utils'
import { ChevronLeft, Target, Quote, FileText } from 'lucide-react'

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
        <Link href={backHref} className="flex items-center gap-1 text-sm text-[#177e89] hover:text-[#084c61] font-medium transition-colors">
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <span className="text-[#b8cdd3]">/</span>
        <span className="text-sm text-[#5a7a85]">{title}</span>
      </div>

      {/* Page title */}
      <h1 className="text-2xl font-bold text-[#084c61]" style={{ fontFamily: 'var(--font-noto-serif), serif' }}>{title}</h1>

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

      {/* Platform Chart */}
      <div className="bg-white rounded-xl border border-[#dde6ea] p-6">
        <h2 className="text-sm font-semibold text-[#084c61] mb-4">Performance by Platform</h2>
        <PlatformMentionChart data={platformStats} />
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

      {/* Prompts Table */}
      <div className="bg-white rounded-xl border border-[#dde6ea] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#eef3f5]">
          <h2 className="text-sm font-semibold text-[#084c61]">All Prompts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eef3f5] bg-[#f5f8fa]">
                <th className="text-left px-6 py-3 font-medium text-[#5a7a85] text-xs min-w-[220px]">Prompt</th>
                <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Type</th>
                <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Category</th>
                <th className="text-left px-4 py-3 font-medium text-[#5a7a85] text-xs">Level of Care</th>
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
                  <td className="px-4 py-4 text-[#5a7a85] text-xs">{prompt.category || '—'}</td>
                  <td className="px-4 py-4 text-[#5a7a85] text-xs">{prompt.levelOfCare || '—'}</td>
                  {platforms.map((platform) => {
                    const result = prompt.results.find((r) => r.platform === platform)
                    if (!result) return <td key={platform} className="px-4 py-4 text-[#b8cdd3] text-xs">—</td>
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
