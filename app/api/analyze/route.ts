import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

interface PlatformStat {
  platform: string
  mentionRate: number
  citationRate: number
  total: number
}

interface TopDomain {
  domain: string
  count: number
  percentage: number
}

interface AnalyzeRequest {
  segmentType: string
  segmentValue: string
  overview: { promptCount: number; mentionRate: number; citationRate: number }
  platformStats: PlatformStat[]
  topDomains: TopDomain[]
  samplePrompts: string[]
}

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  google_aio: 'Google AI Overviews',
  google_ai_mode: 'Google AI Mode',
}

const SEGMENT_LABELS: Record<string, string> = {
  category: 'Category',
  community: 'Community',
  careLevel: 'Level of Care',
  market: 'Market',
}

function buildPrompt(body: AnalyzeRequest): string {
  const segLabel = SEGMENT_LABELS[body.segmentType] ?? body.segmentType
  const pct = (r: number) => `${Math.round(r * 100)}%`

  const platformLines = body.platformStats
    .map((p) => `  - ${PLATFORM_LABELS[p.platform] ?? p.platform}: ${pct(p.mentionRate)} mention rate, ${pct(p.citationRate)} citation rate (${p.total} responses)`)
    .join('\n')

  const domainLines = body.topDomains
    .slice(0, 10)
    .map((d, i) => `  ${i + 1}. ${d.domain} — ${d.count} citations (${pct(d.percentage)})`)
    .join('\n')

  const promptLines = body.samplePrompts
    .slice(0, 10)
    .map((p, i) => `  ${i + 1}. "${p}"`)
    .join('\n')

  return `You are an AI visibility consultant for Senior Lifestyle Corporation, which operates senior living communities across the United States.

Analyze the following AI search visibility data for the ${segLabel} segment "${body.segmentValue}".

PERFORMANCE SUMMARY (${body.overview.promptCount} prompts tested):
- Mention Rate: ${pct(body.overview.mentionRate)} — share of AI responses that named the community or brand
- Citation Rate: ${pct(body.overview.citationRate)} — share of AI responses that included a link to seniorlifestyle.com

PERFORMANCE BY AI PLATFORM:
${platformLines}

TOP DOMAINS APPEARING IN AI CITATIONS FOR THIS SEGMENT:
${domainLines || '  (no citation data available)'}

SAMPLE PROMPTS TESTED IN THIS SEGMENT:
${promptLines}

Please provide a focused analysis with three sections:

1. WHY THESE RATES EXIST
Explain the specific factors driving the current mention and citation rates for this "${body.segmentValue}" segment. Consider search intent, competitive landscape, content availability, brand presence in AI training data, and platform-specific behavior.

2. PLATFORM INSIGHTS
Which platforms are over- or underperforming relative to the overall rates? Offer a specific explanation for each notable outlier.

3. TOP 5 RECOMMENDATIONS
Provide five concrete, prioritized actions Senior Lifestyle Corporation can take to improve AI visibility for this segment. Be specific — name the content types, page structures, or strategies most likely to move the needle.`
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: AnalyzeRequest = await req.json().catch(() => null)
  if (!body?.segmentType || !body?.segmentValue) {
    return NextResponse.json({ error: 'segmentType and segmentValue required' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = buildPrompt(body)

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
