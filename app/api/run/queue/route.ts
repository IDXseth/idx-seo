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

  // Count unrun prompts
  const unrunCount = await prisma.prompt.count({
    where: {
      ...(batchId ? { batchId } : { batch: { userId: session.user.id } }),
      results: { none: {} },
    },
  })

  if (unrunCount === 0) {
    return NextResponse.json({ success: true, processed: 0, message: 'No unrun prompts found' })
  }

  const batchRun = await prisma.batchRun.create({
    data: {
      ...(batchId ? { batchId } : {}),
      totalPrompts: unrunCount,
      notifyEmail: notifyEmail ?? null,
      status: 'running',
    },
  })

  await inngest.send({
    name: 'batch/run.requested',
    data: { batchId, batchRunId: batchRun.id, notifyEmail },
  })

  return NextResponse.json({ batchRunId: batchRun.id, totalPrompts: unrunCount })
}
