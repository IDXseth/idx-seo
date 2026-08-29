async function resolveRedirect(url: string): Promise<string> {
  if (!url.includes('vertexaisearch.cloud.google.com')) return url
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) })
    return res.url || url
  } catch {
    return url
  }
}

export interface PlatformCitation {
  url: string
  title: string
  domain: string
  // true: explicitly cited/quoted in the platform's answer text.
  // false: retrieved by the platform's web search step but not directly cited —
  // real data the platform's own tools returned, just not quoted inline.
  isExplicitCitation: boolean
}

export interface PlatformResult {
  responseText: string
  isMentioned: boolean
  isCited: boolean
  sentiment: 'positive' | 'neutral' | 'negative'
  citations: PlatformCitation[]
  error?: string
}

export async function analyzeSentiment(
  responseText: string,
  communityName: string
): Promise<'positive' | 'neutral' | 'negative'> {
  if (!responseText || responseText.startsWith('[Error]') || responseText.startsWith('[Timeout]') || responseText.startsWith('[No AI Overview]')) {
    return 'neutral'
  }
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5,
      messages: [{
        role: 'user',
        content: `How does this AI response portray "${communityName}"? Reply with exactly one word: positive, neutral, or negative.\n\n${responseText.slice(0, 1500)}`,
      }],
    })
    const word = response.content[0]?.type === 'text' ? response.content[0].text.toLowerCase() : ''
    if (word.includes('positive')) return 'positive'
    if (word.includes('negative')) return 'negative'
    return 'neutral'
  } catch {
    return 'neutral'
  }
}

function checkMention(text: string, communityName: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  return (
    (!!communityName && lower.includes(communityName.toLowerCase())) ||
    lower.includes('senior lifestyle corporation') ||
    lower.includes('senior lifestyle')
  )
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// SearchAPI's Google AI Overview sources are frequently wrapped in an opaque
// google.com/goto?url=<token> (or /aclk?...) redirect rather than the real
// destination URL, which would make extractDomain(url) return "google.com" for
// every one of them — silently breaking domain-based citation matching (e.g.
// "is seniorlifestyle.com cited?" would always say no). The favicon URL
// SearchAPI returns alongside each source is Google's own favicon-fetch
// service, which carries the real destination as its own `url` query param —
// real data already returned, just meant for a different purpose — so prefer
// that to recover the true domain when the primary link is one of these
// redirects. Falls back to the link itself when there's no favicon to recover
// from, so behavior is unchanged for sources that already give a direct URL.
function resolveCitationDomain(url: string, favicon?: string): string {
  if ((url.includes('google.com/goto') || url.includes('google.com/aclk')) && favicon) {
    try {
      const inner = new URL(favicon).searchParams.get('url')
      if (inner) return extractDomain(inner)
    } catch { /* fall through to the redirect's own (wrong) domain */ }
  }
  return extractDomain(url)
}

function checkCited(
  citations: Array<{ url: string; title: string; domain: string; isExplicitCitation: boolean }>,
  _communityName: string
): boolean {
  // Only sources explicitly cited in the answer text count toward "Cited" —
  // sources merely surfaced by a search step don't move this stat.
  return citations.some(
    (c) =>
      c.isExplicitCitation &&
      (c.url.toLowerCase().includes('seniorlifestyle.com') ||
        c.domain.toLowerCase().includes('seniorlifestyle.com'))
  )
}

async function queryChatGPT(
  promptText: string,
  communityName: string
): Promise<PlatformResult> {
  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (client as any).responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' }],
    // Without this, the web_search_call output item never carries its own
    // source list — only inline url_citation annotations come through, which
    // is just the subset of retrieved pages the model happened to quote from.
    include: ['web_search_call.action.sources'],
    input: promptText || ' ',
  })

  const text: string = response.output_text ?? ''

  // Inline citations: the specific sources the model quoted/referenced in its answer text.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annotations: any[] = (response.output ?? []).flatMap((item: any) =>
    item.type === 'message'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (item.content ?? []).flatMap((c: any) =>
          c.type === 'output_text' ? (c.annotations ?? []) : []
        )
      : []
  )
  // Retrieved sources: every page the web_search tool call actually matched,
  // whether or not the model went on to quote it inline. Real data the search
  // already returned — just not requested/read before now.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchedSources: any[] = (response.output ?? []).flatMap((item: any) =>
    item.type === 'web_search_call' ? (item.action?.sources ?? []) : []
  )

  const citationMap = new Map<string, PlatformCitation>()
  for (const a of annotations) {
    const url: string = a.url ?? ''
    if (a.type === 'url_citation' && url) {
      citationMap.set(url, { url, title: a.title ?? '', domain: extractDomain(url), isExplicitCitation: true })
    }
  }
  for (const s of searchedSources) {
    const url: string = s.url ?? ''
    if (url && !citationMap.has(url)) {
      citationMap.set(url, { url, title: '', domain: extractDomain(url), isExplicitCitation: false })
    }
  }
  const citations = [...citationMap.values()]

  const isMentioned = checkMention(text, communityName)
  const isCited = checkCited(citations, communityName)
  const sentiment = await analyzeSentiment(text, communityName)

  return { responseText: text, isMentioned, isCited, sentiment, citations }
}

async function queryClaude(
  promptText: string,
  communityName: string
): Promise<PlatformResult> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let response: any = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
    messages: [{ role: 'user', content: promptText }],
  })

  // If Claude returned stop_reason=tool_use, the web_search tool requires us to
  // execute the search and send results back in a follow-up turn.
  if (response.stop_reason === 'tool_use') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUseBlock = response.content.find((b: any) => b.type === 'tool_use' && b.name === 'web_search')
    const query: string = toolUseBlock?.input?.query ?? promptText.slice(0, 120)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let searchResults: any[] = []
    try {
      const searchRes = await fetch(
        `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(query)}&api_key=${process.env.SEARCHAPI_KEY}`,
        { signal: AbortSignal.timeout(15_000) }
      )
      if (searchRes.ok) {
        const d = await searchRes.json()
        searchResults = (d.organic_results ?? []).slice(0, 5).map((r: Record<string, string>) => ({
          url: r.link ?? '',
          title: r.title ?? '',
          snippet: r.snippet ?? '',
        }))
      }
    } catch { /* ignore */ }

    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
      messages: [
        { role: 'user', content: promptText },
        { role: 'assistant', content: response.content },
        {
          role: 'user',
          content: [{
            type: 'tool_result' as const,
            tool_use_id: toolUseBlock?.id ?? '',
            content: JSON.stringify(searchResults),
          }],
        },
      ],
    })
  }

  let text = ''
  const citationMap = new Map<string, PlatformCitation>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const block of response.content as any[]) {
    if (block.type === 'text') {
      text += block.text
      // Inline citations on text blocks (beta SDK web_search_result_location format) —
      // these are sources Claude explicitly quoted/referenced in its answer.
      if (Array.isArray(block.citations)) {
        for (const c of block.citations) {
          const url: string = c.url ?? ''
          if (url) {
            citationMap.set(url, { url, title: c.title ?? '', domain: extractDomain(url), isExplicitCitation: true })
          }
        }
      }
    }
    // Top-level web_search_result blocks — sources the tool retrieved, not
    // necessarily quoted inline. Don't downgrade a URL already marked explicit.
    if (block.type === 'web_search_result') {
      const url: string = block.url ?? ''
      if (url && !citationMap.has(url)) {
        citationMap.set(url, { url, title: block.title ?? '', domain: extractDomain(url), isExplicitCitation: false })
      }
    }
    // web_search_tool_result — the actual block type returned by web_search_20250305
    if (block.type === 'web_search_tool_result' || block.type === 'tool_result' || block.type === 'server_tool_result') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any[] = Array.isArray(block.content) ? block.content : []
      for (const item of content) {
        const url: string = item.url ?? ''
        if (url && !citationMap.has(url)) {
          citationMap.set(url, { url, title: item.title ?? '', domain: extractDomain(url), isExplicitCitation: false })
        }
      }
    }
  }
  const citations = [...citationMap.values()]

  const isMentioned = checkMention(text, communityName)
  const isCited = checkCited(citations, communityName)
  const sentiment = await analyzeSentiment(text, communityName)

  return { responseText: text, isMentioned, isCited, sentiment, citations }
}

async function queryGemini(
  promptText: string,
  communityName: string
): Promise<PlatformResult> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} } as never],
  })

  const result = await model.generateContent(promptText)
  const text = result.response.text()

  // Extract citations from Google Search grounding metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groundingMeta: any =
    result.response.candidates?.[0]?.groundingMetadata ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks: any[] = groundingMeta.groundingChunks ?? []
  const citations = await Promise.all(
    chunks
      .filter((c) => c.web?.uri)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map(async (c: any) => {
        const url = await resolveRedirect(c.web.uri as string)
        // groundingChunks are the sources Google Search grounding says actually
        // support the generated answer, so they count as explicit citations.
        return { url, title: (c.web.title as string) ?? '', domain: extractDomain(url), isExplicitCitation: true }
      })
  )

  const isMentioned = checkMention(text, communityName)
  const isCited = checkCited(citations, communityName)
  const sentiment = await analyzeSentiment(text, communityName)

  return { responseText: text, isMentioned, isCited, sentiment, citations }
}

// AI Overview text_blocks (and their nested `items`, where present) each carry a
// reference_indexes array pointing into reference_links[].index — the set of
// sources actually referenced somewhere in the overview's visible text. A
// reference_links entry whose index never appears in any block was returned by
// Google's AI Overview source list but never actually cited in the text.
function collectReferencedIndexes(blocks: unknown[]): Set<number> {
  const indexes = new Set<number>()
  const visit = (nodes: unknown[]) => {
    for (const node of nodes as Array<Record<string, unknown>>) {
      if (Array.isArray(node.reference_indexes)) {
        for (const i of node.reference_indexes as number[]) indexes.add(i)
      }
      if (Array.isArray(node.items)) visit(node.items)
    }
  }
  visit(blocks)
  return indexes
}

function extractCitationsFromSources(sources: unknown[]): PlatformCitation[] {
  return (sources as Array<Record<string, string>>)
    .map((s) => {
      const url = s.link ?? s.url ?? ''
      return {
        url,
        title: s.title ?? s.name ?? '',
        domain: resolveCitationDomain(url, s.favicon),
        isExplicitCitation: true,
      }
    })
    .filter((c) => c.url)
}

// Repairs google_aio Result.responseText rows saved before the markdown-link
// cleanup fix above. The old regex (/\[\d+\]/g) stripped only the bracket-number
// part of citation markers like "[1](https://...)", leaving the "(https://...)"
// half stuck in the visible text — and since it matched "[N]" anywhere, it also
// ate the inner "[0]" out of the trailing "[[0] - Title](url)" bibliography
// SearchAPI appends, leaving corrupted lines like "[ - Title](url)". Every
// parenthetical URL in an AI-Overview response is one of these leftovers (this
// text is machine-generated by Google, never free-form authored prose with
// intentional inline links), so it's safe to strip unconditionally here.
export function cleanLegacyAIOResponseText(text: string): string {
  return text
    // Must run before the general URL stripper below — it needs the line's
    // trailing "(url)" still attached to match the whole corrupted line.
    .replace(/^\[\s*-\s*[^\]]*\]\([^)]*\)\s*$/gm, '')
    .replace(/\s*\(https?:\/\/[^\s)]+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseSearchAPIResponse(data: any, communityName: string, engine?: string): Promise<PlatformResult> {
  let text = ''
  let citations: PlatformCitation[] = []

  // engine=google_ai_overview with page_token returns root-level markdown/text_blocks/reference_links
  if (!text && typeof data.markdown === 'string' && data.markdown.length > 0) {
    // Citation markers in this markdown are full links like " [1](https://...)",
    // not bare "[1]" — stripping only the bracket part (the old regex) left the
    // "(https://...)" half sitting in the visible text as a stray raw URL.
    // SearchAPI also appends a full "[[0] - Title](url)" bibliography after the
    // content, duplicating what the separate Citations list already shows.
    text = data.markdown
      .replace(/\s*\[\d+\]\([^)]*\)/g, '')
      .replace(/^\[\[\d+\][^\]]*\]\([^)]*\)\s*$/gm, '')
      .trim()
  }
  if (!text && Array.isArray(data.text_blocks) && data.text_blocks.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    text = (data.text_blocks as Array<any>)
      .map((b) => (b.snippet ?? b.text ?? b.content ?? '').replace(/\s*\[\d+\]\([^)]*\)/g, ''))
      .filter(Boolean)
      .join('\n\n')
      .trim()
  }
  if (text && !citations.length) {
    // reference_links[].link is the canonical citation URL per SearchAPI's google_ai_overview response
    const refs: unknown[] = data.reference_links ?? []
    // If text_blocks carry reference_indexes, use them to tell sources actually
    // cited in the overview text apart from ones only listed in the source panel.
    // If no block declares any indexes (older/simpler response shapes), fall back
    // to treating every reference link as explicit, same as before this split.
    const referencedIndexes = Array.isArray(data.text_blocks)
      ? collectReferencedIndexes(data.text_blocks)
      : new Set<number>()
    citations = (refs as Array<Record<string, unknown>>)
      .map((r, i) => {
        const url = (r.link as string) ?? (r.url as string) ?? ''
        const refIndex = typeof r.index === 'number' ? r.index : i
        return {
          url,
          title: (r.title as string) ?? (r.name as string) ?? '',
          domain: resolveCitationDomain(url, r.favicon as string | undefined),
          isExplicitCitation: referencedIndexes.size === 0 || referencedIndexes.has(refIndex),
        }
      })
      .filter((c) => c.url)
  }

  // engine=google / engine=google_ai_overview: nested ai_overview object
  if (!text && data.ai_overview) {
    const aio = data.ai_overview
    text = aio.answer ?? aio.text ?? aio.snippet ?? ''
    citations = extractCitationsFromSources(aio.sources ?? aio.references ?? aio.links ?? [])
  }

  if (!text && data.answer) {
    text = data.answer
    const refs: unknown[] = data.citations ?? data.references ?? data.sources ?? []
    citations = (refs as Array<Record<string, string>>)
      .map((r) => {
        const url = r.url ?? r.link ?? ''
        return {
          url,
          title: r.title ?? r.name ?? '',
          domain: resolveCitationDomain(url, r.favicon),
          isExplicitCitation: true,
        }
      })
      .filter((c) => c.url)
  }

  if (!text && data.answer_box) {
    const box = data.answer_box
    text = box.answer ?? box.snippet ?? box.result ?? ''
    const sources: unknown[] = box.sources ?? box.links ?? []
    citations = (sources as Array<Record<string, string>>)
      .map((s) => {
        const url = s.link ?? s.url ?? ''
        return {
          url,
          title: s.title ?? '',
          domain: resolveCitationDomain(url, s.favicon),
          isExplicitCitation: true,
        }
      })
      .filter((c) => c.url)
  }

  // No AI Overview (or answer/answer_box) was served — mark explicitly rather
  // than falling back to organic snippets which would be misleading as AIO data.
  if (!text) {
    return { responseText: '[No AI Overview]', isMentioned: false, isCited: false, sentiment: 'neutral', citations: [] }
  }

  const isMentioned = checkMention(text, communityName)
  const isCited = checkCited(citations, communityName)
  const sentiment = await analyzeSentiment(text, communityName)

  return { responseText: text, isMentioned, isCited, sentiment, citations }
}

async function queryPerplexity(
  promptText: string,
  communityName: string
): Promise<PlatformResult> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: promptText }],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Perplexity ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content ?? ''

  // `citations` is the plain URL list corresponding to the model's [N] inline
  // references — the explicitly-cited set. `search_results` is Perplexity's
  // fuller, verified source list (title/url/date): every page the search step
  // actually pulled, whether or not the model went on to number-reference it.
  const rawCitedUrls = ((data.citations ?? []) as unknown[])
    .filter((url): url is string => typeof url === 'string' && url.startsWith('http'))
  const searchResults = (data.search_results ?? []) as Array<Record<string, string>>
  const searchResultByUrl = new Map(searchResults.map((r) => [r.url ?? '', r]))

  const citations: PlatformCitation[] = []
  const seenUrls = new Set<string>()
  for (const url of rawCitedUrls) {
    if (seenUrls.has(url)) continue
    seenUrls.add(url)
    const r = searchResultByUrl.get(url)
    citations.push({ url, title: r?.title ?? extractDomain(url), domain: extractDomain(url), isExplicitCitation: true })
  }
  for (const r of searchResults) {
    const url = r.url ?? ''
    if (!url || seenUrls.has(url)) continue
    seenUrls.add(url)
    citations.push({ url, title: r.title ?? extractDomain(url), domain: extractDomain(url), isExplicitCitation: false })
  }

  const isMentioned = checkMention(text, communityName)
  const isCited = checkCited(citations, communityName)
  const sentiment = await analyzeSentiment(text, communityName)

  return { responseText: text, isMentioned, isCited, sentiment, citations }
}

async function fetchFallbackCitations(
  promptText: string
): Promise<PlatformCitation[]> {
  const apiKey = process.env.SEARCHAPI_KEY
  if (!apiKey) return []
  try {
    const url = new URL('https://www.searchapi.io/api/v1/search')
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('engine', 'google')
    url.searchParams.set('q', promptText)
    url.searchParams.set('gl', 'us')
    url.searchParams.set('num', '5')
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return []
    const data = await response.json()
    // These are organic search results we fetched ourselves as a last-resort
    // supplement, not sources the platform actually cited or retrieved — never
    // explicit, and fetchFallbackCitations only runs after isCited/isMentioned
    // are already computed, so they can't move those stats either.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.organic_results ?? []).slice(0, 5).map((r: any) => ({
      url: r.link ?? '',
      title: r.title ?? '',
      domain: extractDomain(r.link ?? ''),
      isExplicitCitation: false,
    })).filter((c: { url: string }) => c.url)
  } catch {
    return []
  }
}

async function querySearchAPI(
  engine: string,
  promptText: string,
  communityName: string
): Promise<PlatformResult> {
  const apiKey = process.env.SEARCHAPI_KEY
  const url = new URL('https://www.searchapi.io/api/v1/search')
  url.searchParams.set('api_key', apiKey!)
  url.searchParams.set('engine', engine)
  url.searchParams.set('q', promptText)
  url.searchParams.set('gl', 'us')
  url.searchParams.set('hl', 'en')

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`SearchAPI (${engine}) ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = await response.json()
  return await parseSearchAPIResponse(data, communityName, engine)
}

async function queryGoogleAIO(
  promptText: string,
  communityName: string,
  city?: string
): Promise<PlatformResult> {
  const apiKey = process.env.SEARCHAPI_KEY

  // Step 1: standard Google search — returns ai_overview + page_token when Google serves one.
  // Passing location causes Google to return geo-targeted results, which significantly
  // increases the chance of ai_overview appearing for local-service queries.
  const step1Url = new URL('https://www.searchapi.io/api/v1/search')
  step1Url.searchParams.set('api_key', apiKey!)
  step1Url.searchParams.set('engine', 'google')
  step1Url.searchParams.set('q', promptText)
  step1Url.searchParams.set('gl', 'us')
  step1Url.searchParams.set('hl', 'en')
  if (city) step1Url.searchParams.set('location', city)

  const step1Res = await fetch(step1Url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!step1Res.ok) {
    const body = await step1Res.text().catch(() => '')
    throw new Error(`SearchAPI (google) ${step1Res.status}: ${body.slice(0, 200)}`)
  }
  const step1Data = await step1Res.json()

  // If engine=google returned an ai_overview with a page_token, use the dedicated
  // google_ai_overview engine for the full expanded content
  const pageToken: string | undefined = step1Data.ai_overview?.page_token
  if (pageToken) {
    const step2Url = new URL('https://www.searchapi.io/api/v1/search')
    step2Url.searchParams.set('api_key', apiKey!)
    step2Url.searchParams.set('engine', 'google_ai_overview')
    step2Url.searchParams.set('q', promptText)
    step2Url.searchParams.set('page_token', pageToken)
    step2Url.searchParams.set('gl', 'us')
    step2Url.searchParams.set('hl', 'en')

    try {
      const step2Res = await fetch(step2Url.toString(), {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      })
      if (step2Res.ok) {
        const step2Data = await step2Res.json()
        const result = await parseSearchAPIResponse(step2Data, communityName, 'google_ai_overview')
        if (result.responseText !== '[No AI Overview]') {
          // The page_token-expanded response sometimes comes back with text but
          // an empty reference_links array, even though the compact ai_overview
          // from step 1 had its own sources for the same overview — don't
          // discard those just because we swapped to the expanded engine.
          if (result.citations.length === 0 && step1Data.ai_overview) {
            const aio = step1Data.ai_overview
            result.citations = extractCitationsFromSources(aio.sources ?? aio.references ?? aio.links ?? [])
            result.isCited = checkCited(result.citations, communityName)
          }
          return result
        }
      }
    } catch { /* fall through */ }
  }

  // If engine=google returned ai_overview but no page_token, parse it directly
  if (step1Data.ai_overview) {
    return await parseSearchAPIResponse(step1Data, communityName, 'google')
  }

  return { responseText: '[No AI Overview]', isMentioned: false, isCited: false, sentiment: 'neutral', citations: [] }
}

export async function queryPlatform(
  platform: string,
  promptText: string,
  communityName: string,
  city?: string
): Promise<PlatformResult> {
  try {
    let result: PlatformResult
    switch (platform) {
      case 'chatgpt':
        result = await queryChatGPT(promptText, communityName); break
      case 'claude':
        result = await queryClaude(promptText, communityName); break
      case 'gemini':
        result = await queryGemini(promptText, communityName); break
      case 'perplexity':
        result = await queryPerplexity(promptText, communityName); break
      case 'google_aio':
        return await queryGoogleAIO(promptText, communityName, city)
      default:
        throw new Error(`Unknown platform: ${platform}`)
    }
    // For platforms that query AI directly, fall back to organic search citations when none returned
    if (result.citations.length === 0 && !result.error) {
      result.citations = await fetchFallbackCitations(promptText)
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      responseText: `[Error] ${message}`,
      isMentioned: false,
      isCited: false,
      sentiment: 'neutral' as const,
      citations: [],
      error: message,
    }
  }
}
