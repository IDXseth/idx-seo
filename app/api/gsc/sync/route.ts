import { getViewer, canViewSiteHealth } from '@/lib/access'
import { refreshGscCache, refreshGscQueryCache, crawlCommunityPages } from '@/lib/gsc'
import { NextResponse } from 'next/server'

export async function POST() {
  const viewer = await getViewer()
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await canViewSiteHealth(viewer))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const result = await refreshGscCache()
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  const queryResult = await refreshGscQueryCache()
  // Crawl community pages to detect schema markup (fire-and-forget; errors are non-fatal)
  crawlCommunityPages().catch(() => undefined)
  return NextResponse.json({
    pagesUpdated: result.pagesUpdated,
    queriesUpdated: queryResult.queriesUpdated,
    queryError: queryResult.error ?? null,
  })
}
