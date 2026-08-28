import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canWrite } from '@/lib/access'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id },
      include: {
        results: {
          include: {
            citations: true,
          },
        },
        batch: true,
      },
    })

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    return NextResponse.json(prompt)
  } catch (error) {
    console.error('Prompt fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch prompt' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const {
      promptText,
      communityName,
      promptType,
      category,
      city,
      market,
      levelOfCare,
    } = body

    if (!promptText?.trim()) {
      return NextResponse.json({ error: 'Prompt text is required' }, { status: 400 })
    }

    const existing = await prisma.prompt.findUnique({
      where: { id },
      include: { batch: { select: { userId: true } } },
    })

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!canWrite(session.user.id, session.user.email, existing.batch.userId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.prompt.update({
      where: { id },
      data: {
        promptText: promptText.trim(),
        communityName: (communityName ?? existing.communityName ?? '').trim(),
        promptType: promptType ?? existing.promptType,
        category: (category ?? existing.category ?? '').trim(),
        city: (city ?? existing.city ?? '').trim(),
        market: (market ?? existing.market ?? '').trim(),
        levelOfCare: levelOfCare ?? existing.levelOfCare,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Prompt update error:', error)
    return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 })
  }
}
