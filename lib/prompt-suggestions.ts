import Anthropic from '@anthropic-ai/sdk'
import type { Prisma } from '@prisma/client'
import { normalizeLevelOfCare } from './normalize'
import { getTopGscQueries } from './gsc'
import { getActiveCompetitors } from './competitors'
import { categoriesFor, SENIOR_LIVING_CATEGORIES, GENERAL_CATEGORIES } from './suggestion-categories'
import type { IndustryPreset } from './segment-labels'

export { SENIOR_LIVING_CATEGORIES as SUGGESTION_CATEGORIES } from './suggestion-categories'
type SeniorLivingCategory = typeof SENIOR_LIVING_CATEGORIES[number]
type GeneralCategory = typeof GENERAL_CATEGORIES[number]

const MAX_COUNT = 60

// Must stay comfortably under the /api/suggestions route's `maxDuration` (60s).
// Without this, a slow web_search round trip can run past the platform's own
// execution ceiling — the function gets killed externally with no JS
// exception thrown, so the try/catch around this call never runs and the
// caller gets the platform's HTML crash page instead of a JSON fallback.
const CLAUDE_TIMEOUT_MS = 45_000

export interface SuggestionInput {
  // Senior living keeps its tuned wording; general projects describe the brand
  // generically and let the model read the brand's own site to learn what it offers.
  preset: IndustryPreset
  brand: { label: string; domain: string | null }
  serviceLabel: string  // what the project calls levelOfCare (e.g. "Service")
  competitorScope: Prisma.CompetitorWhereInput  // whose competitors to research
  // The GSC query cache is one brand's private search data — only ground on it for viewers allowed to see it.
  useGscQueries: boolean
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
  const allowed = categoriesFor(input.preset)
  const categories = input.categories.filter((c) => allowed.includes(c))
  const activeCategories = categories.length > 0 ? categories : [...allowed]

  const [topQueries, competitors] = await Promise.all([
    input.useGscQueries ? getTopGscQueries(40).catch(() => []) : Promise.resolve([] as string[]),
    getActiveCompetitors(input.competitorScope),
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

  const gscBlock = topQueries.length > 0
    ? `Real search queries currently driving traffic to our own site (Google Search Console, last 28 days, ranked by impressions):\n${topQueries.slice(0, 30).map((q) => `- ${q}`).join('\n')}`
    : 'No Search Console query data is available yet — skip this grounding source.'

  const prompt = input.preset === 'senior-living'
    ? seniorLivingPrompt(input, categories, count, locationLine, gscBlock, competitors)
    : generalPrompt(input, categories, count, locationLine, gscBlock, competitors)

  // The search tool may only reach competitor sites — plus, for general
  // projects, the brand's own site, which is how the model learns the industry.
  const searchDomains = [
    ...(input.preset === 'general' && input.brand.domain ? [input.brand.domain] : []),
    ...competitors.map((c) => c.domain),
  ]

  const response = await client.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: searchDomains.length > 0
        ? [{
            type: 'web_search_20250305',
            name: 'web_search',
            allowed_domains: searchDomains,
            max_uses: Math.min(6, searchDomains.length * 2 + 2),
          }]
        : undefined,
      messages: [{ role: 'user', content: prompt }],
    },
    { timeout: CLAUDE_TIMEOUT_MS }
  )

  const text = response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')

  return parseSuggestions(text, categories, count, input.preset)
}

function parseSuggestions(text: string, categories: string[], count: number, preset: IndustryPreset): PromptSuggestion[] {
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
    const levelOfCare = rawCare ? (preset === 'senior-living' ? normalizeLevelOfCare(rawCare).value : rawCare) : ''

    results.push({ category, levelOfCare, promptText })
    if (results.length >= count) break
  }

  return results
}

// ─── Deterministic fallback (no API key, or the AI call failed) ────────────

const SENIOR_LIVING_TEMPLATES: Record<SeniorLivingCategory, string[]> = {
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

// {service} must read as a noun phrase ("this service" when none is given).
const GENERAL_TEMPLATES: Record<GeneralCategory, string[]> = {
  'General Discovery': [
    'How do I choose the right provider for {service}?',
    'What should I know before paying for {service}?',
    'What questions should I ask before choosing a company for {service}?',
  ],
  'Service Specific': [
    'What is usually included with {service}?',
    'How do I know if I need {service}?',
    'What separates a great provider of {service} from an average one?',
  ],
  'Cost & Pricing': [
    'How much does {service} typically cost in {market}?',
    'Is paying more for {service} worth it?',
    'How can I save money on {service}?',
  ],
  'Location Based': [
    'Who are the best providers of {service} near {city}?',
    'Where can I find affordable {service} in {market}?',
  ],
  'Best Of': [
    'What are the top-rated companies for {service} in {market}?',
    'Which companies offering {service} have the best reviews?',
  ],
  'Competitor / Options Comparison': [
    'How do I compare companies that offer {service}?',
    'What are the alternatives to {service}?',
  ],
  'Reviews & Reputation': [
    'How can I tell if online reviews for {service} are trustworthy?',
    'What do customers complain about most with {service}?',
  ],
  'How-To & Advice': [
    'How should I prepare before getting {service}?',
    'What mistakes do people make when choosing {service}?',
  ],
}

function templateFallback(input: SuggestionInput, categories: string[], count: number): PromptSuggestion[] {
  const seniorLiving = input.preset === 'senior-living'
  const bank: Record<string, string[]> = seniorLiving ? SENIOR_LIVING_TEMPLATES : GENERAL_TEMPLATES
  const careLevel = (input.levelOfCare || 'assisted living').toLowerCase()
  const service = (input.levelOfCare || 'this service').toLowerCase()
  const fill = (s: string) =>
    s
      .replace(/\{careLevel\}/g, careLevel)
      .replace(/\{service\}/g, service)
      .replace(/\{city\}/g, input.city || 'me')
      .replace(/\{market\}/g, input.market || input.city || 'my area')

  const pool: PromptSuggestion[] = []
  for (const category of categories) {
    for (const template of bank[category] ?? []) {
      pool.push({ category, levelOfCare: input.levelOfCare || '', promptText: fill(template) })
    }
  }
  return pool.slice(0, count)
}

// ─── Prompts sent to the model ─────────────────────────────────────────────

const RESPONSE_RULES = (categories: string[], count: number) => `Hard rules:
- NEVER mention any specific company, brand, or location name (not ours, not a competitor's) inside a promptText — these are nonbrand prompts, used to see who an AI mentions unprompted.
- Each promptText must be a complete, natural first-person question, not a keyword fragment.
- Distribute the ${count} prompts as evenly as you reasonably can across these categories: ${categories.join(', ')}.`

function seniorLivingPrompt(
  input: SuggestionInput, categories: string[], count: number, locationLine: string, gscBlock: string,
  competitors: Array<{ brandName: string; domain: string }>
): string {
  const careLine = input.levelOfCare || 'any level of care'
  const competitorBlock = competitors.length > 0
    ? `Research these competitor senior living operator websites with web search (they are the ONLY sites the search tool is allowed to reach) to see what topics, FAQs, and questions they address in their own content:\n${competitors.map((c) => `- ${c.brandName} (${c.domain})`).join('\n')}`
    : 'No competitor sites have been added — generate from general knowledge of senior-living search behavior instead.'

  return `You are building a research set of prompts for an AI-visibility tracking tool used by a senior living operator. The tool sends each prompt to ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews, and checks whether specific senior living communities get mentioned or cited in the answer.

Generate exactly ${count} "nonbrand" prompts: natural-language questions a prospective resident or their adult-child caregiver would realistically type into an AI assistant while researching senior living options.

${RESPONSE_RULES(categories, count)}
- Where relevant, set levelOfCare to one of: Assisted Living, Independent Living, Memory Care, Skilled Nursing, Short Term Care — or leave it "" if the prompt is general.
- The community we're tracking is in ${locationLine || 'an unspecified market'}, primarily offering ${careLine}. Where it reads naturally, localize a portion of the prompts to that city/market (e.g. "near {city}" or "in {market}") — don't force it into every prompt.

${gscBlock}

${competitorBlock}

Ground your prompts in the ACTUAL topics/questions you find on those competitor sites and in the real search queries above, rather than inventing generic ones — but always phrase the final prompt in your own words. Never copy a sentence verbatim and never include any brand name.

Respond with ONLY a JSON array (no markdown code fences, no commentary before or after), where each item has this exact shape:
{"category": "<one of the categories above>", "levelOfCare": "<a level of care above, or empty string>", "promptText": "<the question>"}`
}

function generalPrompt(
  input: SuggestionInput, categories: string[], count: number, locationLine: string, gscBlock: string,
  competitors: Array<{ brandName: string; domain: string }>
): string {
  const brandLine = input.brand.domain ? `"${input.brand.label}" (${input.brand.domain})` : `"${input.brand.label}"`
  const serviceName = input.serviceLabel.toLowerCase()
  const researchBlock = [
    input.brand.domain
      ? `First, use web search on ${input.brand.domain} to learn what ${input.brand.label} offers and who its customers are — the prompts must be ones those customers would ask.`
      : `Infer from the brand name what kind of business ${input.brand.label} is.`,
    competitors.length > 0
      ? `Then research these competitor websites to see what topics, FAQs, and questions they address:\n${competitors.map((c) => `- ${c.brandName} (${c.domain})`).join('\n')}`
      : 'No competitor sites have been added.',
    'Web search can only reach the sites listed here.',
  ].join('\n')

  return `You are building a research set of prompts for an AI-visibility tracking tool. The tool sends each prompt to ChatGPT, Claude, Gemini, Perplexity, and Google AI Overviews, and checks whether the brand ${brandLine} or its competitors get mentioned or cited in the answer.

${researchBlock}

Generate exactly ${count} "nonbrand" prompts: natural-language questions a prospective customer would realistically type into an AI assistant while researching the kind of products or services ${input.brand.label} offers.

${RESPONSE_RULES(categories, count)}
- Where a prompt is about one specific ${serviceName}, set levelOfCare to a short name for it${input.levelOfCare ? ` (focus on: ${input.levelOfCare})` : ''}; otherwise leave it "".
${locationLine ? `- The business serves ${locationLine}. Where it reads naturally, localize a portion of the prompts to that city/market — don't force it into every prompt.` : '- No location was given — keep prompts location-neutral unless a location is essential.'}

${gscBlock}

Ground your prompts in what you actually find on those sites and in any real search queries above, rather than inventing generic ones — but always phrase the final prompt in your own words, never copy a sentence verbatim, and never include any brand name.

Respond with ONLY a JSON array (no markdown code fences, no commentary before or after), where each item has this exact shape:
{"category": "<one of the categories above>", "levelOfCare": "<a short ${serviceName} name, or empty string>", "promptText": "<the question>"}`
}
