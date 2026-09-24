import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLATFORMS } from '@/lib/utils'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { batchId } = await params

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { userId: true },
  })

  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch all completed run sessions for this batch, oldest first
  const sessions = await prisma.runSession.findMany({
    where: { batchId, status: 'done', results: { some: {} } },
    orderBy: { startedAt: 'asc' },
  })

  // For each session, compute aggregate stats
  const trend = await Promise.all(
    sessions.map(async (rs) => {
      const results = await prisma.result.findMany({
        where: { runSessionId: rs.id },
        select: { platform: true, isMentioned: true, isCited: true, sentiment: true },
      })

      const total = results.length
      const mentionedResults = results.filter((r) => r.isMentioned)
      const mentioned = mentionedResults.length
      const cited = results.filter((r) => r.isCited).length
      // Sentiment only means something on a response that actually mentions the
      // brand, so it's rated against mentions, not every result.
      const positive = mentionedResults.filter((r) => r.sentiment === 'positive').length
      const negative = mentionedResults.filter((r) => r.sentiment === 'negative').length

      // Per-platform breakdown
      const byPlatform: Record<string, { mentionRate: number; citationRate: number }> = {}
      for (const platform of PLATFORMS) {
        const pr = results.filter((r) => r.platform === platform)
        byPlatform[platform] = {
          mentionRate: pr.length > 0 ? pr.filter((r) => r.isMentioned).length / pr.length : 0,
          citationRate: pr.length > 0 ? pr.filter((r) => r.isCited).length / pr.length : 0,
        }
      }

      return {
        runSessionId: rs.id,
        startedAt: rs.startedAt,
        triggeredBy: rs.triggeredBy,
        total,
        mentionRate: total > 0 ? mentioned / total : 0,
        citationRate: total > 0 ? cited / total : 0,
        positiveRate: mentioned > 0 ? positive / mentioned : 0,
        negativeRate: mentioned > 0 ? negative / mentioned : 0,
        byPlatform,
      }
    })
  )

  return NextResponse.json(trend)
}
