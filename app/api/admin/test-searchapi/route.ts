import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const engine = searchParams.get('engine') ?? 'google_ai_mode'
  const q = searchParams.get('q') ?? 'assisted living communities near me'

  const apiKey = process.env.SEARCHAPI_KEY
  if (!apiKey) return NextResponse.json({ error: 'SEARCHAPI_KEY not set' }, { status: 500 })

  const url = new URL('https://www.searchapi.io/api/v1/search')
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('engine', engine)
  url.searchParams.set('q', q)
  url.searchParams.set('gl', 'us')
  url.searchParams.set('hl', 'en')

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })

  const data = await response.json()

  // Return top-level keys and the full response for diagnosis
  return NextResponse.json({
    status: response.status,
    topLevelKeys: Object.keys(data),
    // google_ai_mode fields
    markdown_length: typeof data.markdown === 'string' ? data.markdown.length : 0,
    markdown_preview: typeof data.markdown === 'string' ? data.markdown.slice(0, 400) : null,
    text_blocks_count: Array.isArray(data.text_blocks) ? data.text_blocks.length : 0,
    text_blocks_first: Array.isArray(data.text_blocks) ? data.text_blocks[0] ?? null : null,
    reference_links_count: Array.isArray(data.reference_links) ? data.reference_links.length : 0,
    reference_links_first: Array.isArray(data.reference_links) ? data.reference_links[0] ?? null : null,
    // engine=google fields
    ai_overview: data.ai_overview ?? null,
    answer: data.answer ?? null,
    answer_box: data.answer_box ?? null,
    organic_results_count: data.organic_results?.length ?? 0,
    full: data,
  })
}
