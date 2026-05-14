import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendShareInviteEmail } from '@/lib/email'

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

    const { share, created } = await prisma.$transaction(async (tx) => {
      const existing = await tx.projectShare.findUnique({
        where: { batchId_email: { batchId: id, email: normalizedEmail } },
      })
      if (existing) return { share: existing, created: false }
      const s = await tx.projectShare.create({
        data: { batchId: id, email: normalizedEmail, userId: invitedUser?.id ?? null },
      })
      return { share: s, created: true }
    })

    // Send invite email only on first share (not re-invites)
    if (created) {
      const batchWithToken = await prisma.batch.findUnique({
        where: { id },
        select: { name: true, shareToken: true },
      })
      sendShareInviteEmail({
        to: normalizedEmail,
        batchName: batchWithToken?.name ?? 'AI Visibility Project',
        invitedByName: session.user.name,
        invitedByEmail: session.user.email,
        shareToken: batchWithToken?.shareToken,
      }).catch((err) => console.error('Share invite email failed:', err))
    }

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
