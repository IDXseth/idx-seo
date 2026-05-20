import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { XMLParser } from 'fast-xml-parser'

const SITEMAP_URL = 'https://www.seniorlifestyle.com/community-sitemap.xml'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const gscSample = await prisma.gscMetric.findMany({ take: 10, select: { pageUrl: true } })
  const gscTotal = await prisma.gscMetric.count()

  let sitemapStatus = ''
  let allUrls: string[] = []
  let urlsWithPrefix: string[] = []
  let fetchError = ''

  try {
    const res = await fetch(SITEMAP_URL, { cache: 'no-store' })
    sitemapStatus = `HTTP ${res.status}`
    if (res.ok) {
      const xml = await res.text()
      const parser = new XMLParser({ ignoreAttributes: false, isArray: (name) => name === 'url' })
      const parsed = parser.parse(xml)
      allUrls = (parsed?.urlset?.url ?? [])
        .map((u: { loc?: string }) => u?.loc)
        .filter((loc: unknown): loc is string => typeof loc === 'string')
      urlsWithPrefix = allUrls.filter((u) => u.includes('/resources/senior-living/'))
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({
    sitemapUrl: SITEMAP_URL,
    sitemapStatus,
    fetchError: fetchError || null,
    totalSitemapUrls: allUrls.length,
    urlsMatchingPrefix: urlsWithPrefix.length,
    first10SitemapUrls: allUrls.slice(0, 10),
    first5WithPrefix: urlsWithPrefix.slice(0, 5),
    gscMetricTotal: gscTotal,
    sampleGscUrls: gscSample.map((g) => g.pageUrl),
  })
}
