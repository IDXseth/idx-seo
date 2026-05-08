import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateMockResults } from '@/lib/mock-ai'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const batchId = body.batchId as string | undefined

    // Find unrun prompts (no results yet)
    const prompts = await prisma.prompt.findMany({
      where: {
        ...(batchId ? { batchId } : {}),
        results: { none: {} },
      },
    })

    if (prompts.length === 0) {
      return NextResponse.json({ success: true, processed: 0, message: 'No unrun prompts found' })
    }

    let processed = 0

    for (const prompt of prompts) {
      const mockResults = generateMockResults(
        prompt.id,
        prompt.communityName,
        prompt.city,
        prompt.market,
        prompt.levelOfCare,
        prompt.promptType
      )

      for (const mock of mockResults) {
        const result = await prisma.result.create({
          data: {
            promptId: prompt.id,
            platform: mock.platform,
            responseText: mock.responseText,
            isMentioned: mock.isMentioned,
            isCited: mock.isCited,
          },
        })

        if (mock.citations.length > 0) {
          await prisma.citation.createMany({
            data: mock.citations.map((c) => ({
              resultId: result.id,
              url: c.url,
              title: c.title,
              domain: c.domain,
            })),
          })
        }
      }

      processed++
    }

    return NextResponse.json({ success: true, processed })
  } catch (error) {
    console.error('Run error:', error)
    return NextResponse.json({ error: 'Failed to run prompts' }, { status: 500 })
  }
}
