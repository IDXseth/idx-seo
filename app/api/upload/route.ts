import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]+/g, '_')
}

function getField(row: Record<string, unknown>, ...keys: string[]): string {
  const normalized = Object.keys(row).reduce((acc, k) => {
    acc[normalizeKey(k)] = row[k]
    return acc
  }, {} as Record<string, unknown>)

  for (const key of keys) {
    const val = normalized[normalizeKey(key)]
    if (val !== undefined && val !== null && val !== '') {
      return String(val).trim()
    }
  }
  return ''
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const batchName = formData.get('batchName') as string || 'Unnamed Batch'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[]

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows found in spreadsheet' }, { status: 400 })
    }

    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all prompt texts already owned by this user to prevent cross-batch duplication
    const existingPrompts = await prisma.prompt.findMany({
      where: { batch: { userId } },
      select: { promptText: true },
    })
    const existingTexts = new Set(existingPrompts.map((p) => p.promptText))

    const parsedRows = rows.map((row) => ({
      promptType: getField(row, 'prompt_type', 'type', 'promptType') || 'nonbrand',
      category: getField(row, 'category'),
      communityName: getField(row, 'community_name', 'community', 'communityName'),
      city: getField(row, 'city'),
      market: getField(row, 'market'),
      levelOfCare: getField(row, 'level_of_care', 'care_level', 'levelOfCare'),
      promptText: getField(row, 'prompt', 'prompt_text', 'promptText'),
    }))

    const uniqueRows = parsedRows.filter((r) => r.promptText && !existingTexts.has(r.promptText))
    const skippedCount = parsedRows.length - uniqueRows.length

    const batch = await prisma.batch.create({
      data: {
        name: batchName,
        fileName: file.name,
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
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 })
  }
}
