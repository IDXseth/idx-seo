import { auth } from '@/lib/auth'
import { refreshGscCache, crawlCommunityPages } from '@/lib/gsc'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await refreshGscCache()
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  // Crawl community pages to detect schema markup (fire-and-forget; errors are non-fatal)
  crawlCommunityPages().catch(() => undefined)
  return NextResponse.json({ pagesUpdated: result.pagesUpdated })
}
