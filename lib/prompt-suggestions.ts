import Anthropic from '@anthropic-ai/sdk'
import { normalizeLevelOfCare } from './normalize'
import { getTopGscQueries } from './gsc'
import { getActiveCompetitors } from './competitors'

export const SUGGESTION_CATEGORIES = [
  'General Discovery',
  'Care Specific',
  'Cost & Financial Planning',
  'Location Based',
  'Best Of',
  'Competitor / Options Comparison',
  'Caregiver & Family Support',
  'Daily Life & Amenities',
  'Policy & Logistics',
  'Reviews & Reputation',
] as const

export type SuggestionCategory = typeof SUGGESTION_CATEGORIES[number]

const MAX_COUNT = 60

export interface SuggestionInput {
  userId: string
  communityName: string
  city: string
  market: string
  levelOfCare: string
  categories: string[]
  count: number
}

export interface PromptSuggestion {
  category: string
  levelOfCare: string
  promptText: string
}

export interface SuggestionResult {
  suggestions: PromptSuggestion[]
  groundedInGsc: boolean
  competitorDomains: string[]
  usedFallback: boolean
  note?: string
}

export async function generatePromptSuggestions(input: SuggestionInput): Promise<SuggestionResult> {
  const count = Math.max(1, Math.min(input.count || 20, MAX_COUNT))
  const categories = input.categories.filter((c) => (SUGGESTION_CATEGORIES as readonly string[]).includes(c))
  const activeCategories = categories.length > 0 ? categories : [...SUGGESTION_CATEGORIES]

  const [topQueries, competitors] = await Promise.all([
    getTopGscQueries(40).catch(() => []),
    getActiveCompetitors(input.userId),
  ])
  const competitorDomains = competitors.map((c) => c.domain)

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      suggestions: templateFallback(input, activeCategories, count),
      groundedInGsc: false,
      competitorDomains,
      usedFallback: true,
      note: 'ANTHROPIC_API_KEY is not configured — generated from local templates instead of AI research.',
    }
  }

  try {
    const suggestions = await generateWithClaude(input, activeCategories, count, topQueries, competitors)
    if (suggestions.length === 0) throw new Error('The model returned no usable suggestions')
    return {
      suggestions,
      groundedInGsc: topQueries.length > 0,
      competitorDomains,
      usedFallback: false,
    }
  } catch (err) {
    return {
      suggestions: templateFallback(input, activeCategories, count),
      groundedInGsc: false,
      competitorDomains,
      usedFallback: true,
      note: `AI generation failed, used local templates instead: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ─── AI generation, grounded in GSC queries + competitor-site research ─────

async function generateWithClaude(
  input: SuggestionInput,
  categories: string[],
  count: number,
  topQueries: string[],
  competitors: Array<{ brandName: string; domain: string }>
): Promise<PromptSuggestion[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const locationLine = [input.city, input.market].filter(Boolean).join(' / ')
  const careLine = input.levelOfCare || 'any level of care'

  const gscBlock = topQueries.length > 0
    ? `Real search queries currently driving traffic to our own site (Google Search Console, last 28 days, ranked by impressions):\n${topQueries.slice(0, 30).map((q) => `- ${q}`).join('\n')}`
    : 'No Search Console query data is available yet — skip this grounding source.'

  const competitorBlock = competitors.length > 0
    ? `Research these competitor senior living operator websites with web search (they are the ONLY sites the search tool is allowed to reach) to see what topics, FAQs, and questions they address in their own content:\n${competitors.map((c) => `- ${c.brandName} (${c.domain})`).join('\n')}`
    : 'No competitor sites have been added — generate from general knowledge of senior-living search behavior instead.'

  const prompt = `You are building a research set of prompts for an AI-visibility tracking tool used by a senior living operator. The tool sends each prompt to ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews, and checks whether specific senior living communities get mentioned or cited in the answer.

Generate exactly ${count} "nonbrand" prompts: natural-language questions a prospective resident or their adult-child caregiver would realistically type into an AI assistant while researching senior living options.

Hard rules:
- NEVER mention any specific company, brand, or community name (not ours, not a competitor's) inside a promptText — these are nonbrand prompts, used to see who an AI mentions unprompted.
- Each promptText must be a complete, natural first-person question, not a keyword fragment.
- Distribute the ${count} prompts as evenly as you reasonably can across these categories: ${categories.join(', ')}.
- Where relevant, set levelOfCare to one of: Assisted Living, Independent Living, Memory Care, Skilled Nursing, Short Term Care — or leave it "" if the prompt is general.
- The community we're tracking is in ${locationLine || 'an unspecified market'}, primarily offering ${careLine}. Where it reads naturally, localize a portion of the prompts to that city/market (e.g. "near {city}" or "in {market}") — don't force it into every prompt.

${gscBlock}

${competitorBlock}

Ground your prompts in the ACTUAL topics/questions you find on those competitor sites and in the real search queries above, rather than inventing generic ones — but always phrase the final prompt in your own words. Never copy a sentence verbatim and never include any brand name.

Respond with ONLY a JSON array (no markdown code fences, no commentary before or after), where each item has this exact shape:
{"category": "<one of the categories above>", "levelOfCare": "<a level of care above, or empty string>", "promptText": "<the question>"}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: competitors.length > 0
      ? [{
          type: 'web_search_20250305',
          name: 'web_search',
          allowed_domains: competitors.map((c) => c.domain),
          max_uses: Math.min(10, competitors.length * 2 + 2),
        }]
      : undefined,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')

  return parseSuggestions(text, categories, count)
}

function parseSuggestions(text: string, categories: string[], count: number): PromptSuggestion[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  let raw: unknown
  try {
    raw = JSON.parse(jsonMatch[0])
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []

  const categorySet = new Set(categories)
  const seen = new Set<string>()
  const results: PromptSuggestion[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>

    const promptText = typeof obj.promptText === 'string' ? obj.promptText.trim() : ''
    if (!promptText || seen.has(promptText.toLowerCase())) continue
    seen.add(promptText.toLowerCase())

    const rawCategory = typeof obj.category === 'string' ? obj.category.trim() : ''
    const category = categorySet.has(rawCategory) ? rawCategory : (categories[0] ?? 'General Discovery')

    const rawCare = typeof obj.levelOfCare === 'string' ? obj.levelOfCare.trim() : ''
    const levelOfCare = rawCare ? normalizeLevelOfCare(rawCare).value : ''

    results.push({ category, levelOfCare, promptText })
    if (results.length >= count) break
  }

  return results
}

// ─── Deterministic fallback (no API key, or the AI call failed) ────────────

const TEMPLATE_BANK: Record<SuggestionCategory, string[]> = {
  'General Discovery': [
    'What is senior living and how is it different from a nursing home?',
    "What's the difference between independent living, assisted living, and memory care?",
    "How do I know when it's time to move a parent into assisted living?",
    'What questions should I ask when touring a senior living community?',
    'What is the average age people move into a senior living community?',
  ],
  'Care Specific': [
    'What services and support are typically included in {careLevel}?',
    'What are signs someone needs {careLevel} instead of living independently?',
    'What should I look for in a good {careLevel} program?',
  ],
  'Cost & Financial Planning': [
    'How much does {careLevel} typically cost per month in {market}?',
    'Does Medicare pay for {careLevel}?',
    'Will long-term care insurance cover the cost of senior living?',
    "How do I pay for senior living if my parent's savings run out?",
  ],
  'Location Based': [
    'What are the best {careLevel} communities near {city}?',
    'Are there pet-friendly senior living communities in {city}?',
    'What senior living options are available in {market} for a limited budget?',
  ],
  'Best Of': [
    'What are the highest-rated senior living communities in {market}?',
    'Which senior living communities have the best dining programs?',
    'What are the top continuing care retirement communities (CCRCs) in {market}?',
  ],
  'Competitor / Options Comparison': [
    "What's the difference between a CCRC and a standalone assisted living community?",
    'Should I choose in-home care or a senior living community for my parent?',
    'How do I compare senior living communities after touring several of them?',
  ],
  'Caregiver & Family Support': [
    'How do I talk to my parent about moving into senior living?',
    'What is caregiver burnout and how do I know if I am experiencing it?',
    'How do I know if my parent is no longer safe living alone?',
  ],
  'Daily Life & Amenities': [
    'What does a typical day look like in a {careLevel} community?',
    'Can couples live together in senior living if they need different levels of care?',
    'What kind of activities and wellness programs do senior living communities offer?',
  ],
  'Policy & Logistics': [
    'What is the minimum age to move into an independent living community?',
    'What happens if my care needs increase after I move into assisted living?',
    "What's the typical process and timeline for moving into a senior living community?",
  ],
  'Reviews & Reputation': [
    'How do I read and evaluate online reviews for a senior living community?',
    "What should I ask current residents' families about a community before moving in?",
  ],
}

function templateFallback(input: SuggestionInput, categories: string[], count: number): PromptSuggestion[] {
  const careLevel = (input.levelOfCare || 'assisted living').toLowerCase()
  const fill = (s: string) =>
    s
      .replace(/\{careLevel\}/g, careLevel)
      .replace(/\{city\}/g, input.city || 'your area')
      .replace(/\{market\}/g, input.market || input.city || 'your area')

  const pool: PromptSuggestion[] = []
  for (const category of categories) {
    const templates = TEMPLATE_BANK[category as SuggestionCategory] ?? []
    for (const template of templates) {
      pool.push({ category, levelOfCare: input.levelOfCare || '', promptText: fill(template) })
    }
  }
  return pool.slice(0, count)
}
