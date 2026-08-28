import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canWrite } from '@/lib/access'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: currentUserId, email: currentUserEmail } = session.user

    const batches = await prisma.batch.findMany({
      where: {},
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { prompts: true } },
        user: { select: { email: true } },
      },
    })

    // Add unrun count per batch
    const batchesWithUnrun = await Promise.all(
      batches.map(async (batch) => {
        const unrunCount = await prisma.prompt.count({
          where: {
            batchId: batch.id,
            results: { none: {} },
          },
        })
        const lastRun = await prisma.batchRun.findFirst({
          where: { batchId: batch.id, status: 'done' },
          orderBy: { finishedAt: 'desc' },
          select: { finishedAt: true },
        })
        const recentSessions = await prisma.runSession.findMany({
          where: { batchId: batch.id, results: { some: {} } },
          orderBy: { startedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            startedAt: true,
            triggeredBy: true,
            status: true,
            _count: { select: { results: true } },
          },
        })
        return {
          ...batch,
          userEmail: batch.user.email,
          canWrite: canWrite(currentUserId, currentUserEmail, batch.userId),
          unrunCount,
          lastRunAt: lastRun?.finishedAt?.toISOString() ?? null,
          recentSessions: recentSessions.map((s) => ({
            id: s.id,
            startedAt: s.startedAt.toISOString(),
            triggeredBy: s.triggeredBy,
            status: s.status,
            resultCount: s._count.results,
          })),
        }
      })
    )

    return NextResponse.json(batchesWithUnrun)
  } catch (error) {
    console.error('Batches error:', error)
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 })
  }
}
