import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeRow } from '@/lib/normalize'

interface CommitSuggestion {
  category?: string
  levelOfCare?: string
  promptText: string
}

// POST /api/suggestions/commit — turn a set of accepted suggestions into a
// new Batch of Prompts, same shape as an /api/upload result.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await req.json().catch(() => ({}))
  const {
    batchName = 'AI-Suggested Prompts',
    communityName = '',
    city = '',
    market = '',
    promptType = 'nonbrand',
    prompts = [],
  } = body as {
    batchName?: string
    communityName?: string
    city?: string
    market?: string
    promptType?: string
    prompts?: CommitSuggestion[]
  }

  if (!Array.isArray(prompts) || prompts.length === 0) {
    return NextResponse.json({ error: 'At least one prompt is required' }, { status: 400 })
  }

  const existingPrompts = await prisma.prompt.findMany({
    where: { batch: { userId } },
    select: { promptText: true },
  })
  const existingTexts = new Set(existingPrompts.map((p) => p.promptText))

  const rows = prompts
    .filter((p) => p && typeof p.promptText === 'string' && p.promptText.trim())
    .map((p) =>
      normalizeRow({
        promptType: String(promptType),
        category: p.category ?? '',
        communityName: String(communityName),
        city: String(city),
        market: String(market),
        levelOfCare: p.levelOfCare ?? '',
        promptText: p.promptText,
      })
    )

  const uniqueRows = rows
    .filter((r) => !existingTexts.has(r.promptText))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ isUnknownCare: _isUnknownCare, ...r }) => r)
  const skippedCount = rows.length - uniqueRows.length

  const batch = await prisma.batch.create({
    data: {
      name: String(batchName).trim() || 'AI-Suggested Prompts',
      fileName: 'ai-suggested-prompts',
      userId,
    },
  })

  if (uniqueRows.length > 0) {
    await prisma.prompt.createMany({
      data: uniqueRows.map((r) => ({ batchId: batch.id, ...r })),
    })
  }

  return NextResponse.json({
    success: true,
    batchId: batch.id,
    promptCount: uniqueRows.length,
    skippedCount,
  })
}
