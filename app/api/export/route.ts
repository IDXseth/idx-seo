import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLATFORM_LABELS } from '@/lib/utils'
import { auth } from '@/lib/auth'
import * as xlsx from 'xlsx'

export const dynamic = 'force-dynamic'

// Excel sheet names: max 31 chars, no [ ] : * ? / \
function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Project'
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`
    candidate = base.slice(0, 31 - suffix.length) + suffix
    n++
  }
  used.add(candidate.toLowerCase())
  return candidate
}

// Exports one run session's results (mentions/citations/sentiment per prompt).
async function exportSessionResults(sessionId: string) {
  const runSession = await prisma.runSession.findUnique({
    where: { id: sessionId },
    select: { id: true, startedAt: true },
  })
  if (!runSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const results = await prisma.result.findMany({
    where: { runSessionId: sessionId },
    include: { prompt: true, citations: true },
    orderBy: [{ prompt: { communityName: 'asc' } }, { prompt: { city: 'asc' } }, { platform: 'asc' }],
  })

  const rows = results.map((r) => ({
    Community: r.prompt.communityName,
    City: r.prompt.city,
    Market: r.prompt.market,
    'Level of Care': r.prompt.levelOfCare,
    Category: r.prompt.category,
    'Prompt Type': r.prompt.promptType,
    Prompt: r.prompt.promptText,
    Platform: PLATFORM_LABELS[r.platform] ?? r.platform,
    Mentioned: r.isMentioned ? 'Yes' : 'No',
    Cited: r.isCited ? 'Yes' : 'No',
    Sentiment: r.sentiment,
    'Citation URLs': r.citations.filter((c) => c.isExplicitCitation).map((c) => c.url).join('; '),
    'Also Surfaced in Search': r.citations.filter((c) => !c.isExplicitCitation).map((c) => c.url).join('; '),
    Response: r.responseText.slice(0, 1000),
  }))

  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.json_to_sheet(rows)

  // Auto-width columns
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.min(60, Math.max(key.length, ...rows.map((r) => String(r[key as keyof typeof r] ?? '').length))),
  }))
  ws['!cols'] = colWidths

  xlsx.utils.book_append_sheet(wb, ws, 'Results')

  const buf: Buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const date = runSession.startedAt.toISOString().slice(0, 10)
  const filename = `ai-visibility-${date}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

// Exports every project's (batch's) prompt list, one sheet per project.
async function exportAllPrompts(userId: string, userEmail?: string | null) {
  const batches = await prisma.batch.findMany({
    where: {
      OR: [
        { userId },
        ...(userEmail ? [{ shares: { some: { email: userEmail } } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      prompts: { orderBy: { createdAt: 'asc' } },
    },
  })

  const workbook = xlsx.utils.book_new()
  const usedSheetNames = new Set<string>()

  for (const batch of batches) {
    const rows = batch.prompts.map((p) => ({
      'Prompt Type': p.promptType,
      'Category': p.category,
      'Community Name': p.communityName,
      'City': p.city,
      'Market': p.market,
      'Level of Care': p.levelOfCare,
      'Prompt Text': p.promptText,
      'Status': p.jobStatus,
      'Created At': p.createdAt.toISOString(),
    }))

    const sheet =
      rows.length > 0
        ? xlsx.utils.json_to_sheet(rows)
        : xlsx.utils.json_to_sheet([], {
            header: [
              'Prompt Type', 'Category', 'Community Name', 'City', 'Market',
              'Level of Care', 'Prompt Text', 'Status', 'Created At',
            ],
          })

    const sheetName = sanitizeSheetName(batch.name, usedSheetNames)
    xlsx.utils.book_append_sheet(workbook, sheet, sheetName)
  }

  if (batches.length === 0) {
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([['No projects found']]), 'Prompts')
  }

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="prompts-export-${date}.xlsx"`,
    },
  })
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const sessionId = req.nextUrl.searchParams.get('session')
    if (sessionId) return await exportSessionResults(sessionId)
    return await exportAllPrompts(session.user.id, session.user.email)
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}
