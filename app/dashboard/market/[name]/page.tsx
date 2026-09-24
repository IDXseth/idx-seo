import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PLATFORMS } from '@/lib/utils'
import { SegmentDetail } from '@/components/segment-detail'
import { SessionOption } from '@/components/run-session-picker'
import { PromptTypeFilter } from '@/components/prompt-type-toggle'
import { getSegmentTrendData } from '@/lib/segment-trend'
import { getSessionList } from '@/lib/run-sessions'
import { getPromptSetList } from '@/lib/prompt-sets'
import { promptScope } from '@/lib/projects'

export const dynamic = 'force-dynamic'

async function getMarketData(name: string, sessionId?: string, promptType?: string, projectId?: string, careLevel?: string) {
  const decodedName = decodeURIComponent(name)
  const resultsFilter = sessionId ? { where: { runSessionId: sessionId } } : {}
  const scopeFilter = {
    ...(await promptScope()),
    ...(promptType ? { promptType } : {}),
    ...(projectId ? { batchId: projectId } : {}),
    ...(careLevel ? { levelOfCare: careLevel } : {}),
  }

  const prompts = await prisma.prompt.findMany({
    where: { market: decodedName, ...scopeFilter },
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

  const trendData = sessionId ? [] : await getSegmentTrendData({ market: decodedName, ...scopeFilter })

  const communityGroups = new Map<string, { city: string; promptCount: number; mentioned: number; cited: number; total: number }>()
  for (const p of prompts) {
    if (!p.communityName) continue
    const g = communityGroups.get(p.communityName) ?? { city: p.city, promptCount: 0, mentioned: 0, cited: 0, total: 0 }
    g.promptCount++
    g.total += p.results.length
    g.mentioned += p.results.filter((r) => r.isMentioned).length
    g.cited += p.results.filter((r) => r.isCited).length
    communityGroups.set(p.communityName, g)
  }
  const communityStats = [...communityGroups.entries()].map(([communityName, g]) => ({
    communityName, city: g.city, promptCount: g.promptCount,
    mentionRate: g.total > 0 ? g.mentioned / g.total : 0,
    citationRate: g.total > 0 ? g.cited / g.total : 0,
  }))

  return {
    name: decodedName, prompts,
    overview: { promptCount: prompts.length, mentionRate: totalResults > 0 ? mentioned / totalResults : 0, citationRate: totalResults > 0 ? cited / totalResults : 0 },
    platformStats, topDomains, trendData, communityStats,
  }
}

// Every level of care present in this market — regardless of which one (if any) is
// currently selected — so the picker always offers the full set and the breakdown
// grid below always shows every level side by side.
async function getMarketCareLevelBreakdown(name: string, sessionId?: string, promptType?: string, projectId?: string) {
  const decodedName = decodeURIComponent(name)
  const scopeFilter = { ...(await promptScope()), ...(promptType ? { promptType } : {}), ...(projectId ? { batchId: projectId } : {}) }
  const where = { market: decodedName, ...scopeFilter }

  const groups = await prisma.prompt.groupBy({ by: ['levelOfCare'], where, _count: { id: true } })
  const resultsFilter = sessionId ? { runSessionId: sessionId } : {}

  const stats = (await Promise.all(
    groups.filter((g) => g.levelOfCare).map(async (g) => {
      const results = await prisma.result.findMany({
        where: { ...resultsFilter, prompt: { ...where, levelOfCare: g.levelOfCare } },
        select: { isMentioned: true, isCited: true },
      })
      const total = results.length
      if (sessionId && total === 0) return null
      return {
        levelOfCare: g.levelOfCare,
        promptCount: g._count.id,
        mentionRate: total > 0 ? results.filter((r) => r.isMentioned).length / total : 0,
        citationRate: total > 0 ? results.filter((r) => r.isCited).length / total : 0,
      }
    })
  )).filter(Boolean) as Array<{ levelOfCare: string; promptCount: number; mentionRate: number; citationRate: number }>

  return stats
}

export default async function MarketDetailPage({
  params, searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ session?: string; type?: string; project?: string; careLevel?: string }>
}) {
  const [{ name }, { session: sessionId, type, project: projectId, careLevel }] = await Promise.all([params, searchParams])
  const promptTypeParam: PromptTypeFilter = type === 'brand' || type === 'nonbrand' ? type : 'all'
  const promptType = promptTypeParam === 'all' ? undefined : promptTypeParam
  let data: Awaited<ReturnType<typeof getMarketData>> = null
  let sessions: SessionOption[] = []
  let promptSets: Awaited<ReturnType<typeof getPromptSetList>> = []
  let careLevelBreakdown: Awaited<ReturnType<typeof getMarketCareLevelBreakdown>> = []
  try {
    ;[data, sessions, promptSets, careLevelBreakdown] = await Promise.all([
      getMarketData(name, sessionId, promptType, projectId, careLevel),
      getSessionList(projectId),
      getPromptSetList(),
      getMarketCareLevelBreakdown(name, sessionId, promptType, projectId),
    ])
  } catch { /* DB not configured */ }

  if (!data) notFound()

  const dashboardQuery = new URLSearchParams()
  if (projectId) dashboardQuery.set('project', projectId)
  if (sessionId) dashboardQuery.set('session', sessionId)
  if (promptType) dashboardQuery.set('type', promptType)
  if (careLevel) dashboardQuery.set('careLevel', careLevel)

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
      communityStats={data.communityStats}
      promptTypeFilter={promptTypeParam}
      projectId={projectId}
      promptSets={promptSets}
      careLevel={careLevel}
      careLevels={careLevelBreakdown.map((c) => c.levelOfCare)}
      careLevelBreakdown={careLevelBreakdown}
      segmentDrillParam={{ key: 'market', value: data.name }}
    />
  )
}
