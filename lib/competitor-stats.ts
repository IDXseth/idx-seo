import { prisma } from './prisma'
import { PLATFORMS, YOUR_BRAND_NAME, YOUR_BRAND_DOMAIN } from './utils'
import type { Prisma } from '@prisma/client'

// ─── Brand comparison series (all brands, one shared shape) ────────────────
// Used by both the aggregate dashboard and any segment detail page (category,
// market, care level, community) to plot every brand's mention/citation rates
// side by side. One Result query per call — Result already carries its own
// isMentioned/isCited plus its nested CompetitorMentions, so every brand's
// numbers (and the "any brand" aggregate) come from exactly the same rows.

export interface BrandSeries {
  id: string
  label: string
  overallMentionRate: number
  overallCitationRate: number
  platformStats: Array<{ platform: string; mentionRate: number; citationRate: number }>
}

export interface BrandComparison {
  brands: BrandSeries[]
  anyBrand: BrandSeries
}

export async function getBrandSeries(resultWhere: { promptId: { in: string[] }; runSessionId?: string }): Promise<BrandComparison> {
  const results = await prisma.result.findMany({
    where: resultWhere,
    select: {
      platform: true,
      isMentioned: true,
      isCited: true,
      competitorMentions: {
        select: {
          competitorId: true,
          isMentioned: true,
          isCited: true,
          competitor: { select: { brandName: true, active: true } },
        },
      },
    },
  })

  type ResultRow = (typeof results)[number]
  type Flags = { isMentioned: boolean; isCited: boolean } | null

  function buildSeries(id: string, label: string, getFlags: (r: ResultRow) => Flags): BrandSeries {
    let total = 0
    let mentioned = 0
    let cited = 0
    const byPlatform = new Map<string, { total: number; mentioned: number; cited: number }>(
      PLATFORMS.map((p) => [p, { total: 0, mentioned: 0, cited: 0 }])
    )

    for (const r of results) {
      const flags = getFlags(r)
      if (!flags) continue
      total++
      if (flags.isMentioned) mentioned++
      if (flags.isCited) cited++
      const bucket = byPlatform.get(r.platform)
      if (bucket) {
        bucket.total++
        if (flags.isMentioned) bucket.mentioned++
        if (flags.isCited) bucket.cited++
      }
    }

    return {
      id,
      label,
      overallMentionRate: total > 0 ? mentioned / total : 0,
      overallCitationRate: total > 0 ? cited / total : 0,
      platformStats: PLATFORMS.map((platform) => {
        const b = byPlatform.get(platform)!
        return {
          platform,
          mentionRate: b.total > 0 ? b.mentioned / b.total : 0,
          citationRate: b.total > 0 ? b.cited / b.total : 0,
        }
      }),
    }
  }

  const yourBrand = buildSeries('you', YOUR_BRAND_NAME, (r) => ({ isMentioned: r.isMentioned, isCited: r.isCited }))

  const competitorNames = new Map<string, string>()
  for (const r of results) {
    for (const cm of r.competitorMentions) {
      if (cm.competitor.active) competitorNames.set(cm.competitorId, cm.competitor.brandName)
    }
  }
  const competitorSeries = [...competitorNames.entries()]
    .map(([id, brandName]) =>
      buildSeries(id, brandName, (r) => {
        const cm = r.competitorMentions.find((c) => c.competitorId === id)
        return cm ? { isMentioned: cm.isMentioned, isCited: cm.isCited } : null
      })
    )
    .sort((a, b) => a.label.localeCompare(b.label))

  const anyBrand = buildSeries('any', 'Any Brand', (r) => ({
    isMentioned: r.isMentioned || r.competitorMentions.some((cm) => cm.isMentioned),
    isCited: r.isCited || r.competitorMentions.some((cm) => cm.isCited),
  }))

  return { brands: [yourBrand, ...competitorSeries], anyBrand }
}

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

// ─── Brand trend series (all brands, over time) ────────────────────────────
// Same idea as getBrandSeries, but one point per run session instead of one
// bucket per platform — for the "Mention & Citation Rate Trend" chart broken
// out by brand. Mirrors getSegmentTrendData's promptWhere shape so callers
// that already have a category/market/etc. filter can reuse it as-is.

export interface BrandTrendPoint {
  runSessionId: string
  startedAt: string
  mentionRate: number
  citationRate: number
}

export interface BrandTrendSeries {
  id: string
  label: string
  points: BrandTrendPoint[]
}

export async function getBrandTrendSeries(promptWhere: Prisma.PromptWhereInput): Promise<BrandTrendSeries[]> {
  const sessions = await prisma.runSession.findMany({
    where: { status: 'done' },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      startedAt: true,
      results: {
        where: { prompt: promptWhere },
        select: {
          isMentioned: true,
          isCited: true,
          competitorMentions: {
            select: {
              competitorId: true,
              isMentioned: true,
              isCited: true,
              competitor: { select: { brandName: true, active: true } },
            },
          },
        },
      },
    },
  })

  const relevantSessions = sessions.filter((s) => s.results.length > 0)
  type SessionRow = (typeof relevantSessions)[number]
  type ResultRow = SessionRow['results'][number]
  type Flags = { isMentioned: boolean; isCited: boolean } | null

  function ratesFor(results: ResultRow[], getFlags: (r: ResultRow) => Flags): { mentionRate: number; citationRate: number } {
    let total = 0
    let mentioned = 0
    let cited = 0
    for (const r of results) {
      const flags = getFlags(r)
      if (!flags) continue
      total++
      if (flags.isMentioned) mentioned++
      if (flags.isCited) cited++
    }
    return { mentionRate: total > 0 ? mentioned / total : 0, citationRate: total > 0 ? cited / total : 0 }
  }

  const yourPoints: BrandTrendPoint[] = relevantSessions.map((s) => ({
    runSessionId: s.id,
    startedAt: s.startedAt.toISOString(),
    ...ratesFor(s.results, (r) => ({ isMentioned: r.isMentioned, isCited: r.isCited })),
  }))

  const competitorNames = new Map<string, string>()
  for (const s of relevantSessions) {
    for (const r of s.results) {
      for (const cm of r.competitorMentions) {
        if (cm.competitor.active) competitorNames.set(cm.competitorId, cm.competitor.brandName)
      }
    }
  }

  const competitorSeries: BrandTrendSeries[] = [...competitorNames.entries()]
    .map(([id, brandName]) => ({
      id,
      label: brandName,
      points: relevantSessions.map((s) => ({
        runSessionId: s.id,
        startedAt: s.startedAt.toISOString(),
        ...ratesFor(s.results, (r) => {
          const cm = r.competitorMentions.find((c) => c.competitorId === id)
          return cm ? { isMentioned: cm.isMentioned, isCited: cm.isCited } : null
        }),
      })),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return [{ id: 'you', label: YOUR_BRAND_NAME, points: yourPoints }, ...competitorSeries]
}
