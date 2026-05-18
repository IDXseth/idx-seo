import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify the run session belongs to a batch owned by this user
    const runSession = await prisma.runSession.findUnique({
      where: { id },
      select: { id: true, batch: { select: { userId: true } } },
    })

    if (!runSession) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (runSession.batch?.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Manual cascade: citations are deleted via Result cascade, then results, then batchRuns, then session
    const results = await prisma.result.findMany({
      where: { runSessionId: id },
      select: { id: true },
    })
    const resultIds = results.map((r) => r.id)

    await prisma.citation.deleteMany({ where: { resultId: { in: resultIds } } })
    await prisma.result.deleteMany({ where: { runSessionId: id } })
    await prisma.batchRun.deleteMany({ where: { runSessionId: id } })
    await prisma.runSession.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete run session error:', error)
    return NextResponse.json({ error: 'Failed to delete run session' }, { status: 500 })
  }
}
