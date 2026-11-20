import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLATFORMS } from '@/lib/utils'
import { getViewer } from '@/lib/access'
import { activeBatchWhere } from '@/lib/projects'

export async function GET() {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Every query below is limited to prompts the viewer can read in the active project.
  const pw = { batch: await activeBatchWhere(viewer) }
  const rw = { prompt: pw }

  try {
    const [totalPrompts, totalResults, mentionedResults, citedResults] = await Promise.all([
      prisma.prompt.count({ where: pw }),
      prisma.result.count({ where: rw }),
      prisma.result.count({ where: { ...rw, isMentioned: true } }),
      prisma.result.count({ where: { ...rw, isCited: true } }),
    ])

    // Per-platform stats
    const platformStats = await Promise.all(
      PLATFORMS.map(async (platform) => {
        const [total, mentioned, cited] = await Promise.all([
          prisma.result.count({ where: { ...rw, platform } }),
          prisma.result.count({ where: { ...rw, platform, isMentioned: true } }),
          prisma.result.count({ where: { ...rw, platform, isCited: true } }),
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
      where: pw,
      _count: { id: true },
    })

    const communityStats = await Promise.all(
      communities.map(async (c) => {
        const results = await prisma.result.findMany({
          where: { prompt: { ...pw, communityName: c.communityName } },
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
      where: pw,
      _count: { id: true },
    })

    const categoryStats = await Promise.all(
      categories.map(async (c) => {
        const results = await prisma.result.findMany({
          where: { prompt: { ...pw, category: c.category } },
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
      where: pw,
      _count: { id: true },
    })

    const careLevelStats = await Promise.all(
      careLevels.map(async (c) => {
        const results = await prisma.result.findMany({
          where: { prompt: { ...pw, levelOfCare: c.levelOfCare } },
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
      where: pw,
      _count: { id: true },
    })

    const marketStats = await Promise.all(
      markets.map(async (m) => {
        const results = await prisma.result.findMany({
          where: { prompt: { ...pw, market: m.market } },
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
