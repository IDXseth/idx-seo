import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? 'assisted living communities near me'

  const apiKey = process.env.SEARCHAPI_KEY
  if (!apiKey) return NextResponse.json({ error: 'SEARCHAPI_KEY not set' }, { status: 500 })

  // Step 1: engine=google — returns a compact ai_overview + page_token when Google serves one.
  const step1Url = new URL('https://www.searchapi.io/api/v1/search')
  step1Url.searchParams.set('api_key', apiKey)
  step1Url.searchParams.set('engine', 'google')
  step1Url.searchParams.set('q', q)
  step1Url.searchParams.set('gl', 'us')
  step1Url.searchParams.set('hl', 'en')

  const step1Res = await fetch(step1Url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  const step1Data = await step1Res.json()
  const pageToken: string | undefined = step1Data.ai_overview?.page_token

  // Step 2: engine=google_ai_overview with that page_token — returns the full
  // expanded overview (markdown/text_blocks/reference_links). The token expires
  // in under a minute, so it must be chained immediately after step 1.
  let step2Data: Record<string, unknown> | null = null
  let step2Status: number | null = null
  if (pageToken) {
    const step2Url = new URL('https://www.searchapi.io/api/v1/search')
    step2Url.searchParams.set('api_key', apiKey)
    step2Url.searchParams.set('engine', 'google_ai_overview')
    step2Url.searchParams.set('q', q)
    step2Url.searchParams.set('page_token', pageToken)
    step2Url.searchParams.set('gl', 'us')
    step2Url.searchParams.set('hl', 'en')

    const step2Res = await fetch(step2Url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
    step2Status = step2Res.status
    step2Data = await step2Res.json()
  }

  return NextResponse.json({
    step1Status: step1Res.status,
    hasAiOverview: !!step1Data.ai_overview,
    hasPageToken: !!pageToken,
    step1_ai_overview: step1Data.ai_overview ?? null,
    step2Status,
    // The two fields we're diagnosing: do reference_links carry indexes tying
    // them to specific text_blocks, or are they one flat undifferentiated list?
    step2_text_blocks: step2Data?.text_blocks ?? null,
    step2_reference_links: step2Data?.reference_links ?? null,
    step2_markdown_preview:
      typeof step2Data?.markdown === 'string' ? (step2Data.markdown as string).slice(0, 500) : null,
    step1_full: step1Data,
    step2_full: step2Data,
  })
}
