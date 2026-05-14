import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/lib/inngest'

export const maxDuration = 10

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const batchId = body.batchId as string | undefined
  const notifyEmail = body.email as string | undefined
  const triggeredBy = (body.triggeredBy as string | undefined) ?? 'manual'
  const scheduleId = body.scheduleId as string | undefined

  // For re-runs, count ALL prompts in the batch; for first runs, count unrun only
  const isRerun = body.rerun === true
  const promptCount = await prisma.prompt.count({
    where: {
      ...(batchId ? { batchId } : { batch: { userId: session.user.id } }),
      ...(isRerun ? {} : { results: { none: {} } }),
    },
  })

  if (promptCount === 0) {
    return NextResponse.json({ success: true, processed: 0, message: 'No prompts found' })
  }

  // Create a RunSession (user-facing snapshot for trend analysis)
  const runSession = await prisma.runSession.create({
    data: {
      ...(batchId ? { batchId } : {}),
      triggeredBy,
      ...(scheduleId ? { scheduleId } : {}),
      status: 'running',
    },
  })

  // Create BatchRun (Inngest job tracker)
  const batchRun = await prisma.batchRun.create({
    data: {
      ...(batchId ? { batchId } : {}),
      runSessionId: runSession.id,
      totalPrompts: promptCount,
      notifyEmail: notifyEmail ?? null,
      status: 'running',
    },
  })

  await inngest.send({
    name: 'batch/run.requested',
    data: { batchId, batchRunId: batchRun.id, runSessionId: runSession.id, notifyEmail, isRerun },
  })

  return NextResponse.json({ batchRunId: batchRun.id, runSessionId: runSession.id, totalPrompts: promptCount })
}
