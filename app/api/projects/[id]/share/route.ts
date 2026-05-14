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

    const shares = await prisma.projectShare.findMany({
      where: { batchId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, createdAt: true },
    })

    return NextResponse.json(shares)
  } catch (error) {
    console.error('Get shares error:', error)
    return NextResponse.json({ error: 'Failed to get shares' }, { status: 500 })
  }
}

export async function POST(
  req: Request,
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

    const { email } = await req.json()
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Find if this user already exists
    const invitedUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    const share = await prisma.projectShare.upsert({
      where: { batchId_email: { batchId: id, email: normalizedEmail } },
      create: {
        batchId: id,
        email: normalizedEmail,
        userId: invitedUser?.id ?? null,
      },
      update: {},
    })

    return NextResponse.json(share)
  } catch (error) {
    console.error('Share project error:', error)
    return NextResponse.json({ error: 'Failed to share project' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
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

    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    await prisma.projectShare.deleteMany({
      where: { batchId: id, email: email.trim().toLowerCase() },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Revoke share error:', error)
    return NextResponse.json({ error: 'Failed to revoke share' }, { status: 500 })
  }
}
