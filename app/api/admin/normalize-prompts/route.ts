import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeRow } from '@/lib/normalize'

export const maxDuration = 60

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prompts = await prisma.prompt.findMany({
    select: {
      id: true,
      promptType: true,
      category: true,
      communityName: true,
      city: true,
      market: true,
      levelOfCare: true,
      promptText: true,
    },
  })

  let updated = 0
  const unknownCare: string[] = []

  for (const prompt of prompts) {
    const norm = normalizeRow({
      promptType: prompt.promptType,
      category: prompt.category,
      communityName: prompt.communityName,
      city: prompt.city,
      market: prompt.market,
      levelOfCare: prompt.levelOfCare,
      promptText: prompt.promptText,
    })

    if (norm.isUnknownCare && norm.levelOfCare) {
      unknownCare.push(`[${prompt.id}] "${prompt.levelOfCare}" → "${norm.levelOfCare}"`)
    }

    const changed =
      norm.promptType !== prompt.promptType ||
      norm.category !== prompt.category ||
      norm.communityName !== prompt.communityName ||
      norm.city !== prompt.city ||
      norm.market !== prompt.market ||
      norm.levelOfCare !== prompt.levelOfCare ||
      norm.promptText !== prompt.promptText

    if (!changed) continue

    await prisma.prompt.update({
      where: { id: prompt.id },
      data: {
        promptType: norm.promptType,
        category: norm.category,
        communityName: norm.communityName,
        city: norm.city,
        market: norm.market,
        levelOfCare: norm.levelOfCare,
        promptText: norm.promptText,
      },
    })
    updated++
  }

  return NextResponse.json({
    total: prompts.length,
    updated,
    skipped: prompts.length - updated,
    unknownCareValues: unknownCare,
  })
}
