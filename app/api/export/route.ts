import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLATFORM_LABELS } from '@/lib/utils'
import { getViewer, type Viewer } from '@/lib/access'
import { activeBatchWhere } from '@/lib/projects'
import * as xlsx from 'xlsx'
import { getDetectionContext } from '@/lib/detection-context'
import type { DetectionContext } from '@/lib/detection'
import { fitToLimit, mentionExcerpt } from '@/lib/excerpts'

export const dynamic = 'force-dynamic'

// Excel sheet names: max 31 chars, no [ ] : * ? / \
function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Prompt set'
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

// Vercel functions can return at most 4.5 MB; leave room for headers.
const MAX_EXPORT_BYTES = 4_000_000

// Exports one run session's results (mentions/citations/sentiment per prompt).
// Answers are exported in full (up to Excel's cell limit), next to an excerpt of
// just the sentences naming the brand, its location or a competitor. If full
// answers would make the file too big to download, it falls back to excerpts.
async function exportSessionResults(viewer: Viewer, sessionId: string) {
  const runSession = await prisma.runSession.findUnique({
    where: { id: sessionId },
    select: { id: true, startedAt: true },
  })
  if (!runSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const results = await prisma.result.findMany({
    where: { runSessionId: sessionId, prompt: { batch: await activeBatchWhere(viewer) } },
    include: { prompt: { include: { batch: { select: { userId: true, projectId: true } } } }, citations: true },
    orderBy: [{ prompt: { communityName: 'asc' } }, { prompt: { city: 'asc' } }, { platform: 'asc' }],
  })

  // Brand and competitors are the same for every prompt in a project, so load
  // them once per project; only the prompt's own location differs.
  const contexts = new Map<string, Promise<DetectionContext>>()
  const contextFor = async (prompt: (typeof results)[number]['prompt']): Promise<DetectionContext> => {
    const key = `${prompt.projectId ?? prompt.batch.projectId}|${prompt.batch.userId}`
    if (!contexts.has(key)) contexts.set(key, getDetectionContext(prompt))
    const ctx = await contexts.get(key)!
    return { ...ctx, entityName: prompt.entityName || prompt.communityName || undefined }
  }

  const rows = await Promise.all(results.map(async (r) => ({
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
    'Brand & Competitor Excerpts': mentionExcerpt(r.responseText, await contextFor(r.prompt)),
    Response: fitToLimit(r.responseText),
  })))

  let buf = buildResultsWorkbook(rows)
  if (buf.length > MAX_EXPORT_BYTES) {
    buf = buildResultsWorkbook(
      rows.map((r) => Object.fromEntries(Object.entries(r).filter(([key]) => key !== 'Response'))),
      'Full answers were left out: with them this file would be too large to download. ' +
        'The Brand & Competitor Excerpts column has the sentences naming your brand or a competitor; ' +
        'full answers are on each prompt\'s results page.'
    )
  }
  if (buf.length > MAX_EXPORT_BYTES) {
    return NextResponse.json({ error: 'This run is too large to export as one file.' }, { status: 413 })
  }

  const date = runSession.startedAt.toISOString().slice(0, 10)
  const filename = `ai-visibility-${date}.xlsx`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function buildResultsWorkbook(rows: Array<Record<string, string>>, note?: string): Buffer {
  const wb = xlsx.utils.book_new()
  const ws = xlsx.utils.json_to_sheet(rows)

  // Auto-width columns
  ws['!cols'] = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.min(60, Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length))),
  }))

  xlsx.utils.book_append_sheet(wb, ws, 'Results')
  if (note) xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([[note]]), 'Note')

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

// Exports every prompt set in the active project, one sheet per prompt set.
async function exportAllPrompts(viewer: Viewer) {
  const batches = await prisma.batch.findMany({
    where: await activeBatchWhere(viewer),
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
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([['No prompt sets found']]), 'Prompts')
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
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const sessionId = req.nextUrl.searchParams.get('session')
    if (sessionId) return await exportSessionResults(viewer, sessionId)
    return await exportAllPrompts(viewer)
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}
