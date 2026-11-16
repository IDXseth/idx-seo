// All AI platform queries go through DataForSEO (https://docs.dataforseo.com/v3/).
//   chatgpt / claude / gemini / perplexity → AI Optimization API, LLM Responses (live)
//   google_aio                             → SERP API, Google Organic live/advanced with AI Overview
// Auth: HTTP Basic with DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD.
// Sentiment scoring still calls Anthropic directly (ANTHROPIC_API_KEY).

import { UsageMeter, UsageTotals } from './usage'

const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3'

// Model requested per platform. Base names resolve to the latest version on
// DataForSEO's side; see /v3/ai_optimization/<platform>/llm_responses/models.
const LLM_MODELS: Record<string, string> = {
  chatgpt: process.env.DATAFORSEO_MODEL_CHATGPT || 'gpt-4o',
  claude: process.env.DATAFORSEO_MODEL_CLAUDE || 'claude-sonnet-4-6',
  gemini: process.env.DATAFORSEO_MODEL_GEMINI || 'gemini-2.5-flash',
  perplexity: process.env.DATAFORSEO_MODEL_PERPLEXITY || 'sonar',
}

// DataForSEO path segment for each platform
const LLM_PATHS: Record<string, string> = {
  chatgpt: 'chat_gpt',
  claude: 'claude',
  gemini: 'gemini',
  perplexity: 'perplexity',
}

const US_LOCATION_CODE = 2840
const MAX_PROMPT_CHARS = 500 // DataForSEO limit for user_prompt

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
  usage?: UsageTotals  // tokens, searches and estimated cost of producing this result
}

const SENTIMENT_MODEL = 'claude-haiku-4-5-20251001'

export async function analyzeSentiment(
  responseText: string,
  communityName: string,
  meter?: UsageMeter
): Promise<'positive' | 'neutral' | 'negative'> {
  if (!responseText || responseText.startsWith('[Error]') || responseText.startsWith('[Timeout]') || responseText.startsWith('[No AI Overview]')) {
    return 'neutral'
  }
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: SENTIMENT_MODEL,
      max_tokens: 5,
      messages: [{
        role: 'user',
        content: `How does this AI response portray "${communityName}"? Reply with exactly one word: positive, neutral, or negative.\n\n${responseText.slice(0, 1500)}`,
      }],
    })
    meter?.addTokens(SENTIMENT_MODEL, response.usage.input_tokens, response.usage.output_tokens)
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

// Adds a citation unless its URL is already present. An explicit citation
// upgrades an existing retrieved-only entry for the same URL, never the reverse.
function addCitation(map: Map<string, PlatformCitation>, c: PlatformCitation) {
  if (!c.url) return
  const existing = map.get(c.url)
  if (!existing) {
    map.set(c.url, c)
  } else if (c.isExplicitCitation && !existing.isExplicitCitation) {
    map.set(c.url, { ...existing, isExplicitCitation: true, title: existing.title || c.title })
  }
}

// Repairs google_aio Result.responseText rows saved before the markdown-link
// cleanup fix. The old regex (/\[\d+\]/g) stripped only the bracket-number
// part of citation markers like "[1](https://...)", leaving the "(https://...)"
// half stuck in the visible text — and since it matched "[N]" anywhere, it also
// ate the inner "[0]" out of the trailing "[[0] - Title](url)" bibliography
// SearchAPI appended, leaving corrupted lines like "[ - Title](url)". Every
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

// ─── DataForSEO transport ────────────────────────────────────────────────────

// POSTs one task and returns tasks[0].result[0]. Records the task's billed cost
// on the meter (tokens are added by the caller, which knows the result shape).
// Throws on HTTP, API-level or task-level errors — DataForSEO returns HTTP 200
// even when the task itself failed.
async function dataforseoPost(
  path: string,
  task: Record<string, unknown>,
  meter: UsageMeter,
  timeoutMs = 45_000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) throw new Error('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set')

  const response = await fetch(`${DATAFORSEO_BASE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([task]),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`DataForSEO ${response.status}: ${body.slice(0, 200)}`)
  }

  const data = await response.json()
  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO ${data.status_code}: ${data.status_message}`)
  }
  const t = data.tasks?.[0]
  // DataForSEO charges per task (search, model tokens and its fee included) and
  // reports the exact amount, so record it as-is rather than estimating.
  if (typeof t?.cost === 'number') meter.addReported(0, 0, 1, t.cost)
  if (!t || t.status_code !== 20000) {
    throw new Error(`DataForSEO task ${t?.status_code ?? '?'}: ${t?.status_message ?? 'no task returned'}`)
  }
  return t.result?.[0] ?? null
}

// ─── LLM platforms (ChatGPT, Claude, Gemini, Perplexity) ─────────────────────

async function queryLLM(
  platform: string,
  promptText: string,
  communityName: string,
  meter: UsageMeter
): Promise<PlatformResult> {
  const prompt = (promptText || '').trim()
  if (!prompt) throw new Error('Empty prompt')
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new Error(`Prompt is ${prompt.length} characters; DataForSEO allows at most ${MAX_PROMPT_CHARS}`)
  }

  const task: Record<string, unknown> = {
    user_prompt: prompt,
    model_name: LLM_MODELS[platform],
  }
  if (platform === 'perplexity') {
    // Sonar models always search; this endpoint has no web_search flag
    task.web_search_country_iso_code = 'US'
  } else {
    task.web_search = true
    if (platform !== 'gemini') task.web_search_country_iso_code = 'US'
  }

  const result = await dataforseoPost(`ai_optimization/${LLM_PATHS[platform]}/llm_responses/live`, task, meter)
  meter.addReported(result?.input_tokens ?? 0, result?.output_tokens ?? 0, 0, 0)

  let text = ''
  const citationMap = new Map<string, PlatformCitation>()

  // Inline annotations on the answer text: the sources the model explicitly cited.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of (result?.items ?? []) as any[]) {
    if (item?.type !== 'message') continue
    for (const section of item.sections ?? []) {
      if (section?.type === 'text' && typeof section.text === 'string') text += section.text
      for (const a of section?.annotations ?? []) {
        // Gemini gives a Vertex redirect in `url` and the real source in `direct_url`
        const url: string = await resolveRedirect(a?.direct_url || a?.url || '')
        addCitation(citationMap, { url, title: a?.title ?? '', domain: extractDomain(url), isExplicitCitation: true })
      }
    }
  }

  // search_results: every page the model's web search step pulled, whether or
  // not it went on to cite it in the answer.
  for (const r of result?.search_results ?? []) {
    const url: string = await resolveRedirect(r?.url ?? '')
    addCitation(citationMap, { url, title: r?.title ?? '', domain: extractDomain(url), isExplicitCitation: false })
  }

  const citations = [...citationMap.values()]
  const isMentioned = checkMention(text, communityName)
  const isCited = checkCited(citations, communityName)
  const sentiment = await analyzeSentiment(text, communityName, meter)

  return { responseText: text, isMentioned, isCited, sentiment, citations }
}

// ─── Google AI Overviews ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCitations(list: any[] | undefined, isExplicitCitation: boolean): PlatformCitation[] {
  return (list ?? [])
    .filter((s) => s?.url)
    .map((s) => ({
      url: s.url as string,
      title: (s.title ?? s.source ?? '') as string,
      domain: (s.domain as string) || extractDomain(s.url),
      isExplicitCitation,
    }))
}

// Strip inline citation markers like " [1](https://...)" so the stored text is
// the overview's prose, matching what the SearchAPI version stored.
function cleanAIOMarkdown(markdown: string): string {
  return markdown
    .replace(/\s*\[\d+\]\([^)]*\)/g, '')
    .replace(/^\[\[\d+\][^\]]*\]\([^)]*\)\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function googleOrganic(promptText: string, meter: UsageMeter, withAIOverview: boolean) {
  // Cities are stored as bare names ("Phoenix"), which DataForSEO's location_name
  // won't accept (it needs "Phoenix,Arizona,United States"), so target the US.
  return dataforseoPost('serp/google/organic/live/advanced', {
    keyword: promptText,
    location_code: US_LOCATION_CODE,
    language_code: 'en',
    device: 'desktop',
    depth: 10,
    load_async_ai_overview: withAIOverview,
  }, meter)
}

async function queryGoogleAIO(
  promptText: string,
  communityName: string,
  meter: UsageMeter
): Promise<PlatformResult> {
  const result = await googleOrganic(promptText, meter, true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aio = ((result?.items ?? []) as any[]).find((i) => i?.type === 'ai_overview')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements: any[] = aio?.items ?? []
  const text = aio
    ? cleanAIOMarkdown(
        aio.markdown ||
        elements.map((e) => e?.markdown || e?.text || '').filter(Boolean).join('\n\n')
      )
    : ''

  // No AI Overview was served — mark explicitly rather than falling back to
  // organic snippets, which would be misleading as AIO data.
  if (!text) {
    return { responseText: '[No AI Overview]', isMentioned: false, isCited: false, sentiment: 'neutral', citations: [] }
  }

  // Sources linked from a section of the overview's text count as explicit.
  // The overview's top-level references list is its source panel: explicit only
  // when no section declares its own links (older/simpler response shapes).
  const sectionCitations = elements.flatMap((e) => [
    ...toCitations(e?.links, true),
    ...toCitations(e?.references, true),
  ])
  const citationMap = new Map<string, PlatformCitation>()
  for (const c of sectionCitations) addCitation(citationMap, c)
  for (const c of toCitations(aio.references, sectionCitations.length === 0)) addCitation(citationMap, c)
  const citations = [...citationMap.values()]

  const isMentioned = checkMention(text, communityName)
  const isCited = checkCited(citations, communityName)
  const sentiment = await analyzeSentiment(text, communityName, meter)

  return { responseText: text, isMentioned, isCited, sentiment, citations }
}

async function fetchFallbackCitations(
  promptText: string,
  meter: UsageMeter
): Promise<PlatformCitation[]> {
  try {
    const result = await googleOrganic(promptText, meter, false)
    // These are organic search results we fetched ourselves as a last-resort
    // supplement, not sources the platform actually cited or retrieved — never
    // explicit, and fetchFallbackCitations only runs after isCited/isMentioned
    // are already computed, so they can't move those stats either.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organic = ((result?.items ?? []) as any[]).filter((i) => i?.type === 'organic')
    return toCitations(organic.slice(0, 5), false)
  } catch {
    return []
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function queryPlatform(
  platform: string,
  promptText: string,
  communityName: string,
  // Kept for callers' compatibility; not used for targeting (see googleOrganic).
  _city?: string
): Promise<PlatformResult> {
  // Collects usage from every call made for this result, including calls that
  // finished before an error, so failed queries still show what they cost.
  const meter = new UsageMeter()
  try {
    if (platform === 'google_aio') {
      return { ...(await queryGoogleAIO(promptText, communityName, meter)), usage: meter.totals }
    }
    if (!LLM_PATHS[platform]) {
      throw new Error(`Unknown platform: ${platform}`)
    }
    const result = await queryLLM(platform, promptText, communityName, meter)
    // For platforms that query AI directly, fall back to organic search citations when none returned
    if (result.citations.length === 0 && !result.error) {
      result.citations = await fetchFallbackCitations(promptText, meter)
    }
    return { ...result, usage: meter.totals }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      responseText: `[Error] ${message}`,
      isMentioned: false,
      isCited: false,
      sentiment: 'neutral' as const,
      citations: [],
      error: message,
      usage: meter.totals,
    }
  }
}
