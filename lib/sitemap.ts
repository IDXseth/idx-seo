import { XMLParser } from 'fast-xml-parser'

export interface SitemapEntry {
  url: string
  communitySlug: string
  citySlug: string
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
}

const SITEMAP_URL = 'https://www.seniorlifestyle.com/community-sitemap.xml'
const PATH_PREFIX = '/resources/senior-living/'
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

function parseSitemapEntries(xml: string): SitemapEntry[] {
  const parser = new XMLParser({ ignoreAttributes: false, isArray: (name) => name === 'url' })
  const parsed = parser.parse(xml)
  const urls: string[] = (parsed?.urlset?.url ?? [])
    .map((u: { loc?: string }) => u?.loc)
    .filter((loc: unknown): loc is string => typeof loc === 'string' && loc.includes(PATH_PREFIX))

  return urls.map((url) => {
    const path = new URL(url).pathname
    const parts = path.replace(PATH_PREFIX, '').replace(/\/$/, '').split('/')
    const citySlug = parts[0] ?? ''
    const communitySlug = parts[1] ?? ''
    return {
      url,
      communitySlug,
      citySlug,
      slug: normalizeForMatch(communitySlug),
    }
  })
}

function getActionItems(c: Omit<CommunityWithSitemapStatus, 'actionItems'>): ActionItem[] {
  const items: ActionItem[] = []

  if (c.sitemapStatus === 'no_page') {
    items.push({
      priority: 'high',
      category: 'page',
      label: 'Create a dedicated community page',
      detail: `Add a page at /resources/senior-living/[city-state]/${c.communityName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')}/`,
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

  if (c.citationRate < 0.3 && c.sitemapStatus === 'has_page') {
    items.push({
      priority: 'medium',
      category: 'technical',
      label: 'Add structured data (LocalBusiness + SeniorCare)',
      detail:
        "The page isn't being cited as a source by LLMs. Adding Schema.org LocalBusiness and SeniorCare markup helps AI platforms recognise it as an authoritative source.",
    })
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
  }>
): Promise<SitemapAnalysis> {
  const fetchedAt = new Date().toISOString()
  let sitemapEntries: SitemapEntry[] = []
  let fetchError: string | null = null

  try {
    const res = await fetch(SITEMAP_URL, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const xml = await res.text()
    sitemapEntries = parseSitemapEntries(xml)
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err)
  }

  // Match each community to a sitemap entry
  const matched = new Set<number>()

  const communitiesBase = communityStats.map((c) => {
    const normalizedName = normalizeForMatch(c.communityName)
    const visibilityScore = Math.round((c.mentionRate * 0.5 + c.citationRate * 0.5) * 100)

    // Exact match
    let matchedEntry: SitemapEntry | null = null
    for (let i = 0; i < sitemapEntries.length; i++) {
      if (sitemapEntries[i].slug === normalizedName) {
        matchedEntry = sitemapEntries[i]
        matched.add(i)
        break
      }
    }

    // Jaccard fallback
    if (!matchedEntry) {
      let bestScore = 0
      let bestIdx = -1
      for (let i = 0; i < sitemapEntries.length; i++) {
        if (matched.has(i)) continue
        const score = jaccardSimilarity(normalizedName, sitemapEntries[i].slug)
        if (score > bestScore && score >= 0.7) {
          bestScore = score
          bestIdx = i
        }
      }
      if (bestIdx >= 0) {
        matchedEntry = sitemapEntries[bestIdx]
        matched.add(bestIdx)
      }
    }

    return {
      communityName: c.communityName,
      city: c.city,
      mentionRate: c.mentionRate,
      citationRate: c.citationRate,
      promptCount: c.promptCount,
      visibilityScore,
      sitemapStatus: (matchedEntry ? 'has_page' : 'no_page') as 'has_page' | 'no_page',
      sitemapUrl: matchedEntry?.url ?? null,
      optimizationPriority: null as number | null,
    }
  })

  // Rank has_page communities by score ascending
  const withPage = communitiesBase
    .filter((c) => c.sitemapStatus === 'has_page')
    .sort((a, b) => a.visibilityScore - b.visibilityScore)
  withPage.forEach((c, i) => {
    c.optimizationPriority = i + 1
  })

  const communities: CommunityWithSitemapStatus[] = communitiesBase.map((c) => ({
    ...c,
    actionItems: getActionItems(c),
  }))

  const untrackedPages = sitemapEntries.filter((_, i) => !matched.has(i))

  const withPageCommunities = communities.filter((c) => c.sitemapStatus === 'has_page')
  const avgScoreWithPage =
    withPageCommunities.length > 0
      ? Math.round(
          withPageCommunities.reduce((s, c) => s + c.visibilityScore, 0) / withPageCommunities.length
        )
      : 0

  return {
    communities,
    untrackedPages,
    summary: {
      totalTracked: communities.length,
      withPage: withPageCommunities.length,
      noPage: communities.filter((c) => c.sitemapStatus === 'no_page').length,
      notTracked: untrackedPages.length,
      avgScoreWithPage,
    },
    fetchedAt,
    error: fetchError,
  }
}
