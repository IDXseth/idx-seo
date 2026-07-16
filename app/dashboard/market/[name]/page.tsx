import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PLATFORMS } from '@/lib/utils'
import { SegmentDetail } from '@/components/segment-detail'
import { SessionOption } from '@/components/run-session-picker'
import { PromptTypeFilter } from '@/components/prompt-type-toggle'
import { getSegmentTrendData } from '@/lib/segment-trend'

async function getSessionList(): Promise<SessionOption[]> {
  const sessions = await prisma.runSession.findMany({
    where: { status: 'done' },
    orderBy: { startedAt: 'asc' },
    select: { id: true, startedAt: true, triggeredBy: true, _count: { select: { results: true } } },
  })
  return sessions.map((s) => ({ id: s.id, startedAt: s.startedAt.toISOString(), triggeredBy: s.triggeredBy, resultCount: s._count.results }))
}

export const dynamic = 'force-dynamic'

async function getMarketData(name: string, sessionId?: string, promptType?: string) {
  const decodedName = decodeURIComponent(name)
  const resultsFilter = sessionId ? { where: { runSessionId: sessionId } } : {}
  const typeFilter = promptType ? { promptType } : {}

  const prompts = await prisma.prompt.findMany({
    where: { market: decodedName, ...typeFilter },
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

  const allCitations = prompts.flatMap((p) => p.results.flatMap((r) => r.citations))
  const domainCounts: Record<string, number> = {}
  for (const c of allCitations) domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([domain, count]) => ({ domain, count, percentage: totalResults > 0 ? count / totalResults : 0 }))

  const trendData = sessionId ? [] : await getSegmentTrendData({ market: decodedName, ...typeFilter })

  return {
    name: decodedName, prompts,
    overview: { promptCount: prompts.length, mentionRate: totalResults > 0 ? mentioned / totalResults : 0, citationRate: totalResults > 0 ? cited / totalResults : 0 },
    platformStats, topDomains, trendData,
  }
}

export default async function MarketDetailPage({
  params, searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ session?: string; type?: string }>
}) {
  const [{ name }, { session: sessionId, type }] = await Promise.all([params, searchParams])
  const promptTypeParam: PromptTypeFilter = type === 'brand' || type === 'nonbrand' ? type : 'all'
  const promptType = promptTypeParam === 'all' ? undefined : promptTypeParam
  let data: Awaited<ReturnType<typeof getMarketData>> = null
  let sessions: SessionOption[] = []
  try { ;[data, sessions] = await Promise.all([getMarketData(name, sessionId, promptType), getSessionList()]) } catch { /* DB not configured */ }

  if (!data) notFound()

  const dashboardQuery = new URLSearchParams()
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
      basePath={`/dashboard/market/${encodeURIComponent(name)}`}
      trendData={data.trendData}
      promptTypeFilter={promptTypeParam}
    />
  )
}
