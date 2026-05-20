import { XMLParser } from 'fast-xml-parser'
import type { GscData } from './gsc'

export type { GscData }

export interface GscSnapshot {
  isIndexed: boolean
  impressions: number
  clicks: number
  position: number | null
  fetchedAt: string
}

export interface SitemapEntry {
  url: string
  communitySlug: string
  stateSlug: string
  slug: string
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low'
  category: 'page' | 'content' | 'technical' | 'monitoring'
  label: string
  detail: string
}

export interface CommunityWithSitemapStatus {
  communityName: string
  city: string
  mentionRate: number
  citationRate: number
  promptCount: number
  visibilityScore: number
  sitemapStatus: 'has_page' | 'no_page' | 'not_tracked'
  sitemapUrl: string | null
  optimizationPriority: number | null
  actionItems: ActionItem[]
  gsc: GscSnapshot | null
  hasLocalBusiness: boolean | null
}

export interface SitemapAnalysis {
  communities: CommunityWithSitemapStatus[]
  untrackedPages: SitemapEntry[]
  summary: {
    totalTracked: number
    withPage: number
    noPage: number
    notTracked: number
    avgScoreWithPage: number
  }
  fetchedAt: string
  error: string | null
  gscEnabled: boolean
}

const SITEMAP_URL = 'https://www.seniorlifestyle.com/community-sitemap.xml'
const STOPWORDS = new Set(['the', 'at', 'of', 'a', 'an', 'and', 'by', 'for', 'in', 'on'])

function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .join(' ')
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' '))
  const setB = new Set(b.split(' '))
  const intersection = [...setA].filter((t) => setB.has(t)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

// Groups URLs by base community path: /property/[state]/[community-slug]/
// Each group collects the base URL and all level-of-care subpage URLs.
interface CommunityUrlGroup {
  baseUrl: string
  communitySlug: string
  stateSlug: string
  slug: string        // normalised for Jaccard matching
  allUrls: string[]   // base + all subpages (assisted-living/, memory-care/, etc.)
}

function buildUrlGroups(urls: Iterable<string>): CommunityUrlGroup[] {
  const groups = new Map<string, CommunityUrlGroup>()

  for (const url of urls) {
    try {
      const parsed = new URL(url)
      const parts = parsed.pathname.replace(/\/$/, '').split('/').filter(Boolean)
      // Only consider /property/[state]/[community-slug]/...
      if (parts[0] !== 'property' || parts.length < 3) continue

      const stateSlug = parts[1]
      const communitySlug = parts[2]
      const baseUrl = `${parsed.protocol}//${parsed.host}/property/${stateSlug}/${communitySlug}/`

      if (!groups.has(baseUrl)) {
        groups.set(baseUrl, {
          baseUrl,
          communitySlug,
          stateSlug,
          slug: normalizeForMatch(communitySlug),
          allUrls: [],
        })
      }
      groups.get(baseUrl)!.allUrls.push(url)
    } catch {
      // skip malformed URLs
    }
  }

  return Array.from(groups.values())
}

function parseSitemapGroups(xml: string): CommunityUrlGroup[] {
  const parser = new XMLParser({ ignoreAttributes: false, isArray: (name) => name === 'url' })
  const parsed = parser.parse(xml)
  const urls: string[] = (parsed?.urlset?.url ?? [])
    .map((u: { loc?: string }) => u?.loc)
    .filter((loc: unknown): loc is string => typeof loc === 'string')
  return buildUrlGroups(urls)
}

function aggregateGscMetrics(urls: string[], gscMetrics: Map<string, GscData>): GscData | null {
  const metrics = urls.map((u) => gscMetrics.get(u)).filter((m): m is GscData => m != null)
  if (metrics.length === 0) return null

  const impressions = metrics.reduce((s, m) => s + m.impressions, 0)
  const clicks = metrics.reduce((s, m) => s + m.clicks, 0)

  // Impressions-weighted average position
  const posMetrics = metrics.filter((m) => m.position != null)
  let position: number | null = null
  if (posMetrics.length > 0) {
    const weightedSum = posMetrics.reduce((s, m) => s + m.position! * m.impressions, 0)
    const totalWeight = posMetrics.reduce((s, m) => s + m.impressions, 0)
    const raw = totalWeight > 0 ? weightedSum / totalWeight : posMetrics.reduce((s, m) => s + m.position!, 0) / posMetrics.length
    position = Math.round(raw * 10) / 10
  }

  const isIndexed = metrics.some((m) => m.isIndexed)
  const fetchedAt = metrics.reduce((a, b) => (a.fetchedAt > b.fetchedAt ? a : b)).fetchedAt

  return { isIndexed, impressions, clicks, position, fetchedAt }
}

function computeScore(
  mentionRate: number,
  citationRate: number,
  gsc: GscData | null
): number {
  if (gsc) {
    const normImpressions = Math.min(gsc.impressions / 1000, 1)
    const isIndexedScore = gsc.isIndexed ? 1 : 0
    return Math.round(
      (mentionRate * 0.35 + citationRate * 0.35 + normImpressions * 0.15 + isIndexedScore * 0.15) * 100
    )
  }
  return Math.round((mentionRate * 0.5 + citationRate * 0.5) * 100)
}

type CommunityBase = Omit<CommunityWithSitemapStatus, 'actionItems'>

function getActionItems(c: CommunityBase): ActionItem[] {
  const items: ActionItem[] = []

  if (c.sitemapStatus === 'no_page') {
    items.push({
      priority: 'high',
      category: 'page',
      label: 'Create a dedicated community page',
      detail: `Add a page at /property/[state]/${c.communityName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')}/`,
    })
  }

  if (c.gsc && !c.gsc.isIndexed && c.sitemapStatus === 'has_page') {
    items.push({
      priority: 'high',
      category: 'technical',
      label: 'Page not indexed by Google',
      detail:
        "Google has no record of this page in its search index. Check for noindex meta tags, crawl blocks in robots.txt, redirect chains, or canonical tag mismatches. Pages not indexed are invisible to LLMs that draw from Google's corpus.",
    })
  }

  if (c.mentionRate < 0.3) {
    items.push({
      priority: 'high',
      category: 'content',
      label: 'Add community name in key page positions',
      detail:
        "Include the community name prominently in H1, page title, and opening paragraph — LLMs aren't associating this page with the community.",
    })
    items.push({
      priority: 'high',
      category: 'content',
      label: 'Match care-level language to your prompt set',
      detail:
        "Write care-level descriptions using the exact terms in your prompts (e.g., 'Assisted Living', 'Memory Care') so LLMs connect the page to those queries.",
    })
  }

  if (c.citationRate < 0.3 && c.sitemapStatus === 'has_page' && c.hasLocalBusiness !== true) {
    items.push({
      priority: 'medium',
      category: 'technical',
      label: 'Add structured data (LocalBusiness + SeniorCare)',
      detail:
        "The page isn't being cited as a source by LLMs. Adding Schema.org LocalBusiness and SeniorCare markup helps AI platforms recognise it as an authoritative source.",
    })
  }

  if (c.citationRate < 0.3 && c.sitemapStatus === 'has_page') {
    items.push({
      priority: 'medium',
      category: 'content',
      label: 'Add an FAQ matching your prompt set',
      detail:
        'LLMs prioritise pages that directly answer the queries they receive. Add a FAQ section answering the questions in your prompt set verbatim.',
    })
    items.push({
      priority: 'medium',
      category: 'technical',
      label: 'Build 3–5 internal links to this page',
      detail:
        'Link to this page from related blog posts, the market overview page, and the homepage community directory to increase its authority signal.',
    })
  }

  if (c.mentionRate >= 0.6 && c.citationRate < 0.3) {
    items.push({
      priority: 'medium',
      category: 'content',
      label: 'Add unique linkable assets',
      detail:
        "LLMs know this community but aren't citing the page. Add a virtual tour, downloadable guide, or pricing transparency page to give LLMs a reason to link here.",
    })
  }

  if (c.gsc && c.gsc.impressions > 200 && c.citationRate < 0.3) {
    items.push({
      priority: 'medium',
      category: 'content',
      label: 'High Google traffic, low LLM citation — add citable content',
      detail:
        `This page gets ${c.gsc.impressions.toLocaleString()} organic impressions/month but LLMs aren't citing it. Add statistics, named experts, or a unique data point — LLMs prefer citable, quotable content over general descriptions.`,
    })
  }

  if (c.visibilityScore >= 60) {
    items.push({
      priority: 'low',
      category: 'monitoring',
      label: 'Maintain and refresh quarterly',
      detail:
        'Strong performance. Refresh page content quarterly to stay current in LLM training data cycles.',
    })
  }

  return items
}

export async function getSitemapAnalysis(
  communityStats: Array<{
    communityName: string
    city: string
    mentionRate: number
    citationRate: number
    promptCount: number
  }>,
  gscMetrics?: Map<string, GscData>,
  crawlResults?: Map<string, { hasLocalBusiness: boolean | null; hasSeniorCare: boolean | null }>
): Promise<SitemapAnalysis> {
  const fetchedAt = new Date().toISOString()
  let urlGroups: CommunityUrlGroup[] = []
  let fetchError: string | null = null

  try {
    const res = await fetch(SITEMAP_URL, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    urlGroups = parseSitemapGroups(xml)
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err)
  }

  // Sitemap blocked (403) or empty — fall back to GscMetric URLs already in the DB.
  // URLs follow /property/[state]/[community-slug]/[optional-level-of-care]/ so the
  // same buildUrlGroups logic applies and aggregation across subpages still works.
  if (urlGroups.length === 0 && gscMetrics && gscMetrics.size > 0) {
    urlGroups = buildUrlGroups(gscMetrics.keys())
    fetchError = null
  }

  const matchedGroupIds = new Set<string>()

  const communitiesBase: CommunityBase[] = communityStats.map((c) => {
    const normalizedName = normalizeForMatch(c.communityName)

    // Exact slug match first, then best Jaccard ≥ 0.7
    let matchedGroup: CommunityUrlGroup | null = null
    for (const group of urlGroups) {
      if (matchedGroupIds.has(group.baseUrl)) continue
      if (group.slug === normalizedName) {
        matchedGroup = group
        break
      }
    }
    if (!matchedGroup) {
      let bestScore = 0
      for (const group of urlGroups) {
        if (matchedGroupIds.has(group.baseUrl)) continue
        const score = jaccardSimilarity(normalizedName, group.slug)
        if (score > bestScore && score >= 0.7) {
          bestScore = score
          matchedGroup = group
        }
      }
    }
    if (matchedGroup) matchedGroupIds.add(matchedGroup.baseUrl)

    const gscRaw = matchedGroup && gscMetrics
      ? aggregateGscMetrics(matchedGroup.allUrls, gscMetrics)
      : null

    const gsc: CommunityBase['gsc'] = gscRaw
      ? {
          isIndexed: gscRaw.isIndexed,
          impressions: gscRaw.impressions,
          clicks: gscRaw.clicks,
          position: gscRaw.position,
          fetchedAt: gscRaw.fetchedAt instanceof Date
            ? (gscRaw.fetchedAt as Date).toISOString()
            : String(gscRaw.fetchedAt),
        }
      : null

    const visibilityScore = computeScore(c.mentionRate, c.citationRate, gscRaw)

    // Look up crawl result using the clean base URL (no query params)
    const baseUrl = matchedEntry ? matchedEntry.url.split('?')[0].replace(/\/?$/, '/') : null
    const hasLocalBusiness = baseUrl ? (crawlResults?.get(baseUrl)?.hasLocalBusiness ?? null) : null

    return {
      communityName: c.communityName,
      city: c.city,
      mentionRate: c.mentionRate,
      citationRate: c.citationRate,
      promptCount: c.promptCount,
      visibilityScore,
      sitemapStatus: (matchedGroup ? 'has_page' : 'no_page') as 'has_page' | 'no_page',
      sitemapUrl: matchedGroup?.baseUrl ?? null,
      optimizationPriority: null as number | null,
      gsc,
      hasLocalBusiness,
    }
  })

  // Rank has_page communities by score ascending (lowest score = highest priority)
  const withPage = communitiesBase.filter((c) => c.sitemapStatus === 'has_page')
  withPage.sort((a, b) => a.visibilityScore - b.visibilityScore)
  withPage.forEach((c, i) => { c.optimizationPriority = i + 1 })

  const communities: CommunityWithSitemapStatus[] = communitiesBase.map((c) => ({
    ...c,
    actionItems: getActionItems(c),
  }))

  const withPageCommunities = communities.filter((c) => c.sitemapStatus === 'has_page')
  const avgScoreWithPage =
    withPageCommunities.length > 0
      ? Math.round(
          withPageCommunities.reduce((s, c) => s + c.visibilityScore, 0) / withPageCommunities.length
        )
      : 0

  const gscEnabled = !!(gscMetrics && gscMetrics.size > 0)

  return {
    communities,
    untrackedPages: [],  // omitted — too many entries when sourcing from GscMetric
    summary: {
      totalTracked: communities.length,
      withPage: withPageCommunities.length,
      noPage: communities.filter((c) => c.sitemapStatus === 'no_page').length,
      notTracked: 0,
      avgScoreWithPage,
    },
    fetchedAt,
    error: fetchError,
    gscEnabled,
  }
}
