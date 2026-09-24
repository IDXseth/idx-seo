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

// market/category/communityName narrow this level-of-care view to a single other
// segment too — set when arriving via a "Breakdown by Level of Care" card on that
// segment's own detail page (e.g. Cincinnati's market page), so the drill-down lands
// on Cincinnati + this level of care rather than the unfiltered level-of-care view.
async function getCareLevelData(
  name: string,
  sessionId?: string,
  promptType?: string,
  projectId?: string,
  market?: string,
  category?: string,
  communityName?: string
) {
  const decodedName = decodeURIComponent(name)
  const resultsFilter = sessionId ? { where: { runSessionId: sessionId } } : {}
  const scopeFilter = {
    ...(await promptScope()),
    ...(promptType ? { promptType } : {}),
    ...(projectId ? { batchId: projectId } : {}),
    ...(market ? { market } : {}),
    ...(category ? { category } : {}),
    ...(communityName ? { communityName } : {}),
  }

  const prompts = await prisma.prompt.findMany({
    where: { levelOfCare: decodedName, ...scopeFilter },
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

  const trendData = sessionId ? [] : await getSegmentTrendData({ levelOfCare: decodedName, ...scopeFilter })

  return {
    name: decodedName, prompts,
    overview: { promptCount: prompts.length, mentionRate: totalResults > 0 ? mentioned / totalResults : 0, citationRate: totalResults > 0 ? cited / totalResults : 0 },
    platformStats, topDomains, trendData,
  }
}

export default async function CareLevelDetailPage({
  params, searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{
    session?: string
    type?: string
    project?: string
    careLevel?: string
    market?: string
    category?: string
    communityName?: string
  }>
}) {
  const [{ name }, { session: sessionId, type, project: projectId, careLevel, market, category, communityName }] =
    await Promise.all([params, searchParams])
  const promptTypeParam: PromptTypeFilter = type === 'brand' || type === 'nonbrand' ? type : 'all'
  const promptType = promptTypeParam === 'all' ? undefined : promptTypeParam
  let data: Awaited<ReturnType<typeof getCareLevelData>> = null
  let sessions: SessionOption[] = []
  let promptSets: Awaited<ReturnType<typeof getPromptSetList>> = []
  try {
    ;[data, sessions, promptSets] = await Promise.all([
      getCareLevelData(name, sessionId, promptType, projectId, market, category, communityName),
      getSessionList(projectId),
      getPromptSetList(),
    ])
  } catch { /* DB not configured */ }

  if (!data) notFound()

  // This page is already pinned to one level of care by its route param, so
  // careLevel isn't used to scope getCareLevelData — only carried through to
  // the back-to-dashboard link so the dashboard's own filter state round-trips.
  const dashboardQuery = new URLSearchParams()
  if (projectId) dashboardQuery.set('project', projectId)
  if (sessionId) dashboardQuery.set('session', sessionId)
  if (promptType) dashboardQuery.set('type', promptType)
  if (careLevel) dashboardQuery.set('careLevel', careLevel)

  // Arriving via a "Breakdown by Level of Care" card on another segment's own page
  // (e.g. Cincinnati's market page) — send "back" there instead of the dashboard,
  // and say so in the title, so it's clear this view is market/category/community
  // scoped, not the unfiltered level-of-care view.
  let backHref = `/dashboard${dashboardQuery.toString() ? `?${dashboardQuery.toString()}` : ''}`
  let backLabel = 'Dashboard'
  let title = data.name
  const segmentQuery = new URLSearchParams()
  if (projectId) segmentQuery.set('project', projectId)
  if (sessionId) segmentQuery.set('session', sessionId)
  if (promptType) segmentQuery.set('type', promptType)
  const segmentQs = segmentQuery.toString() ? `?${segmentQuery.toString()}` : ''
  if (market) {
    backHref = `/dashboard/market/${encodeURIComponent(market)}${segmentQs}`
    backLabel = market
    title = `${data.name} — ${market}`
  } else if (category) {
    backHref = `/dashboard/category/${encodeURIComponent(category)}${segmentQs}`
    backLabel = category
    title = `${data.name} — ${category}`
  } else if (communityName) {
    backHref = `/dashboard/community/${encodeURIComponent(slugify(communityName))}${segmentQs}`
    backLabel = communityName
    title = `${data.name} — ${communityName}`
  }

  return (
    <SegmentDetail
      title={title}
      backHref={backHref}
      backLabel={backLabel}
      overview={data.overview}
      platformStats={data.platformStats}
      topDomains={data.topDomains}
      prompts={data.prompts}
      sessionId={sessionId}
      showCommunity
      sessions={sessions}
      basePath={`/dashboard/care-level/${encodeURIComponent(name)}`}
      trendData={data.trendData}
      promptTypeFilter={promptTypeParam}
      projectId={projectId}
      promptSets={promptSets}
    />
  )
}
