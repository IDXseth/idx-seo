export interface PlatformResult {
  responseText: string
  isMentioned: boolean
  isCited: boolean
  citations: Array<{ url: string; title: string; domain: string }>
  error?: string
}

function checkMention(text: string, communityName: string): boolean {
  if (!text || !communityName) return false
  return text.toLowerCase().includes(communityName.toLowerCase())
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
  communityName: string
): boolean {
  const name = communityName.toLowerCase()
  return citations.some(
    (c) =>
      c.url.toLowerCase().includes(name.replace(/\s+/g, '')) ||
      c.title.toLowerCase().includes(name)
  )
}

async function queryChatGPT(
  promptText: string,
  communityName: string
): Promise<PlatformResult> {
  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: promptText }],
    max_tokens: 800,
  })

  const text = response.choices[0]?.message?.content ?? ''
  const isMentioned = checkMention(text, communityName)

  return { responseText: text, isMentioned, isCited: false, citations: [] }
}

async function queryClaude(
  promptText: string,
  communityName: string
): Promise<PlatformResult> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    messages: [{ role: 'user', content: promptText }],
  })

  const block = response.content[0]
  const text = block?.type === 'text' ? block.text : ''
  const isMentioned = checkMention(text, communityName)

  return { responseText: text, isMentioned, isCited: false, citations: [] }
}

async function queryGemini(
  promptText: string,
  communityName: string
): Promise<PlatformResult> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const result = await model.generateContent(promptText)
  const text = result.response.text()
  const isMentioned = checkMention(text, communityName)

  return { responseText: text, isMentioned, isCited: false, citations: [] }
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
        return await querySearchAPI('perplexity', promptText, communityName)
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
