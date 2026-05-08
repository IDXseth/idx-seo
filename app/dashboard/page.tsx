import { prisma } from '@/lib/prisma'
import { PLATFORMS, PLATFORM_LABELS, formatPercent } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Scorecard } from '@/components/scorecard'
import { PlatformMentionChart } from '@/components/platform-chart'
import { BarChart3, Target, Quote, Layers } from 'lucide-react'
import { slugify } from '@/lib/utils'

async function getDashboardData() {
  const [totalPrompts, totalResults, mentionedResults, citedResults] = await Promise.all([
    prisma.prompt.count(),
    prisma.result.count(),
    prisma.result.count({ where: { isMentioned: true } }),
    prisma.result.count({ where: { isCited: true } }),
  ])

  const platformStats = await Promise.all(
    PLATFORMS.map(async (platform) => {
      const [total, mentioned, cited] = await Promise.all([
        prisma.result.count({ where: { platform } }),
        prisma.result.count({ where: { platform, isMentioned: true } }),
        prisma.result.count({ where: { platform, isCited: true } }),
      ])
      return {
        platform,
        total,
        mentioned,
        cited,
        mentionRate: total > 0 ? mentioned / total : 0,
        citationRate: total > 0 ? cited / total : 0,
      }
    })
  )

  const communityGroups = await prisma.prompt.groupBy({
    by: ['communityName', 'city'],
    _count: { id: true },
  })

  const communityStats = await Promise.all(
    communityGroups.map(async (c) => {
      const results = await prisma.result.findMany({
        where: { prompt: { communityName: c.communityName } },
        select: { isMentioned: true, isCited: true },
      })
      const total = results.length
      const mentioned = results.filter((r) => r.isMentioned).length
      const cited = results.filter((r) => r.isCited).length
      // Get an ID to use for the community link
      const prompt = await prisma.prompt.findFirst({ where: { communityName: c.communityName } })
      return {
        id: slugify(c.communityName),
        communityName: c.communityName,
        city: c.city,
        promptCount: c._count.id,
        mentionRate: total > 0 ? mentioned / total : 0,
        citationRate: total > 0 ? cited / total : 0,
      }
    })
  )

  const categoryGroups = await prisma.prompt.groupBy({
    by: ['category'],
    _count: { id: true },
  })

  const categoryStats = await Promise.all(
    categoryGroups.filter(c => c.category).map(async (c) => {
      const results = await prisma.result.findMany({
        where: { prompt: { category: c.category } },
        select: { isMentioned: true, isCited: true },
      })
      const total = results.length
      const mentioned = results.filter((r) => r.isMentioned).length
      const cited = results.filter((r) => r.isCited).length
      return {
        category: c.category,
        promptCount: c._count.id,
        mentionRate: total > 0 ? mentioned / total : 0,
        citationRate: total > 0 ? cited / total : 0,
      }
    })
  )

  const careLevelGroups = await prisma.prompt.groupBy({
    by: ['levelOfCare'],
    _count: { id: true },
  })

  const careLevelStats = await Promise.all(
    careLevelGroups.filter(c => c.levelOfCare).map(async (c) => {
      const results = await prisma.result.findMany({
        where: { prompt: { levelOfCare: c.levelOfCare } },
        select: { isMentioned: true, isCited: true },
      })
      const total = results.length
      const mentioned = results.filter((r) => r.isMentioned).length
      const cited = results.filter((r) => r.isCited).length
      return {
        levelOfCare: c.levelOfCare,
        promptCount: c._count.id,
        mentionRate: total > 0 ? mentioned / total : 0,
        citationRate: total > 0 ? cited / total : 0,
      }
    })
  )

  const marketGroups = await prisma.prompt.groupBy({
    by: ['market'],
    _count: { id: true },
  })

  const marketStats = await Promise.all(
    marketGroups.filter(m => m.market).map(async (m) => {
      const results = await prisma.result.findMany({
        where: { prompt: { market: m.market } },
        select: { isMentioned: true, isCited: true },
      })
      const total = results.length
      const mentioned = results.filter((r) => r.isMentioned).length
      const cited = results.filter((r) => r.isCited).length
      return {
        market: m.market,
        promptCount: m._count.id,
        mentionRate: total > 0 ? mentioned / total : 0,
        citationRate: total > 0 ? cited / total : 0,
      }
    })
  )

  return {
    overview: {
      totalPrompts,
      totalResults,
      overallMentionRate: totalResults > 0 ? mentionedResults / totalResults : 0,
      overallCitationRate: totalResults > 0 ? citedResults / totalResults : 0,
    },
    platformStats,
    communityStats,
    categoryStats,
    careLevelStats,
    marketStats,
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  const isEmpty = data.overview.totalPrompts === 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">AI mention and citation monitoring for your communities</p>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No data yet</h3>
            <p className="text-gray-500 mb-4">Upload a spreadsheet and run prompts to see your dashboard.</p>
            <div className="flex gap-3 justify-center">
              <a href="/upload" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700">
                Upload Data
              </a>
              <a href="/run" className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50">
                Run Prompts
              </a>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="community">By Community</TabsTrigger>
            <TabsTrigger value="category">By Category</TabsTrigger>
            <TabsTrigger value="careLevel">By Level of Care</TabsTrigger>
            <TabsTrigger value="market">By Market</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Prompts Run</p>
                      <p className="text-2xl font-bold text-gray-900">{data.overview.totalPrompts}</p>
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
                      <p className="text-2xl font-bold text-gray-900">
                        {formatPercent(data.overview.overallMentionRate)}
                      </p>
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
                      <p className="text-2xl font-bold text-gray-900">
                        {formatPercent(data.overview.overallCitationRate)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Layers className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Platforms</p>
                      <p className="text-2xl font-bold text-gray-900">{PLATFORMS.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Performance by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                <PlatformMentionChart data={data.platformStats} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="community">
            {data.communityStats.length === 0 ? (
              <EmptyState message="No community data available" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.communityStats.map((c) => (
                  <Scorecard
                    key={c.communityName}
                    title={c.communityName}
                    subtitle={c.city}
                    mentionRate={c.mentionRate}
                    citationRate={c.citationRate}
                    promptCount={c.promptCount}
                    href={`/dashboard/community/${encodeURIComponent(slugify(c.communityName))}`}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="category">
            {data.categoryStats.length === 0 ? (
              <EmptyState message="No category data available" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.categoryStats.map((c) => (
                  <Scorecard
                    key={c.category}
                    title={c.category}
                    mentionRate={c.mentionRate}
                    citationRate={c.citationRate}
                    promptCount={c.promptCount}
                    href={`/dashboard/category/${encodeURIComponent(c.category)}`}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="careLevel">
            {data.careLevelStats.length === 0 ? (
              <EmptyState message="No care level data available" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.careLevelStats.map((c) => (
                  <Scorecard
                    key={c.levelOfCare}
                    title={c.levelOfCare}
                    mentionRate={c.mentionRate}
                    citationRate={c.citationRate}
                    promptCount={c.promptCount}
                    href={`/dashboard/care-level/${encodeURIComponent(c.levelOfCare)}`}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="market">
            {data.marketStats.length === 0 ? (
              <EmptyState message="No market data available" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.marketStats.map((m) => (
                  <Scorecard
                    key={m.market}
                    title={m.market}
                    mentionRate={m.mentionRate}
                    citationRate={m.citationRate}
                    promptCount={m.promptCount}
                    href={`/dashboard/market/${encodeURIComponent(m.market)}`}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-gray-500">{message}</p>
      </CardContent>
    </Card>
  )
}
