import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getViewer, readableBatchWhere } from '@/lib/access'

export const maxDuration = 10

export async function GET(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchRunId = searchParams.get('batchRunId')
  const batchId = searchParams.get('batchId')

  if (!batchRunId && !batchId) {
    return NextResponse.json({ error: 'batchRunId or batchId required' }, { status: 400 })
  }

  // A "run all" BatchRun has no batch; its status only matters to whoever started it,
  // and it carries nothing but progress counts, so it isn't scoped further.
  const run = await prisma.batchRun.findFirst({
    where: {
      ...(batchRunId ? { id: batchRunId } : { batchId: batchId! }),
      OR: [{ batchId: null }, { batch: { is: readableBatchWhere(viewer) } }],
    },
    orderBy: { startedAt: 'desc' },
  })

  if (!run) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    batchRunId: run.id,
    totalPrompts: run.totalPrompts,
    doneCount: run.doneCount,
    failCount: run.failCount,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  })
}
