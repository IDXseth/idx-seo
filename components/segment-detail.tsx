import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PlatformMentionChart } from '@/components/platform-chart'
import { PLATFORM_LABELS, PLATFORM_COLORS, formatPercent } from '@/lib/utils'
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

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href={backHref} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-sm text-gray-600">{title}</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Prompts</p>
                <p className="text-2xl font-bold text-gray-900">{overview.promptCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Mention Rate</p>
                <p className="text-2xl font-bold text-gray-900">{formatPercent(overview.mentionRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Quote className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Citation Rate</p>
                <p className="text-2xl font-bold text-gray-900">{formatPercent(overview.citationRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Performance by Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformMentionChart data={platformStats} />
        </CardContent>
      </Card>

      {/* Top Citation Sources */}
      {topDomains.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Top Citation Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Citation Count</TableHead>
                  <TableHead>% of Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topDomains.map((d) => (
                  <TableRow key={d.domain}>
                    <TableCell className="font-medium">{d.domain}</TableCell>
                    <TableCell>{d.count}</TableCell>
                    <TableCell>{formatPercent(d.percentage)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Prompts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Prompts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-4 font-medium text-gray-500 min-w-[200px]">Prompt</th>
                  <th className="text-left p-4 font-medium text-gray-500">Type</th>
                  <th className="text-left p-4 font-medium text-gray-500">Category</th>
                  <th className="text-left p-4 font-medium text-gray-500">Level of Care</th>
                  {platforms.map((platform) => (
                    <th
                      key={platform}
                      className="text-left p-4 font-medium text-gray-500 min-w-[90px]"
                      style={{ color: PLATFORM_COLORS[platform] }}
                    >
                      {PLATFORM_LABELS[platform]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prompts.map((prompt) => (
                  <tr
                    key={prompt.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => window.location.href = `/results/${prompt.id}`}
                  >
                    <td className="p-4">
                      <p className="line-clamp-2 text-gray-900">{prompt.promptText}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant={prompt.promptType === 'brand' ? 'default' : 'secondary'}>
                        {prompt.promptType}
                      </Badge>
                    </td>
                    <td className="p-4 text-gray-600">{prompt.category}</td>
                    <td className="p-4 text-gray-600">{prompt.levelOfCare || '—'}</td>
                    {platforms.map((platform) => {
                      const result = prompt.results.find((r) => r.platform === platform)
                      if (!result) return <td key={platform} className="p-4 text-gray-400">—</td>
                      return (
                        <td key={platform} className="p-4">
                          <div className="flex flex-col gap-1">
                            {result.isMentioned ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                Mentioned
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                                Not Mentioned
                              </span>
                            )}
                            {result.isCited && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                Cited
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
