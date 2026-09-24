import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PLATFORMS, slugify } from '@/lib/utils'
import { SegmentDetail } from '@/components/segment-detail'
import { SessionOption } from '@/components/run-session-picker'
import { PromptTypeFilter } from '@/components/prompt-type-toggle'
import { getSegmentTrendData } from '@/lib/segment-trend'
import { getSessionList } from '@/lib/run-sessions'
import { getPromptSetList } from '@/lib/prompt-sets'
import { promptScope } from '@/lib/projects'

export const dynamic = 'force-dynamic'

async function getCommunityData(id: string, sessionId?: string, promptType?: string, projectId?: string, careLevel?: string) {
  const decodedId = decodeURIComponent(id)
  const resultsFilter = sessionId ? { where: { runSessionId: sessionId } } : {}
  const scopeFilter = {
    ...(await promptScope()),
    ...(promptType ? { promptType } : {}),
    ...(projectId ? { batchId: projectId } : {}),
    ...(careLevel ? { levelOfCare: careLevel } : {}),
  }

  // Communities have no dedicated table — they're identified purely by the free-text
  // Prompt.communityName, slugified for the URL. Match by exact slug only: a substring
  // `contains` match (the prior approach) would pull prompts from a differently-named
  // community into this one whenever one name is a substring of another (e.g. visiting
  // "grand-living" would also match prompts for "Grand Living East"), silently mixing
  // in that other community's mentions/citations.
  const allCommunities = await prisma.prompt.groupBy({
    by: ['communityName'],
    where: { communityName: { not: '' }, ...(await promptScope()) },
  })
  const matched = allCommunities.find((c) => slugify(c.communityName) === decodedId)
  if (!matched) return null

  const finalPrompts = await prisma.prompt.findMany({
    where: { communityName: matched.communityName, ...scopeFilter },
    include: { results: { ...resultsFilter, include: { citations: true } } },
  })

  if (finalPrompts.length === 0) return null

  const communityName = finalPrompts[0].communityName
  const allResults = finalPrompts.flatMap((p) => p.results)
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

  const allCitations = finalPrompts.flatMap((p) => p.results.flatMap((r) => r.citations)).filter((c) => c.isExplicitCitation)
  const domainCounts: Record<string, number> = {}
  for (const c of allCitations) domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([domain, count]) => ({ domain, count, percentage: totalResults > 0 ? count / totalResults : 0 }))

  const trendData = sessionId ? [] : await getSegmentTrendData({ communityName, ...scopeFilter })

  return {
    communityName, prompts: finalPrompts,
    overview: { promptCount: finalPrompts.length, mentionRate: totalResults > 0 ? mentioned / totalResults : 0, citationRate: totalResults > 0 ? cited / totalResults : 0 },
    platformStats, topDomains, trendData,
  }
}

// Every level of care present in this community — regardless of which one (if any) is
// currently selected — so the picker always offers the full set and the breakdown
// grid below always shows every level side by side. Takes the already-resolved exact
// communityName (see getCommunityData's slug matching) rather than re-resolving it.
async function getCommunityCareLevelBreakdown(communityName: string, sessionId?: string, promptType?: string, projectId?: string) {
  const scopeFilter = { ...(await promptScope()), ...(promptType ? { promptType } : {}), ...(projectId ? { batchId: projectId } : {}) }
  const where = { communityName, ...scopeFilter }

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

export default async function CommunityDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ session?: string; type?: string; project?: string; careLevel?: string }>
}) {
  const [{ id }, { session: sessionId, type, project: projectId, careLevel }] = await Promise.all([params, searchParams])
  const promptTypeParam: PromptTypeFilter = type === 'brand' || type === 'nonbrand' ? type : 'all'
  const promptType = promptTypeParam === 'all' ? undefined : promptTypeParam
  let data: Awaited<ReturnType<typeof getCommunityData>> = null
  let sessions: SessionOption[] = []
  let promptSets: Awaited<ReturnType<typeof getPromptSetList>> = []
  let careLevelBreakdown: Awaited<ReturnType<typeof getCommunityCareLevelBreakdown>> = []
  try {
    ;[data, sessions, promptSets] = await Promise.all([
      getCommunityData(id, sessionId, promptType, projectId, careLevel),
      getSessionList(projectId),
      getPromptSetList(),
    ])
    if (data) careLevelBreakdown = await getCommunityCareLevelBreakdown(data.communityName, sessionId, promptType, projectId)
  } catch { /* DB not configured */ }

  if (!data) notFound()

  const dashboardQuery = new URLSearchParams()
  if (projectId) dashboardQuery.set('project', projectId)
  if (sessionId) dashboardQuery.set('session', sessionId)
  if (promptType) dashboardQuery.set('type', promptType)
  if (careLevel) dashboardQuery.set('careLevel', careLevel)

  return (
    <SegmentDetail
      title={data.communityName}
      backHref={`/dashboard${dashboardQuery.toString() ? `?${dashboardQuery.toString()}` : ''}`}
      backLabel="Dashboard"
      overview={data.overview}
      platformStats={data.platformStats}
      topDomains={data.topDomains}
      prompts={data.prompts}
      sessionId={sessionId}
      sessions={sessions}
      basePath={`/dashboard/community/${id}`}
      trendData={data.trendData}
      promptTypeFilter={promptTypeParam}
      projectId={projectId}
      promptSets={promptSets}
      careLevel={careLevel}
      careLevels={careLevelBreakdown.map((c) => c.levelOfCare)}
      careLevelBreakdown={careLevelBreakdown}
      segmentDrillParam={{ key: 'communityName', value: data.communityName }}
    />
  )
}
