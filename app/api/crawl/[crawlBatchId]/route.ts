import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGscMetrics } from '@/lib/gsc'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ crawlBatchId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { crawlBatchId } = await params

  const crawlBatch = await prisma.crawlBatch.findUnique({
    where: { id: crawlBatchId },
    include: { pages: { include: { recommendation: true }, orderBy: { url: 'asc' } } },
  })

  if (!crawlBatch) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (crawlBatch.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const gscMetrics = await getGscMetrics()

  const pages = crawlBatch.pages.map((page) => ({
    ...page,
    gsc: gscMetrics.get(page.url) ?? null,
  }))

  return NextResponse.json({
    id: crawlBatch.id,
    name: crawlBatch.name,
    fileName: crawlBatch.fileName,
    status: crawlBatch.status,
    totalPages: crawlBatch.totalPages,
    donePages: crawlBatch.donePages,
    createdAt: crawlBatch.createdAt,
    pages,
  })
}
