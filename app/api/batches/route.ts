import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const batches = await prisma.batch.findMany({
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
