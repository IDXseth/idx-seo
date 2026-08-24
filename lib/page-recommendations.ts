import type { GscData } from './gsc'

export interface PageForReview {
  url: string
  statusCode: number | null
  indexability: string | null
  indexabilityStatus: string | null
  title: string | null
  titleLength: number | null
  metaDescription: string | null
  metaDescriptionLength: number | null
  h1: string | null
  wordCount: number | null
  canonicalUrl: string | null
  inlinks: number | null
}

export interface PageRecommendationResult {
  priority: 'high' | 'medium' | 'low'
  summary: string
  issues: string[]
  recommendations: string[]
}

function buildPrompt(page: PageForReview, gsc: GscData | null): string {
  const lines = [
    `URL: ${page.url}`,
    `Status code: ${page.statusCode ?? 'unknown'}`,
    `Indexability: ${page.indexability ?? 'unknown'}${page.indexabilityStatus ? ` (${page.indexabilityStatus})` : ''}`,
    `Title (${page.titleLength ?? '?'} chars): ${page.title || '[missing]'}`,
    `Meta description (${page.metaDescriptionLength ?? '?'} chars): ${page.metaDescription || '[missing]'}`,
    `H1: ${page.h1 || '[missing]'}`,
    `Word count: ${page.wordCount ?? 'unknown'}`,
    `Canonical: ${page.canonicalUrl || '[none]'}`,
    `Internal inlinks: ${page.inlinks ?? 'unknown'}`,
  ]
  if (gsc) {
    lines.push(
      `Search Console (last 28 days): ${gsc.clicks} clicks, ${gsc.impressions} impressions, avg position ${gsc.position?.toFixed(1) ?? 'n/a'}, indexed: ${gsc.isIndexed}`
    )
  } else {
    lines.push('Search Console: no data available for this URL')
  }
  return lines.join('\n')
}

const SYSTEM_PROMPT = `You are an SEO analyst reviewing a single crawled page from a Screaming Frog export, optionally paired with Google Search Console performance data. Identify concrete, page-specific technical and on-page SEO issues (e.g. missing/duplicate/too-long titles or meta descriptions, missing H1, thin content, non-indexable pages, low internal linking, poor search performance relative to indexability). Respond with ONLY a JSON object, no markdown fences, no commentary, matching exactly this shape:
{"priority": "high" | "medium" | "low", "summary": "one sentence overview", "issues": ["short issue 1", "short issue 2"], "recommendations": ["specific action 1", "specific action 2"]}
Use "high" priority for indexability/crawl-blocking problems or pages with real search visibility being undermined by on-page issues. Use "low" when the page looks healthy. Keep issues and recommendations concise (under 20 words each), max 5 each. If the page has no notable issues, return an empty issues array and a brief positive summary.`

function parseResponse(text: string): PageRecommendationResult {
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '')
  const parsed = JSON.parse(cleaned)
  const priority = ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium'
  return {
    priority,
    summary: String(parsed.summary ?? '').slice(0, 500),
    issues: Array.isArray(parsed.issues) ? parsed.issues.map(String).slice(0, 5) : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String).slice(0, 5) : [],
  }
}

export async function generatePageRecommendation(
  page: PageForReview,
  gsc: GscData | null
): Promise<PageRecommendationResult> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(page, gsc) }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  try {
    return parseResponse(text)
  } catch {
    return {
      priority: 'medium',
      summary: 'Automated recommendation could not be parsed; review this page manually.',
      issues: [],
      recommendations: [],
    }
  }
}
