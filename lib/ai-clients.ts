export interface PlatformResult {
  responseText: string
  isMentioned: boolean
  isCited: boolean
  citations: Array<{ url: string; title: string; domain: string }>
  error?: string
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

async function resolveRedirect(url: string): Promise<string> {
  if (!url.includes('vertexaisearch.cloud.google.com')) return url
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) })
    return res.url || url
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
    input: promptText,
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
  const isCited = isMentioned && checkCited(citations, communityName)

  return { responseText: text, isMentioned, isCited, citations }
}

async function queryClaude(
  promptText: string,
  communityName: string
): Promise<PlatformResult> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
    messages: [{ role: 'user', content: promptText }],
  })

  // Collect final text and citations from search result blocks
  let text = ''
  const citations: Array<{ url: string; title: string; domain: string }> = []

  for (const block of response.content) {
    if (block.type === 'text') {
      text += block.text
    } else if (block.type === 'tool_result') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any[] = Array.isArray((block as any).content) ? (block as any).content : []
      for (const item of content) {
        if (item.type === 'web_search_result') {
          const url: string = item.url ?? ''
          if (url) {
            citations.push({
              url,
              title: item.title ?? '',
              domain: extractDomain(url),
            })
          }
        }
      }
    }
  }

  // If no citations from tool results, scan tool_use result blocks (alternate shape)
  if (citations.length === 0) {
    for (const block of response.content) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = block as any
      if (b.type === 'tool_use' && b.name === 'web_search' && Array.isArray(b.input?.results)) {
        for (const r of b.input.results) {
          const url: string = r.url ?? ''
          if (url) citations.push({ url, title: r.title ?? '', domain: extractDomain(url) })
        }
      }
    }
  }

  const isMentioned = checkMention(text, communityName)
  const isCited = isMentioned && checkCited(citations, communityName)

  return { responseText: text, isMentioned, isCited, citations }
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
  const isCited = isMentioned && checkCited(citations, communityName)

  return { responseText: text, isMentioned, isCited, citations }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSearchAPIResponse(data: any, communityName: string): PlatformResult {
  let text = ''
  let citations: Array<{ url: string; title: string; domain: string }> = []

  if (data.ai_overview) {
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
  } else if (data.answer) {
    text = data.answer
    const refs: unknown[] = data.citations ?? data.references ?? data.sources ?? []
    citations = (refs as Array<Record<string, string>>)
      .map((r) => ({
        url: r.url ?? r.link ?? '',
        title: r.title ?? r.name ?? '',
        domain: extractDomain(r.url ?? r.link ?? ''),
      }))
      .filter((c) => c.url)
  } else if (data.answer_box) {
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

  if (!text && Array.isArray(data.organic_results)) {
    text = data.organic_results
      .slice(0, 3)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.snippet ?? '')
      .join(' ')
    citations = data.organic_results
      .slice(0, 5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        url: r.link ?? '',
        title: r.title ?? '',
        domain: extractDomain(r.link ?? ''),
      }))
      .filter((c: { url: string }) => c.url)
  }

  const isMentioned = checkMention(text, communityName)
  const isCited = isMentioned && checkCited(citations, communityName)

  return { responseText: text, isMentioned, isCited, citations }
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
  const isCited = isMentioned && checkCited(citations, communityName)

  return { responseText: text, isMentioned, isCited, citations }
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

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`SearchAPI (${engine}) ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = await response.json()
  return parseSearchAPIResponse(data, communityName)
}

export async function queryPlatform(
  platform: string,
  promptText: string,
  communityName: string
): Promise<PlatformResult> {
  try {
    switch (platform) {
      case 'chatgpt':
        return await queryChatGPT(promptText, communityName)
      case 'claude':
        return await queryClaude(promptText, communityName)
      case 'gemini':
        return await queryGemini(promptText, communityName)
      case 'perplexity':
        return await queryPerplexity(promptText, communityName)
      case 'google_aio':
        return await querySearchAPI('google', promptText, communityName)
      case 'google_ai_mode':
        return await querySearchAPI('google_ai_mode', promptText, communityName)
      default:
        throw new Error(`Unknown platform: ${platform}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      responseText: `[Error] ${message}`,
      isMentioned: false,
      isCited: false,
      citations: [],
      error: message,
    }
  }
}
