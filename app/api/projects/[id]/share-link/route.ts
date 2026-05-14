import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getAuthorizedBatch(batchId: string, userId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } })
  if (!batch) return null
  if (batch.userId !== userId) return null
  return batch
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const batch = await getAuthorizedBatch(id, session.user.id)
    if (!batch) {
      return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
    }

    return NextResponse.json({ shareToken: batch.shareToken })
  } catch (error) {
    console.error('Get share link error:', error)
    return NextResponse.json({ error: 'Failed to get share link' }, { status: 500 })
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const batch = await getAuthorizedBatch(id, session.user.id)
    if (!batch) {
      return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
    }

    // If already has a token, keep it; otherwise generate one
    let shareToken = batch.shareToken
    if (!shareToken) {
      shareToken = Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
      await prisma.batch.update({
        where: { id },
        data: { shareToken },
      })
    }

    return NextResponse.json({ shareToken })
  } catch (error) {
    console.error('Enable share link error:', error)
    return NextResponse.json({ error: 'Failed to enable share link' }, { status: 500 })
  }
}

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
    const batch = await getAuthorizedBatch(id, session.user.id)
    if (!batch) {
      return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
    }

    await prisma.batch.update({
      where: { id },
      data: { shareToken: null },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Disable share link error:', error)
    return NextResponse.json({ error: 'Failed to disable share link' }, { status: 500 })
  }
}
