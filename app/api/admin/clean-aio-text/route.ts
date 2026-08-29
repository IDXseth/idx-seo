import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cleanLegacyAIOResponseText } from '@/lib/ai-clients'

export const maxDuration = 60

// One-time backfill: repairs google_aio Result.responseText rows saved before
// the markdown-link cleanup fix (stray "(https://www.google.com/goto?...)"
// fragments and corrupted "[ - Title](url)" bibliography lines left over from
// the old citation-marker stripping regex). Pass ?dryRun=1 to preview the
// count and a few examples without writing anything.
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'

  const results = await prisma.result.findMany({
    where: { platform: 'google_aio' },
    select: { id: true, responseText: true },
  })

  const changed: Array<{ id: string; before: string; after: string }> = []
  for (const r of results) {
    const after = cleanLegacyAIOResponseText(r.responseText)
    if (after !== r.responseText) changed.push({ id: r.id, before: r.responseText, after })
  }

  if (!dryRun) {
    for (const c of changed) {
      await prisma.result.update({ where: { id: c.id }, data: { responseText: c.after } })
    }
  }

  return NextResponse.json({
    dryRun,
    total: results.length,
    changed: changed.length,
    unchanged: results.length - changed.length,
    samples: changed.slice(0, 3).map((c) => ({
      id: c.id,
      before: c.before.slice(0, 300),
      after: c.after.slice(0, 300),
    })),
  })
}
