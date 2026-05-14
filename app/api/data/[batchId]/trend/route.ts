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
    select: { userId: true, shares: { select: { email: true } } },
  })

  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canAccess =
    batch.userId === session.user.id ||
    batch.shares.some((s) => s.email === session.user?.email)

  if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch all completed run sessions for this batch, oldest first
  const sessions = await prisma.runSession.findMany({
    where: { batchId, status: 'done' },
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
      const mentioned = results.filter((r) => r.isMentioned).length
      const cited = results.filter((r) => r.isCited).length
      const positive = results.filter((r) => r.sentiment === 'positive').length
      const negative = results.filter((r) => r.sentiment === 'negative').length

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
        positiveRate: total > 0 ? positive / total : 0,
        negativeRate: total > 0 ? negative / total : 0,
        byPlatform,
      }
    })
  )

  return NextResponse.json(trend)
}
