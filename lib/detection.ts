// Brand-agnostic mention/citation detection. Everything here works from a
// DetectionContext — the tracked brand plus its competitors — so the same code
// scores any project. The one network call is scoreSentiments(); the rest is
// pure and shared with the UI (e.g. highlighting on the results page), so what
// is highlighted always agrees with what was counted.

export type Sentiment = 'positive' | 'neutral' | 'negative'

export interface BrandTarget {
  label: string       // display name, and the subject sentiment is scored for
  names: string[]     // names/aliases matched in response text
  domains: string[]   // bare hostnames; subdomains also count as cited
}

export interface CompetitorTarget extends BrandTarget {
  id: string
}

export interface DetectionContext {
  brand: BrandTarget
  // The brand's own location/product the prompt is about (e.g. one community).
  // Naming it counts as a brand mention.
  entityName?: string
  competitors: CompetitorTarget[]
}

export interface DetectionCitation {
  url: string
  domain: string
  isExplicitCitation: boolean
}

export interface BrandMatch {
  isMentioned: boolean
  isCited: boolean
  position: number | null  // 1-based order of first mention among tracked brands
  sentiment: Sentiment
}

export interface CompetitorMatch extends BrandMatch {
  competitorId: string
}

export interface Detection {
  brand: BrandMatch
  competitors: CompetitorMatch[]
}

// ─── Names ───────────────────────────────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function cleanTerms(terms: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of terms) {
    const term = t?.trim()
    if (!term || seen.has(term.toLowerCase())) continue
    seen.add(term.toLowerCase())
    out.push(term)
  }
  return out
}

// Case-insensitive, whole-word match: "Brookdale" must not match "Brookdales"
// or "MyBrookdale". Longest terms first so the alternation prefers
// "Senior Lifestyle Corporation" over "Senior Lifestyle".
export function termsPattern(terms: string[], flags = 'iu'): RegExp | null {
  const cleaned = cleanTerms(terms).sort((a, b) => b.length - a.length)
  if (cleaned.length === 0) return null
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${cleaned.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, flags)
}

// Index of the first whole-word occurrence of any term, or -1.
export function firstMentionIndex(text: string, terms: string[]): number {
  if (!text) return -1
  const pattern = termsPattern(terms)
  if (!pattern) return -1
  const match = pattern.exec(text)
  return match ? match.index : -1
}

// Splits text into plain and matched segments using the same whole-word rule
// as detection, tagging each match with the owner of the term it matched.
export function splitMentions<T>(
  text: string,
  owners: Array<{ owner: T; terms: string[] }>
): Array<{ text: string; owner: T | null }> {
  const byTerm = new Map<string, T>()
  for (const { owner, terms } of owners) {
    for (const t of cleanTerms(terms)) if (!byTerm.has(t.toLowerCase())) byTerm.set(t.toLowerCase(), owner)
  }
  const pattern = termsPattern([...byTerm.keys()], 'giu')
  if (!text || !pattern) return [{ text, owner: null }]
  const out: Array<{ text: string; owner: T | null }> = []
  let last = 0
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), owner: null })
    out.push({ text: m[0], owner: byTerm.get(m[0].toLowerCase()) ?? null })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), owner: null })
  return out
}

// ─── Domains ─────────────────────────────────────────────────────────────────

export function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
}

// Exact host or any subdomain of it — never a look-alike ("notbrookdale.com").
export function hostMatches(host: string, domains: string[]): boolean {
  const h = normalizeDomain(host)
  if (!h) return false
  return domains.some((d) => {
    const known = normalizeDomain(d)
    return !!known && (h === known || h.endsWith(`.${known}`))
  })
}

// Hosts a citation points at: its recorded domain, the URL's own host, and any
// URL embedded in it (redirect wrappers such as google.com/goto?url=...).
function citationHosts(c: { url: string; domain: string }): string[] {
  const hosts = [c.domain]
  let decoded = c.url
  try { decoded = decodeURIComponent(c.url) } catch { /* keep raw */ }
  for (const m of decoded.matchAll(/https?:\/\/([^/?#&"'\s]+)/gi)) hosts.push(m[1])
  return hosts
}

export function citationPointsTo(c: { url: string; domain: string }, domains: string[]): boolean {
  return citationHosts(c).some((h) => hostMatches(h, domains))
}

// Only sources explicitly cited in the answer count — ones a search step merely
// retrieved don't move the "Cited" stat.
export function isCitedBy(citations: DetectionCitation[], domains: string[]): boolean {
  return citations.some((c) => c.isExplicitCitation && citationPointsTo(c, domains))
}

// ─── Detection ───────────────────────────────────────────────────────────────

// Mentions, citations and mention order for the brand and every competitor.
// Sentiment is left neutral here; fill it with scoreSentiments().
export function detect(text: string, citations: DetectionCitation[], ctx: DetectionContext): Detection {
  const brandIndex = firstMentionIndex(text, [...ctx.brand.names, ctx.entityName ?? ''])
  const competitorIndexes = ctx.competitors.map((c) => firstMentionIndex(text, c.names))

  // Rank everyone mentioned by where they first appear.
  const mentioned = [brandIndex, ...competitorIndexes].filter((i) => i >= 0).sort((a, b) => a - b)
  const positionOf = (index: number) => (index >= 0 ? mentioned.indexOf(index) + 1 : null)

  return {
    brand: {
      isMentioned: brandIndex >= 0,
      isCited: isCitedBy(citations, ctx.brand.domains),
      position: positionOf(brandIndex),
      sentiment: 'neutral',
    },
    competitors: ctx.competitors.map((c, i) => ({
      competitorId: c.id,
      isMentioned: competitorIndexes[i] >= 0,
      isCited: isCitedBy(citations, c.domains),
      position: positionOf(competitorIndexes[i]),
      sentiment: 'neutral',
    })),
  }
}

// ─── Sentiment ───────────────────────────────────────────────────────────────

const SENTIMENT_SCHEMA = {
  type: 'object',
  properties: {
    sentiments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subject: { type: 'integer' },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        },
        required: ['subject', 'sentiment'],
        additionalProperties: false,
      },
    },
  },
  required: ['sentiments'],
  additionalProperties: false,
}

// How the response portrays each subject, in one model call. Subjects the
// model skips, and any failure, come back neutral — sentiment must never fail
// a run.
export async function scoreSentiments(responseText: string, subjects: string[]): Promise<Sentiment[]> {
  const neutral = subjects.map(() => 'neutral' as const)
  if (subjects.length === 0 || !responseText || !process.env.ANTHROPIC_API_KEY) return neutral
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const list = subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      output_config: { format: { type: 'json_schema', schema: SENTIMENT_SCHEMA } },
      messages: [{
        role: 'user',
        content: `How does this AI response portray each numbered subject? Rate each one positive, neutral, or negative.\n\nSubjects:\n${list}\n\nResponse:\n${responseText.slice(0, 1500)}`,
      }],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return neutral
    const parsed = JSON.parse(block.text) as { sentiments?: Array<{ subject: number; sentiment: Sentiment }> }
    const out: Sentiment[] = [...neutral]
    for (const s of parsed.sentiments ?? []) {
      if (s.subject >= 1 && s.subject <= subjects.length) out[s.subject - 1] = s.sentiment
    }
    return out
  } catch (err) {
    // Logged, not thrown: a failed sentiment call must not fail the run, but it
    // shouldn't silently turn every sentiment neutral either.
    console.error('Sentiment scoring failed:', err)
    return neutral
  }
}

// detect() plus sentiment for whoever was mentioned. One sentiment call per
// response at most, and none when nothing tracked is mentioned — sentiment is
// only ever reported for mentioned brands.
export async function detectWithSentiment(
  text: string,
  citations: DetectionCitation[],
  ctx: DetectionContext
): Promise<Detection> {
  const detection = detect(text, citations, ctx)

  // Score the specific entity when the response names it, else the brand.
  const brandSubject =
    ctx.entityName && firstMentionIndex(text, [ctx.entityName]) >= 0 ? ctx.entityName : ctx.brand.label
  const subjects: Array<{ label: string; apply: (s: Sentiment) => void }> = []
  if (detection.brand.isMentioned) subjects.push({ label: brandSubject, apply: (s) => { detection.brand.sentiment = s } })
  detection.competitors.forEach((m, i) => {
    if (m.isMentioned) subjects.push({ label: ctx.competitors[i].label, apply: (s) => { m.sentiment = s } })
  })

  const sentiments = await scoreSentiments(text, subjects.map((s) => s.label))
  subjects.forEach((s, i) => s.apply(sentiments[i]))
  return detection
}
