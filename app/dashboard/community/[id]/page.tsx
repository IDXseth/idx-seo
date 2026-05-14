import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PLATFORMS } from '@/lib/utils'
import { SegmentDetail } from '@/components/segment-detail'

export const dynamic = 'force-dynamic'

async function getCommunityData(id: string) {
  // Decode the slug and find matching community
  const decodedId = decodeURIComponent(id)

  const prompts = await prisma.prompt.findMany({
    where: {
      communityName: {
        contains: decodedId.replace(/-/g, ' '),
      },
    },
    include: {
      results: {
        include: { citations: true },
      },
    },
  })

  // Try exact slug match if no results
  let finalPrompts = prompts
  if (prompts.length === 0) {
    // Try finding by looking at all communities and matching slug
    const allCommunities = await prisma.prompt.groupBy({ by: ['communityName'] })
    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const matched = allCommunities.find((c) => slugify(c.communityName) === decodedId)
    if (!matched) return null

    finalPrompts = await prisma.prompt.findMany({
      where: { communityName: matched.communityName },
      include: { results: { include: { citations: true } } },
    })
  }

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
      platform,
      total,
      mentioned: pMentioned,
      cited: pCited,
      mentionRate: total > 0 ? pMentioned / total : 0,
      citationRate: total > 0 ? pCited / total : 0,
    }
  })

  const allCitations = finalPrompts.flatMap((p) => p.results.flatMap((r) => r.citations))
  const domainCounts: Record<string, number> = {}
  for (const c of allCitations) {
    domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1
  }
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({
      domain,
      count,
      percentage: totalResults > 0 ? count / totalResults : 0,
    }))

  return {
    communityName,
    prompts: finalPrompts,
    overview: {
      promptCount: finalPrompts.length,
      mentionRate: totalResults > 0 ? mentioned / totalResults : 0,
      citationRate: totalResults > 0 ? cited / totalResults : 0,
    },
    platformStats,
    topDomains,
  }
}

export default async function CommunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let data: Awaited<ReturnType<typeof getCommunityData>> = null
  try { data = await getCommunityData(id) } catch { /* DB not configured */ }

  if (!data) notFound()

  return (
    <SegmentDetail
      title={data.communityName}
      backHref="/dashboard"
      backLabel="Dashboard"
      segmentType="community"
      overview={data.overview}
      platformStats={data.platformStats}
      topDomains={data.topDomains}
      prompts={data.prompts}
    />
  )
}
