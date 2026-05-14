import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/prompts  — add a single prompt to an existing batch
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const {
    batchId,
    promptText,
    communityName,
    promptType = 'brand',
    category = '',
    city = '',
    market = '',
    levelOfCare = '',
  } = body

  if (!batchId || !promptText || !communityName) {
    return NextResponse.json(
      { error: 'batchId, promptText, and communityName are required' },
      { status: 400 }
    )
  }

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { userId: true, shares: { select: { email: true } } },
  })

  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  const canAccess =
    batch.userId === session.user.id ||
    batch.shares.some((s) => s.email === session.user?.email)

  if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

// DELETE /api/prompts?id=X
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const prompt = await prisma.prompt.findUnique({
    where: { id },
    include: { batch: { select: { userId: true } } },
  })

  if (!prompt || prompt.batch.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.prompt.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
