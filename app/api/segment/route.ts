import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLATFORMS } from '@/lib/utils'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // community | category | careLevel | market
  const value = searchParams.get('value')

  if (!type || !value) {
    return NextResponse.json({ error: 'Missing type or value' }, { status: 400 })
  }

  try {
    const whereClause = {
      community: { communityName: value },
      category: { category: value },
      careLevel: { levelOfCare: value },
      market: { market: value },
    }[type]

    if (!whereClause) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const prompts = await prisma.prompt.findMany({
      where: whereClause,
      include: {
        results: {
          include: { citations: true },
        },
      },
    })

    const allResults = prompts.flatMap((p) => p.results)
    const totalResults = allResults.length
    const mentioned = allResults.filter((r) => r.isMentioned).length
    const cited = allResults.filter((r) => r.isCited).length

    // Per-platform stats
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

    // Top citation domains
    const allCitations = prompts.flatMap((p) =>
      p.results.flatMap((r) => r.citations)
    )
    const domainCounts: Record<string, number> = {}
    for (const citation of allCitations) {
      domainCounts[citation.domain] = (domainCounts[citation.domain] || 0) + 1
    }
    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({
        domain,
        count,
        percentage: totalResults > 0 ? count / totalResults : 0,
      }))

    return NextResponse.json({
      prompts,
      overview: {
        promptCount: prompts.length,
        totalResults,
        mentionRate: totalResults > 0 ? mentioned / totalResults : 0,
        citationRate: totalResults > 0 ? cited / totalResults : 0,
      },
      platformStats,
      topDomains,
    })
  } catch (error) {
    console.error('Segment error:', error)
    return NextResponse.json({ error: 'Failed to fetch segment data' }, { status: 500 })
  }
}
