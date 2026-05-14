import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PLATFORMS } from '@/lib/utils'
import { SegmentDetail } from '@/components/segment-detail'

export const dynamic = 'force-dynamic'

async function getCategoryData(name: string) {
  const decodedName = decodeURIComponent(name)

  const prompts = await prisma.prompt.findMany({
    where: { category: decodedName },
    include: { results: { include: { citations: true } } },
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
      platform,
      total,
      mentioned: pMentioned,
      cited: pCited,
      mentionRate: total > 0 ? pMentioned / total : 0,
      citationRate: total > 0 ? pCited / total : 0,
    }
  })

  const allCitations = prompts.flatMap((p) => p.results.flatMap((r) => r.citations))
  const domainCounts: Record<string, number> = {}
  for (const c of allCitations) {
    domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1
  }
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count, percentage: totalResults > 0 ? count / totalResults : 0 }))

  return {
    name: decodedName,
    prompts,
    overview: {
      promptCount: prompts.length,
      mentionRate: totalResults > 0 ? mentioned / totalResults : 0,
      citationRate: totalResults > 0 ? cited / totalResults : 0,
    },
    platformStats,
    topDomains,
  }
}

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  let data: Awaited<ReturnType<typeof getCategoryData>> = null
  try { data = await getCategoryData(name) } catch { /* DB not configured */ }

  if (!data) notFound()

  return (
    <SegmentDetail
      title={data.name}
      backHref="/dashboard"
      backLabel="Dashboard"
      segmentType="category"
      overview={data.overview}
      platformStats={data.platformStats}
      topDomains={data.topDomains}
      prompts={data.prompts}
    />
  )
}
