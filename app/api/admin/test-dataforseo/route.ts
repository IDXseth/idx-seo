import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isSuperUser } from '@/lib/access'
import { queryPlatformRaw, listDataForSEOModels } from '@/lib/ai-clients'
import { PLATFORMS } from '@/lib/utils'

export const maxDuration = 60

// GET /api/admin/test-dataforseo?platform=all&q=...
// Runs one prompt through DataForSEO for one platform (or every platform, with
// platform=all) and returns the raw answers, sources, timings and DataForSEO
// cost. No brand scoring and nothing is saved.
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Every call is a paid DataForSEO query — super users only, like the other admin routes.
  if (!isSuperUser(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform') ?? 'chatgpt'
  const q = searchParams.get('q')?.trim()

  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    return NextResponse.json({ error: 'DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set' }, { status: 500 })
  }

  // ?models=1 — list the model names this DataForSEO account accepts per platform
  if (searchParams.get('models')) {
    return NextResponse.json(await listDataForSEOModels())
  }

  if (!q) {
    return NextResponse.json(
      { error: 'Pass the prompt to test as ?q=..., e.g. ?platform=all&q=your+question (or ?models=1 to list models)' },
      { status: 400 }
    )
  }

  const targets: string[] = platform === 'all' ? [...PLATFORMS] : [platform]
  const results = await Promise.all(
    targets.map(async (p) => {
      const started = Date.now()
      const result = await queryPlatformRaw(p, q)
      return { platform: p, ms: Date.now() - started, ...result }
    })
  )

  return NextResponse.json({ prompt: q, results })
}
