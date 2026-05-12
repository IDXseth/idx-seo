import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userEmail = session.user.email

    // Get batches owned by user OR shared with user (by email)
    const batches = await prisma.batch.findMany({
      where: {
        OR: [
          { userId },
          ...(userEmail
            ? [{ shares: { some: { email: userEmail } } }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { prompts: true } },
      },
    })

    // Add unrun count per batch
    const batchesWithUnrun = await Promise.all(
      batches.map(async (batch) => {
        const unrunCount = await prisma.prompt.count({
          where: {
            batchId: batch.id,
            results: { none: {} },
          },
        })
        return { ...batch, unrunCount }
      })
    )

    return NextResponse.json(batchesWithUnrun)
  } catch (error) {
    console.error('Batches error:', error)
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 })
  }
}
