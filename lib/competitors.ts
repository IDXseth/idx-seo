import { prisma } from './prisma'
import { analyzeSentiment } from './ai-clients'

export interface CompetitorInput {
  id: string
  brandName: string
  domain: string
  aliases: string
}

export interface CompetitorMatchResult {
  competitorId: string
  isMentioned: boolean
  isCited: boolean
  sentiment: 'positive' | 'neutral' | 'negative'
}

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

export function domainMatches(citationDomain: string, competitorDomain: string): boolean {
  const cited = citationDomain.toLowerCase().replace(/^www\./, '')
  const known = normalizeDomain(competitorDomain)
  if (!known) return false
  return cited === known || cited.endsWith(`.${known}`)
}

export async function getActiveCompetitors(userId: string): Promise<CompetitorInput[]> {
  try {
    return await prisma.competitor.findMany({
      where: { userId, active: true },
      select: { id: true, brandName: true, domain: true, aliases: true },
    })
  } catch {
    // Competitor table not migrated yet, or DB unreachable — never let this break a prompt run.
    return []
  }
}

// Scans one AI response for every tracked competitor — alias/brand-name text match for
// mentions, domain match against citations for isCited. Mirrors checkMention/checkCited
// in ai-clients.ts, but generalized across an arbitrary competitor list.
export async function matchCompetitors(
  responseText: string,
  citations: Array<{ domain: string }>,
  competitors: CompetitorInput[]
): Promise<CompetitorMatchResult[]> {
  if (competitors.length === 0) return []
  const lower = responseText.toLowerCase()

  const matches = competitors.map((competitor) => {
    const names = [competitor.brandName, ...competitor.aliases.split(',')]
      .map((n) => n.trim())
      .filter(Boolean)
    const isMentioned = !!lower && names.some((n) => lower.includes(n.toLowerCase()))
    const isCited = citations.some((c) => domainMatches(c.domain, competitor.domain))
    return { competitor, isMentioned, isCited }
  })

  return Promise.all(
    matches.map(async ({ competitor, isMentioned, isCited }) => ({
      competitorId: competitor.id,
      isMentioned,
      isCited,
      // Skip the LLM sentiment call for competitors that weren't mentioned at all.
      sentiment: isMentioned ? await analyzeSentiment(responseText, competitor.brandName) : ('neutral' as const),
    }))
  )
}

// Saves one CompetitorMention row per tracked competitor for this result — including
// non-mentions — so downstream rate calculations have the same denominator as Result.
export async function saveCompetitorMentions(resultId: string, matches: CompetitorMatchResult[]): Promise<void> {
  if (matches.length === 0) return
  try {
    await prisma.competitorMention.createMany({
      data: matches.map((m) => ({
        resultId,
        competitorId: m.competitorId,
        isMentioned: m.isMentioned,
        isCited: m.isCited,
        sentiment: m.sentiment,
      })),
    })
  } catch {
    // CompetitorMention table not migrated yet — never let this abort saving the Result itself.
  }
}
