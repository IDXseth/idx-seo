import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { citationPointsTo } from './detection'
import { getActiveBrand } from './projects'

// ─── Citation sources ────────────────────────────────────────────────────────
// Which sites the AI platforms explicitly cite in their answers, split into the
// brand's own domains, each tracked competitor's, and everyone else. Uses
// detection's own domain rule, so "your citations" here agree with Cited.

export interface CitationSourceBucket {
  id: string        // 'you', a competitor id, or 'other'
  label: string
  count: number
  share: number
}

export interface CitationSources {
  total: number
  buckets: CitationSourceBucket[]  // you, competitors (by name), other — empty ones included
  thirdParty: Array<{ domain: string; count: number; share: number }>  // top non-brand domains
}

export async function getCitationSources(
  resultWhere: Prisma.ResultWhereInput,
  competitors: Array<{ id: string; brandName: string; domain: string }>
): Promise<CitationSources> {
  const [brand, citations] = await Promise.all([
    getActiveBrand(),
    prisma.citation.findMany({
      where: { result: resultWhere, isExplicitCitation: true, url: { not: '' } },
      select: { url: true, domain: true },
    }),
  ])

  const byName = [...competitors].sort((a, b) => a.brandName.localeCompare(b.brandName))
  const counts = new Map<string, number>([['you', 0], ...byName.map((c) => [c.id, 0] as [string, number]), ['other', 0]])
  const otherDomains = new Map<string, number>()

  for (const c of citations) {
    let owner = citationPointsTo(c, brand.domains) ? 'you' : null
    if (!owner) owner = byName.find((comp) => citationPointsTo(c, [comp.domain]))?.id ?? null
    if (owner) {
      counts.set(owner, (counts.get(owner) ?? 0) + 1)
    } else {
      counts.set('other', (counts.get('other') ?? 0) + 1)
      const domain = c.domain.toLowerCase().replace(/^www\./, '')
      otherDomains.set(domain, (otherDomains.get(domain) ?? 0) + 1)
    }
  }

  const total = citations.length
  const share = (n: number) => (total > 0 ? n / total : 0)
  const labels = new Map<string, string>([['you', brand.label], ...byName.map((c) => [c.id, c.brandName] as [string, string]), ['other', 'Other sites']])

  return {
    total,
    buckets: [...counts.entries()].map(([id, count]) => ({ id, label: labels.get(id) ?? id, count, share: share(count) })),
    thirdParty: [...otherDomains.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count, share: share(count) })),
  }
}

// ─── Visibility gaps ─────────────────────────────────────────────────────────
// Prompts where at least one tracked competitor is mentioned but the brand
// isn't — the clearest list of where to win visibility back.

export interface VisibilityGap {
  promptId: string
  promptText: string
  entityName: string
  gapResponses: number      // responses where a competitor appeared and you didn't
  totalResponses: number    // responses for this prompt in scope
  competitors: Array<{ id: string; brandName: string; count: number }>
}

export async function getVisibilityGaps(resultWhere: Prisma.ResultWhereInput, limit = 15): Promise<VisibilityGap[]> {
  const results = await prisma.result.findMany({
    where: resultWhere,
    select: {
      promptId: true,
      isMentioned: true,
      prompt: { select: { promptText: true, entityName: true, communityName: true } },
      competitorMentions: {
        where: { isMentioned: true, competitor: { active: true } },
        select: { competitorId: true, competitor: { select: { brandName: true } } },
      },
    },
  })

  const byPrompt = new Map<string, VisibilityGap>()
  for (const r of results) {
    let gap = byPrompt.get(r.promptId)
    if (!gap) {
      gap = {
        promptId: r.promptId,
        promptText: r.prompt.promptText,
        entityName: r.prompt.entityName || r.prompt.communityName,
        gapResponses: 0,
        totalResponses: 0,
        competitors: [],
      }
      byPrompt.set(r.promptId, gap)
    }
    gap.totalResponses++
    if (r.isMentioned || r.competitorMentions.length === 0) continue
    gap.gapResponses++
    for (const m of r.competitorMentions) {
      const entry = gap.competitors.find((c) => c.id === m.competitorId)
      if (entry) entry.count++
      else gap.competitors.push({ id: m.competitorId, brandName: m.competitor.brandName, count: 1 })
    }
  }

  return [...byPrompt.values()]
    .filter((g) => g.gapResponses > 0)
    .map((g) => ({ ...g, competitors: g.competitors.sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.gapResponses - a.gapResponses || a.promptText.localeCompare(b.promptText))
    .slice(0, limit)
}
