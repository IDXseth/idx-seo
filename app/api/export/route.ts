import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PLATFORM_LABELS } from '@/lib/utils'
import { auth } from '@/lib/auth'
import * as xlsx from 'xlsx'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = req.nextUrl.searchParams.get('session')
  if (!sessionId) return NextResponse.json({ error: 'Missing session param' }, { status: 400 })

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
    'Citation URLs': r.citations.map((c) => c.url).join('; '),
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
