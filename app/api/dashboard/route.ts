import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLATFORMS } from '@/lib/utils'

export async function GET() {
  try {
    const [totalPrompts, totalResults, mentionedResults, citedResults] = await Promise.all([
      prisma.prompt.count(),
      prisma.result.count(),
      prisma.result.count({ where: { isMentioned: true } }),
      prisma.result.count({ where: { isCited: true } }),
    ])

    // Per-platform stats
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

    // Per-community stats
    const communities = await prisma.prompt.groupBy({
      by: ['communityName', 'city'],
      _count: { id: true },
    })

    const communityStats = await Promise.all(
      communities.map(async (c) => {
        const results = await prisma.result.findMany({
          where: { prompt: { communityName: c.communityName } },
          select: { isMentioned: true, isCited: true },
        })
        const total = results.length
        const mentioned = results.filter((r) => r.isMentioned).length
        const cited = results.filter((r) => r.isCited).length
        return {
          communityName: c.communityName,
          city: c.city,
          promptCount: c._count.id,
          mentionRate: total > 0 ? mentioned / total : 0,
          citationRate: total > 0 ? cited / total : 0,
        }
      })
    )

    // Per-category stats
    const categories = await prisma.prompt.groupBy({
      by: ['category'],
      _count: { id: true },
    })

    const categoryStats = await Promise.all(
      categories.map(async (c) => {
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

    // Per-levelOfCare stats
    const careLevels = await prisma.prompt.groupBy({
      by: ['levelOfCare'],
      _count: { id: true },
    })

    const careLevelStats = await Promise.all(
      careLevels.map(async (c) => {
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

    // Per-market stats
    const markets = await prisma.prompt.groupBy({
      by: ['market'],
      _count: { id: true },
    })

    const marketStats = await Promise.all(
      markets.map(async (m) => {
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

    return NextResponse.json({
      overview: {
        totalPrompts,
        totalResults,
        overallMentionRate: totalResults > 0 ? mentionedResults / totalResults : 0,
        overallCitationRate: totalResults > 0 ? citedResults / totalResults : 0,
        platformsCount: PLATFORMS.length,
      },
      platformStats,
      communityStats,
      categoryStats,
      careLevelStats,
      marketStats,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
