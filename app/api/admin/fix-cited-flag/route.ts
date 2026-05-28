import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET() {
  return run()
}

export async function POST() {
  return run()
}

async function run() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const toFix = await prisma.result.findMany({
    where: {
      isCited: false,
      citations: {
        some: {
          OR: [
            { url: { contains: 'seniorlifestyle.com', mode: 'insensitive' } },
            { domain: { contains: 'seniorlifestyle.com', mode: 'insensitive' } },
          ],
        },
      },
    },
    select: { id: true },
  })

  if (toFix.length === 0) {
    return NextResponse.json({ updated: 0, message: 'Nothing to fix.' })
  }

  const { count } = await prisma.result.updateMany({
    where: { id: { in: toFix.map((r) => r.id) } },
    data: { isCited: true },
  })

  return NextResponse.json({ updated: count })
}
