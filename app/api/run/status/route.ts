import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const maxDuration = 10

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const batchRunId = searchParams.get('batchRunId')
  const batchId = searchParams.get('batchId')

  if (!batchRunId && !batchId) {
    return NextResponse.json({ error: 'batchRunId or batchId required' }, { status: 400 })
  }

  const run = await prisma.batchRun.findFirst({
    where: batchRunId ? { id: batchRunId } : { batchId: batchId! },
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
