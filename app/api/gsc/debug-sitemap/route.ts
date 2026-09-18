import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { XMLParser } from 'fast-xml-parser'

const SITEMAP_URL = 'https://www.seniorlifestyle.com/community-sitemap.xml'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')?.toLowerCase() ?? ''

  const gscTotal = await prisma.gscMetric.count()
  const gscMatches = q
    ? await prisma.gscMetric.findMany({
        where: { pageUrl: { contains: q } },
        select: { pageUrl: true },
      })
    : await prisma.gscMetric.findMany({ take: 10, select: { pageUrl: true } })

  const communityMatches = q
    ? await prisma.prompt.findMany({
        where: { communityName: { contains: q, mode: 'insensitive' } },
        distinct: ['communityName'],
        select: { communityName: true, city: true },
      })
    : []

  let sitemapStatus = ''
  let allUrls: string[] = []
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
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err)
  }

  const sitemapMatches = q ? allUrls.filter((u) => u.toLowerCase().includes(q)) : allUrls.slice(0, 10)

  return NextResponse.json({
    sitemapStatus,
    fetchError: fetchError || null,
    totalSitemapUrls: allUrls.length,
    sitemapMatches,
    gscMetricTotal: gscTotal,
    gscMatches: gscMatches.map((g) => g.pageUrl),
    communityNamesInDB: communityMatches,
  })
}
