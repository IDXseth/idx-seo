import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canWrite } from '@/lib/access'

// GET /api/prompts?batchId=X — list prompts for a batch
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batchId')
  if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 })

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true },
  })

  if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const prompts = await prisma.prompt.findMany({
    where: { batchId },
    select: { id: true, promptText: true, communityName: true, promptType: true, category: true, city: true, market: true, levelOfCare: true },
    orderBy: { id: 'asc' },
  })

  return NextResponse.json(prompts)
}

// POST /api/prompts  — add a single prompt to an existing batch
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    batchId,
    promptText,
    communityName = '',
    promptType = 'brand',
    category = '',
    city = '',
    market = '',
    levelOfCare = '',
  } = body

  if (!batchId || !promptText) {
    return NextResponse.json(
      { error: 'batchId and promptText are required' },
      { status: 400 }
    )
  }

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { userId: true },
  })

  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  if (!canWrite(session.user.id, session.user.email, batch.userId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const prompt = await prisma.prompt.create({
    data: {
      batchId,
      promptText: promptText.trim(),
      communityName: communityName.trim(),
      promptType,
      category: category.trim(),
      city: city.trim(),
      market: market.trim(),
      levelOfCare,
    },
  })

  return NextResponse.json(prompt, { status: 201 })
}

// DELETE /api/prompts?id=X — delete a single prompt
// DELETE /api/prompts?batchId=X&communityName=Y — delete every prompt for a community within a batch
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const batchId = searchParams.get('batchId')
  const communityName = searchParams.get('communityName')

  if (id) {
    const prompt = await prisma.prompt.findUnique({
      where: { id },
      include: { batch: { select: { userId: true } } },
    })

    if (!prompt || !canWrite(session.user.id, session.user.email, prompt.batch.userId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.prompt.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  }

  if (batchId && communityName) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      select: { userId: true },
    })

    if (!batch || !canWrite(session.user.id, session.user.email, batch.userId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { count } = await prisma.prompt.deleteMany({ where: { batchId, communityName } })
    return NextResponse.json({ ok: true, count })
  }

  return NextResponse.json({ error: 'id, or batchId and communityName, required' }, { status: 400 })
}
