import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { queryPlatformRaw } from '@/lib/ai-clients'
import { PLATFORMS } from '@/lib/utils'

export const maxDuration = 60

// GET /api/admin/test-dataforseo?platform=all&q=...
// Runs one prompt through DataForSEO for one platform (or every platform, with
// platform=all) and returns the raw answers and sources with timings. No brand
// scoring and nothing is saved.
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform') ?? 'chatgpt'
  const q = searchParams.get('q') ?? 'best assisted living communities in Chicago'

  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    return NextResponse.json({ error: 'DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set' }, { status: 500 })
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
