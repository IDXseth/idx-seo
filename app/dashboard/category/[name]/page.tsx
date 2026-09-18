import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLATFORMS } from '@/lib/utils'
import { SegmentDetail } from '@/components/segment-detail'
import { SessionOption } from '@/components/run-session-picker'
import { PromptTypeFilter } from '@/components/prompt-type-toggle'
import { getSegmentTrendData } from '@/lib/segment-trend'
import { getCompetitorLeaderboard, getBrandSeries, getBrandTrendSeries, CompetitorLeaderboardEntry, BrandComparison, BrandTrendSeries } from '@/lib/competitor-stats'
import { getSessionList } from '@/lib/run-sessions'
import { getProjectList } from '@/lib/projects'

export const dynamic = 'force-dynamic'

async function getCategoryData(name: string, sessionId?: string, promptType?: string, projectId?: string, userId?: string) {
  const decodedName = decodeURIComponent(name)
  const resultsFilter = sessionId ? { where: { runSessionId: sessionId } } : {}
  const scopeFilter = { ...(promptType ? { promptType } : {}), ...(projectId ? { batchId: projectId } : {}) }

  const prompts = await prisma.prompt.findMany({
    where: { category: decodedName, ...scopeFilter },
    include: { results: { ...resultsFilter, include: { citations: true } } },
  })

  if (prompts.length === 0) return null

  const allResults = prompts.flatMap((p) => p.results)
  const totalResults = allResults.length
  const mentioned = allResults.filter((r) => r.isMentioned).length
  const cited = allResults.filter((r) => r.isCited).length

  const platformStats = PLATFORMS.map((platform) => {
    const platformResults = allResults.filter((r) => r.platform === platform)
    const total = platformResults.length
    const pMentioned = platformResults.filter((r) => r.isMentioned).length
    const pCited = platformResults.filter((r) => r.isCited).length
    return {
      platform, total,
      mentioned: pMentioned, cited: pCited,
      mentionRate: total > 0 ? pMentioned / total : 0,
      citationRate: total > 0 ? pCited / total : 0,
    }
  })

  const allCitations = prompts.flatMap((p) => p.results.flatMap((r) => r.citations)).filter((c) => c.isExplicitCitation)
  const domainCounts: Record<string, number> = {}
  for (const c of allCitations) domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([domain, count]) => ({ domain, count, percentage: totalResults > 0 ? count / totalResults : 0 }))

  const trendData = sessionId ? [] : await getSegmentTrendData({ category: decodedName, ...scopeFilter })
  const promptIds = prompts.map((p) => p.id)
  const competitorLeaderboard = userId
    ? await getCompetitorLeaderboard(promptIds, userId, sessionId)
    : null
  const brandComparison = await getBrandSeries({
    promptId: { in: promptIds },
    ...(sessionId ? { runSessionId: sessionId } : {}),
  }).catch(() => null)
  const brandTrend = sessionId
    ? []
    : await getBrandTrendSeries({ category: decodedName, ...scopeFilter }).catch(() => [])

  return {
    name: decodedName, prompts,
    overview: { promptCount: prompts.length, mentionRate: totalResults > 0 ? mentioned / totalResults : 0, citationRate: totalResults > 0 ? cited / totalResults : 0 },
    platformStats, topDomains, trendData, competitorLeaderboard, brandComparison, brandTrend,
  }
}

export default async function CategoryDetailPage({
  params, searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ session?: string; type?: string; project?: string }>
}) {
  const [{ name }, { session: sessionId, type, project: projectId }] = await Promise.all([params, searchParams])
  const promptTypeParam: PromptTypeFilter = type === 'brand' || type === 'nonbrand' ? type : 'all'
  const promptType = promptTypeParam === 'all' ? undefined : promptTypeParam
  const session = await auth().catch(() => null)
  const userId = session?.user?.id

  let data: Awaited<ReturnType<typeof getCategoryData>> = null
  let sessions: SessionOption[] = []
  let projects: Awaited<ReturnType<typeof getProjectList>> = []
  try {
    ;[data, sessions, projects] = await Promise.all([
      getCategoryData(name, sessionId, promptType, projectId, userId),
      getSessionList(projectId),
      getProjectList(),
    ])
  } catch { /* DB not configured */ }

  if (!data) notFound()

  const dashboardQuery = new URLSearchParams()
  if (projectId) dashboardQuery.set('project', projectId)
  if (sessionId) dashboardQuery.set('session', sessionId)
  if (promptType) dashboardQuery.set('type', promptType)

  return (
    <SegmentDetail
      title={data.name}
      backHref={`/dashboard${dashboardQuery.toString() ? `?${dashboardQuery.toString()}` : ''}`}
      backLabel="Dashboard"
      overview={data.overview}
      platformStats={data.platformStats}
      topDomains={data.topDomains}
      prompts={data.prompts}
      sessionId={sessionId}
      showCommunity
      sessions={sessions}
      basePath={`/dashboard/category/${encodeURIComponent(name)}`}
      trendData={data.trendData}
      competitorLeaderboard={data.competitorLeaderboard as CompetitorLeaderboardEntry[] | null}
      brandComparison={data.brandComparison as BrandComparison | null}
      brandTrend={data.brandTrend as BrandTrendSeries[]}
      promptTypeFilter={promptTypeParam}
      projectId={projectId}
      projects={projects}
    />
  )
}
