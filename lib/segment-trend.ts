import { prisma } from './prisma'
import { PLATFORMS } from './utils'
import type { TrendPoint } from '@/components/trend-charts'
import type { Prisma } from '@prisma/client'

export async function getSegmentTrendData(
  promptWhere: Prisma.PromptWhereInput
): Promise<TrendPoint[]> {
  const sessions = await prisma.runSession.findMany({
    where: { status: 'done' },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      startedAt: true,
      triggeredBy: true,
      results: {
        where: { prompt: promptWhere },
        select: { platform: true, isMentioned: true, isCited: true, sentiment: true },
      },
    },
  })

  return sessions
    .filter((s) => s.results.length > 0)
    .map((s) => {
      const results = s.results
      const total = results.length
      const mentioned = results.filter((r) => r.isMentioned).length
      const cited = results.filter((r) => r.isCited).length
      const positive = results.filter((r) => r.sentiment === 'positive').length
      const negative = results.filter((r) => r.sentiment === 'negative').length

      const byPlatform: Record<string, { mentionRate: number; citationRate: number }> = {}
      for (const platform of PLATFORMS) {
        const pr = results.filter((r) => r.platform === platform)
        byPlatform[platform] = {
          mentionRate: pr.length > 0 ? pr.filter((r) => r.isMentioned).length / pr.length : 0,
          citationRate: pr.length > 0 ? pr.filter((r) => r.isCited).length / pr.length : 0,
        }
      }

      return {
        runSessionId: s.id,
        startedAt: s.startedAt.toISOString(),
        triggeredBy: s.triggeredBy,
        total,
        mentionRate: total > 0 ? mentioned / total : 0,
        citationRate: total > 0 ? cited / total : 0,
        positiveRate: total > 0 ? positive / total : 0,
        negativeRate: total > 0 ? negative / total : 0,
        byPlatform,
      }
    })
}
