import { prisma } from './prisma'
import { PLATFORMS, YOUR_BRAND_NAME, YOUR_BRAND_DOMAIN } from './utils'

export interface CompetitorLeaderboardEntry {
  id: string
  brandName: string
  domain: string
  isYou: boolean
  total: number
  mentioned: number
  cited: number
  mentionRate: number
  citationRate: number
  sentiment: { positive: number; neutral: number; negative: number }
  shareOfVoice: number
  platformMentionRates: Record<string, number>
}

interface RateRow {
  platform: string
  isMentioned: boolean
  isCited: boolean
  sentiment: string
}

function buildEntry(id: string, brandName: string, domain: string, isYou: boolean, rows: RateRow[]): CompetitorLeaderboardEntry {
  const total = rows.length
  const mentionedRows = rows.filter((r) => r.isMentioned)
  const mentioned = mentionedRows.length
  const cited = rows.filter((r) => r.isCited).length
  const positive = mentionedRows.filter((r) => r.sentiment === 'positive').length
  const negative = mentionedRows.filter((r) => r.sentiment === 'negative').length
  const neutral = mentioned - positive - negative

  const platformMentionRates: Record<string, number> = {}
  for (const platform of PLATFORMS) {
    const platformRows = rows.filter((r) => r.platform === platform)
    platformMentionRates[platform] = platformRows.length > 0
      ? platformRows.filter((r) => r.isMentioned).length / platformRows.length
      : 0
  }

  return {
    id,
    brandName,
    domain,
    isYou,
    total,
    mentioned,
    cited,
    mentionRate: total > 0 ? mentioned / total : 0,
    citationRate: total > 0 ? cited / total : 0,
    sentiment: {
      positive: mentioned > 0 ? positive / mentioned : 0,
      neutral: mentioned > 0 ? neutral / mentioned : 0,
      negative: mentioned > 0 ? negative / mentioned : 0,
    },
    shareOfVoice: 0, // filled in once every entry's mention count is known
    platformMentionRates,
  }
}

// Head-to-head "you vs. tracked competitors" leaderboard for an arbitrary set of prompts
// (a category, market, care level, or community's prompts, or a single prompt).
// Returns null when the viewer has no active competitors to compare against.
export async function getCompetitorLeaderboard(
  promptIds: string[],
  userId: string,
  sessionId?: string
): Promise<CompetitorLeaderboardEntry[] | null> {
  if (promptIds.length === 0) return null

  try {
    const competitors = await prisma.competitor.findMany({ where: { userId, active: true } })
    if (competitors.length === 0) return null

    const resultWhere = {
      promptId: { in: promptIds },
      ...(sessionId ? { runSessionId: sessionId } : {}),
    }

    const [brandResults, mentions] = await Promise.all([
      prisma.result.findMany({
        where: resultWhere,
        select: { platform: true, isMentioned: true, isCited: true, sentiment: true },
      }),
      prisma.competitorMention.findMany({
        where: { competitorId: { in: competitors.map((c) => c.id) }, result: resultWhere },
        select: { competitorId: true, isMentioned: true, isCited: true, sentiment: true, result: { select: { platform: true } } },
      }),
    ])

    const brandEntry = buildEntry('you', YOUR_BRAND_NAME, YOUR_BRAND_DOMAIN, true, brandResults)

    const competitorEntries = competitors.map((c) => {
      const rows: RateRow[] = mentions
        .filter((m) => m.competitorId === c.id)
        .map((m) => ({ platform: m.result.platform, isMentioned: m.isMentioned, isCited: m.isCited, sentiment: m.sentiment }))
      return buildEntry(c.id, c.brandName, c.domain, false, rows)
    })

    const all = [brandEntry, ...competitorEntries]
    const totalMentions = all.reduce((sum, e) => sum + e.mentioned, 0)
    for (const entry of all) entry.shareOfVoice = totalMentions > 0 ? entry.mentioned / totalMentions : 0

    return all.sort((a, b) => b.mentionRate - a.mentionRate)
  } catch {
    // Competitor/CompetitorMention tables not migrated yet, or DB unreachable —
    // fail soft so the rest of the report still renders.
    return null
  }
}
