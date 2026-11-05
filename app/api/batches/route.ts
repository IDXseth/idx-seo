import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canWrite } from '@/lib/access'

interface CostTotals {
  costUsd: number
  inputTokens: number
  outputTokens: number
  searchCount: number
  untrackedResults: number  // results saved before cost tracking, or timed out
}

function emptyCost(): CostTotals {
  return { costUsd: 0, inputTokens: 0, outputTokens: 0, searchCount: 0, untrackedResults: 0 }
}

type CostRow = {
  platform: string
  _sum: { costUsd: number | null; inputTokens: number | null; outputTokens: number | null; searchCount: number | null }
  _count: { _all: number; costUsd: number }
}

function addCostRow(totals: CostTotals, row: CostRow) {
  totals.costUsd += row._sum.costUsd ?? 0
  totals.inputTokens += row._sum.inputTokens ?? 0
  totals.outputTokens += row._sum.outputTokens ?? 0
  totals.searchCount += row._sum.searchCount ?? 0
  totals.untrackedResults += row._count._all - row._count.costUsd
}

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
        // One grouped query gives both the project total and each run's
        // per-platform breakdown. Results with no run session (single-prompt
        // runs) still count toward the project total.
        const costRows = await prisma.result.groupBy({
          by: ['runSessionId', 'platform'],
          where: { prompt: { batchId: batch.id } },
          _sum: { costUsd: true, inputTokens: true, outputTokens: true, searchCount: true },
          _count: { _all: true, costUsd: true },
        })
        const cost = emptyCost()
        const sessionCosts = new Map<string, CostTotals & { byPlatform: Array<CostTotals & { platform: string }> }>()
        for (const row of costRows) {
          addCostRow(cost, row)
          if (!row.runSessionId) continue
          let sessionCost = sessionCosts.get(row.runSessionId)
          if (!sessionCost) {
            sessionCost = { ...emptyCost(), byPlatform: [] }
            sessionCosts.set(row.runSessionId, sessionCost)
          }
          addCostRow(sessionCost, row)
          const platformCost = { ...emptyCost(), platform: row.platform }
          addCostRow(platformCost, row)
          sessionCost.byPlatform.push(platformCost)
        }

        return {
          ...batch,
          cost,
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
            cost: sessionCosts.get(s.id) ?? null,
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
