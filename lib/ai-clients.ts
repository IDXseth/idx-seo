async function resolveRedirect(url: string): Promise<string> {
  if (!url.includes('vertexaisearch.cloud.google.com')) return url
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) })
    return res.url || url
  } catch {
    return url
  }
}

export interface PlatformResult {
  responseText: string
  isMentioned: boolean
  isCited: boolean
  sentiment: 'positive' | 'neutral' | 'negative'
  citations: Array<{ url: string; title: string; domain: string }>
  error?: string
}

async function analyzeSentiment(
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

function checkCited(
  citations: Array<{ url: string; title: string; domain: string }>,
  _communityName: string
): boolean {
  return citations.some(
    (c) =>
      c.url.toLowerCase().includes('seniorlifestyle.com') ||
      c.domain.toLowerCase().includes('seniorlifestyle.com')
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
    input: promptText || ' ',
  })

  const text: string = response.output_text ?? ''

  // Extract URL citations from output annotations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annotations: any[] = (response.output ?? []).flatMap((item: any) =>
    item.type === 'message'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (item.content ?? []).flatMap((c: any) =>
          c.type === 'output_text' ? (c.annotations ?? []) : []
        )
      : []
  )
  const citations = annotations
    .filter((a) => a.type === 'url_citation')
    .map((a) => ({
      url: a.url ?? '',
      title: a.title ?? '',
      domain: extractDomain(a.url ?? ''),
    }))
    .filter((c) => c.url)

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
  const citations: Array<{ url: string; title: string; domain: string }> = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const block of response.content as any[]) {
    if (block.type === 'text') {
      text += block.text
    }
    // Top-level web_search_result blocks (Anthropic server-tool response format)
    if (block.type === 'web_search_result' || block.type === 'web_search_result_block') {
      const url: string = block.url ?? ''
      if (url) citations.push({ url, title: block.title ?? '', domain: extractDomain(url) })
    }
    // tool_result or server_tool_result wrapping search items
    if (block.type === 'tool_result' || block.type === 'server_tool_result') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any[] = Array.isArray(block.content) ? block.content : []
      for (const item of content) {
        const url: string = item.url ?? ''
        if (url) citations.push({ url, title: item.title ?? '', domain: extractDomain(url) })
      }
    }
    // tool_use with results embedded in input (some response shapes)
    if (block.type === 'tool_use' && block.name === 'web_search') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = Array.isArray(block.input?.results) ? block.input.results : []
      for (const r of results) {
        const url: string = r.url ?? ''
        if (url) citations.push({ url, title: r.title ?? '', domain: extractDomain(url) })
      }
    }
  }

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
        return { url, title: (c.web.title as string) ?? '', domain: extractDomain(url) }
      })
  )

  const isMentioned = checkMention(text, communityName)
  const isCited = checkCited(citations, communityName)
  const sentiment = await analyzeSentiment(text, communityName)

  return { responseText: text, isMentioned, isCited, sentiment, citations }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function parseSearchAPIResponse(data: any, communityName: string, engine?: string): Promise<PlatformResult> {
  let text = ''
  let citations: Array<{ url: string; title: string; domain: string }> = []

  // google_ai_mode response shape
  if (!text && data.ai_mode) {
    const aim = data.ai_mode
    text = aim.answer ?? aim.text ?? aim.markdown ?? ''
    const refs: unknown[] = aim.references ?? aim.sources ?? aim.reference_links ?? []
    citations = (refs as Array<Record<string, string>>)
      .map((r) => ({
        url: r.link ?? r.url ?? '',
        title: r.title ?? r.name ?? '',
        domain: extractDomain(r.link ?? r.url ?? ''),
      }))
      .filter((c) => c.url)
  }

  // AI Overviews response shape
  if (!text && data.ai_overview) {
    const aio = data.ai_overview
    text = aio.answer ?? aio.text ?? aio.snippet ?? ''
    const sources: unknown[] = aio.sources ?? aio.references ?? aio.links ?? []
    citations = (sources as Array<Record<string, string>>)
      .map((s) => ({
        url: s.link ?? s.url ?? '',
        title: s.title ?? s.name ?? '',
        domain: extractDomain(s.link ?? s.url ?? ''),
      }))
      .filter((c) => c.url)
  }

  if (!text && data.answer) {
    text = data.answer
    const refs: unknown[] = data.citations ?? data.references ?? data.sources ?? []
    citations = (refs as Array<Record<string, string>>)
      .map((r) => ({
        url: r.url ?? r.link ?? '',
        title: r.title ?? r.name ?? '',
        domain: extractDomain(r.url ?? r.link ?? ''),
      }))
      .filter((c) => c.url)
  }

  if (!text && data.answer_box) {
    const box = data.answer_box
    text = box.answer ?? box.snippet ?? box.result ?? ''
    const sources: unknown[] = box.sources ?? box.links ?? []
    citations = (sources as Array<Record<string, string>>)
      .map((s) => ({
        url: s.link ?? s.url ?? '',
        title: s.title ?? '',
        domain: extractDomain(s.link ?? s.url ?? ''),
      }))
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
  const rawCitations: unknown[] = data.citations ?? []
  const citations = (rawCitations as string[])
    .filter((url) => typeof url === 'string' && url.startsWith('http'))
    .map((url) => ({ url, title: extractDomain(url), domain: extractDomain(url) }))

  const isMentioned = checkMention(text, communityName)
  const isCited = checkCited(citations, communityName)
  const sentiment = await analyzeSentiment(text, communityName)

  return { responseText: text, isMentioned, isCited, sentiment, citations }
}

async function fetchFallbackCitations(
  promptText: string
): Promise<Array<{ url: string; title: string; domain: string }>> {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.organic_results ?? []).slice(0, 5).map((r: any) => ({
      url: r.link ?? '',
      title: r.title ?? '',
      domain: extractDomain(r.link ?? ''),
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

export async function queryPlatform(
  platform: string,
  promptText: string,
  communityName: string
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
        return await querySearchAPI('google_ai_mode', promptText, communityName)
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
