import { XMLParser } from 'fast-xml-parser'
import { getGscMetricsByUrl, getGscStatus, type GscMetric, type GscStatus } from './gsc'

const SITEMAP_URL = 'https://www.seniorlifestyle.com/community-sitemap.xml'
// Community pages live under this path prefix
const COMMUNITY_PATH_PREFIX = '/resources/senior-living/'

const STOPWORDS = new Set(['the', 'at', 'of', 'a', 'an', 'and', 'by', 'for', 'in', 'on', 'senior', 'living', 'lifestyle'])

export interface SitemapEntry {
  url: string
  communitySlug: string // e.g. "the-neighborhoods-at-cedar-ridge"
  citySlug: string      // e.g. "chicago-il"
  slug: string          // normalized for matching: "neighborhoods cedar ridge"
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
  visibilityScore: number          // 0–100
  sitemapStatus: 'has_page' | 'no_page' | 'not_tracked'
  sitemapUrl: string | null
  optimizationPriority: number | null  // 1 = highest priority, null if not ranked
  actionItems: ActionItem[]
  gscMetric: GscMetric | null
}

export interface SitemapAnalysis {
  communities: CommunityWithSitemapStatus[]
  untrackedPages: SitemapEntry[]   // in sitemap but no DB match
  summary: {
    totalTracked: number
    withPage: number
    noPage: number
    notTracked: number
    avgScoreWithPage: number
  }
  fetchedAt: string
  error: string | null
  gsc: GscStatus
}

// ── Normalization ────────────────────────────────────────────────────────────

function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter(w => w.length > 0 && !STOPWORDS.has(w))
    .join(' ')
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' ').filter(Boolean))
  const setB = new Set(b.split(' ').filter(Boolean))
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return intersection / union
}

// ── Sitemap fetch + parse ────────────────────────────────────────────────────

async function fetchSitemapEntries(): Promise<SitemapEntry[]> {
  const res = await fetch(SITEMAP_URL, { next: { revalidate: 3600 } } as RequestInit)
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status} ${res.statusText}`)
  const xml = await res.text()

  const parser = new XMLParser({ ignoreAttributes: false })
  const parsed = parser.parse(xml)

  // Handle both single URL and array of URLs
  const rawUrls = parsed?.urlset?.url
  if (!rawUrls) return []
  const urls: Array<{ loc?: string }> = Array.isArray(rawUrls) ? rawUrls : [rawUrls]

  return urls
    .map(u => u?.loc)
    .filter((loc): loc is string => typeof loc === 'string' && loc.includes(COMMUNITY_PATH_PREFIX))
    .map(url => {
      try {
        const path = new URL(url).pathname
        const suffix = path.replace(COMMUNITY_PATH_PREFIX, '')
        const segments = suffix.split('/').filter(Boolean)
        const citySlug = segments[0] ?? ''
        const communitySlug = segments[1] ?? ''
        if (!communitySlug) return null
        return {
          url,
          communitySlug,
          citySlug,
          slug: normalizeForMatch(communitySlug),
        }
      } catch {
        return null
      }
    })
    .filter((e): e is SitemapEntry => e !== null && e.communitySlug.length > 0)
}

// ── Matching ─────────────────────────────────────────────────────────────────

function matchCommunity(
  communityName: string,
  sitemapEntries: SitemapEntry[]
): SitemapEntry | null {
  const normalized = normalizeForMatch(communityName)

  // Pass 1: exact match after normalization
  const exact = sitemapEntries.find(e => e.slug === normalized)
  if (exact) return exact

  // Pass 2: Jaccard similarity >= 0.7
  let best: SitemapEntry | null = null
  let bestScore = 0
  for (const entry of sitemapEntries) {
    const score = jaccardSimilarity(normalized, entry.slug)
    if (score > bestScore && score >= 0.7) {
      bestScore = score
      best = entry
    }
  }
  return best
}

// ── Action items ──────────────────────────────────────────────────────────────

function getActionItems(
  mentionRate: number,
  citationRate: number,
  visibilityScore: number,
  sitemapStatus: CommunityWithSitemapStatus['sitemapStatus'],
  communityName: string,
  citySlug: string
): ActionItem[] {
  if (sitemapStatus === 'no_page') {
    const slug = communityName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return [{
      priority: 'high',
      category: 'page',
      label: 'Create a dedicated community page',
      detail: `No page found in the sitemap. Create one at /resources/senior-living/${citySlug || '[city-state]'}/${slug}/ and submit it to the sitemap.`,
    }]
  }

  const items: ActionItem[] = []

  if (mentionRate < 0.3) {
    items.push({
      priority: 'high',
      category: 'content',
      label: 'Add community name prominently to page content',
      detail: 'LLMs are not associating this page with the community name. Ensure it appears in the H1, page title, meta description, and opening paragraph.',
    })
    items.push({
      priority: 'high',
      category: 'content',
      label: 'Write care-level descriptions matching your prompt language',
      detail: 'Include explicit text for care types like "Assisted Living", "Memory Care", and "Independent Living" — use the same phrasing as your prompts.',
    })
  } else if (mentionRate < 0.6) {
    items.push({
      priority: 'medium',
      category: 'content',
      label: 'Strengthen brand mentions across the page',
      detail: 'The community is mentioned sometimes but not consistently. Add resident testimonials, staff bios, and neighborhood descriptions that naturally include the community name.',
    })
  }

  if (citationRate < 0.3) {
    items.push({
      priority: 'high',
      category: 'technical',
      label: 'Add Schema.org LocalBusiness + SeniorCare structured data',
      detail: 'The page is not being cited as a source by LLMs. Structured data markup helps AI systems identify the page as an authoritative reference for this community.',
    })
    items.push({
      priority: 'high',
      category: 'content',
      label: 'Add an FAQ section answering your tracked prompt questions',
      detail: 'LLMs prioritize pages that directly answer the queries they receive. Build a FAQ block with verbatim questions from your prompt set.',
    })
    items.push({
      priority: 'medium',
      category: 'technical',
      label: 'Build internal links to this page from related content',
      detail: 'Add 3–5 links pointing to this page from blog posts, market overview pages, and the homepage community directory to increase its authority signals.',
    })
  } else if (citationRate < 0.6) {
    items.push({
      priority: 'medium',
      category: 'content',
      label: 'Add unique linkable assets to increase citation rate',
      detail: 'The page is cited occasionally. Add assets like a virtual tour, downloadable guide, or pricing transparency page that other sites and LLMs will reference.',
    })
  }

  if (mentionRate >= 0.6 && citationRate < 0.4) {
    items.push({
      priority: 'medium',
      category: 'content',
      label: 'LLMs know this community but aren\'t citing the page — add linkable assets',
      detail: 'High mention rate with low citation means LLMs discuss the community from memory rather than citing your page. Add unique, citable content (guides, data, testimonials) to drive citation.',
    })
  }

  if (visibilityScore >= 60) {
    items.push({
      priority: 'low',
      category: 'monitoring',
      label: 'Maintain content freshness',
      detail: 'Strong performance across both mention and citation. Refresh page content quarterly to stay current in LLM training data cycles and protect this position.',
    })
  }

  return items
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getSitemapAnalysis(
  communityStats: Array<{
    communityName: string
    city: string
    mentionRate: number
    citationRate: number
    promptCount: number
  }>
): Promise<SitemapAnalysis> {
  const fetchedAt = new Date().toISOString()

  // Fetch sitemap + GSC data in parallel
  let sitemapEntries: SitemapEntry[] = []
  let error: string | null = null
  let gscMetrics = new Map<string, GscMetric>()
  let gscStatus: GscStatus = { connected: false, siteUrl: null, lastSynced: null }

  await Promise.all([
    fetchSitemapEntries()
      .then(entries => { sitemapEntries = entries })
      .catch(err => { error = err instanceof Error ? err.message : 'Failed to fetch sitemap' }),
    getGscMetricsByUrl()
      .then(m => { gscMetrics = m })
      .catch(() => {}), // GSC failure is non-fatal
    getGscStatus()
      .then(s => { gscStatus = s })
      .catch(() => {}),
  ])

  // Track which sitemap entries get matched to avoid double-counting
  const matchedSitemapUrls = new Set<string>()

  const communities: CommunityWithSitemapStatus[] = communityStats.map(c => {
    const visibilityScore = Math.round((c.mentionRate * 0.5 + c.citationRate * 0.5) * 100)
    const match = sitemapEntries.length > 0 ? matchCommunity(c.communityName, sitemapEntries) : null

    if (match) matchedSitemapUrls.add(match.url)

    const sitemapStatus = error
      ? 'no_page' // conservative fallback on fetch error
      : match
        ? 'has_page'
        : 'no_page'

    // Try to find a GSC metric by exact URL match, then by URL-prefix match
    let gscMetric: GscMetric | null = null
    if (match) {
      gscMetric = gscMetrics.get(match.url) ?? null
      // GSC may return URLs without trailing slash — try both
      if (!gscMetric) gscMetric = gscMetrics.get(match.url.replace(/\/$/, '')) ?? null
    }

    const actionItems = getActionItems(
      c.mentionRate,
      c.citationRate,
      visibilityScore,
      sitemapStatus,
      c.communityName,
      match?.citySlug ?? ''
    )

    return {
      communityName: c.communityName,
      city: c.city,
      mentionRate: c.mentionRate,
      citationRate: c.citationRate,
      promptCount: c.promptCount,
      visibilityScore,
      sitemapStatus,
      sitemapUrl: match?.url ?? null,
      optimizationPriority: null, // assigned below
      actionItems,
      gscMetric,
    }
  })

  // Rank communities that have a page by visibility score ascending (lowest = most urgent)
  const withPage = communities.filter(c => c.sitemapStatus === 'has_page')
  withPage.sort((a, b) => a.visibilityScore - b.visibilityScore)
  withPage.forEach((c, i) => { c.optimizationPriority = i + 1 })

  // Sitemap pages not matched to any DB community
  const untrackedPages = sitemapEntries.filter(e => !matchedSitemapUrls.has(e.url))

  const withPageCount = withPage.length
  const avgScoreWithPage = withPageCount > 0
    ? Math.round(withPage.reduce((sum, c) => sum + c.visibilityScore, 0) / withPageCount)
    : 0

  return {
    communities,
    untrackedPages,
    summary: {
      totalTracked: communities.length,
      withPage: withPageCount,
      noPage: communities.filter(c => c.sitemapStatus === 'no_page').length,
      notTracked: untrackedPages.length,
      avgScoreWithPage,
    },
    fetchedAt,
    error,
    gsc: gscStatus,
  }
}
