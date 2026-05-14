import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PLATFORMS } from '@/lib/utils'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { batchId } = await params

    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true, name: true, userId: true, shares: { select: { email: true } } },
    })

    if (!batch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const canAccess =
      batch.userId === session.user.id ||
      batch.shares.some((s) => s.email === session.user.email)

    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const prompts = await prisma.prompt.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
      include: {
        results: {
          include: { citations: true },
        },
      },
    })

    const rows = prompts.map((prompt) => {
      const platformData: Record<string, { responseText: string; isMentioned: boolean; isCited: boolean }> = {}
      for (const platform of PLATFORMS) {
        const result = prompt.results.find((r) => r.platform === platform)
        platformData[platform] = result
          ? { responseText: result.responseText, isMentioned: result.isMentioned, isCited: result.isCited }
          : { responseText: '', isMentioned: false, isCited: false }
      }
      return {
        promptId: prompt.id,
        promptText: prompt.promptText,
        communityName: prompt.communityName,
        city: prompt.city,
        market: prompt.market,
        category: prompt.category,
        promptType: prompt.promptType,
        levelOfCare: prompt.levelOfCare,
        platforms: platformData,
      }
    })

    return NextResponse.json({ batchName: batch.name, platforms: PLATFORMS, rows })
  } catch (error) {
    console.error('Data route error:', error)
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })
  }
}
