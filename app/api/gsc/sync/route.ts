import { auth } from '@/lib/auth'
import { refreshGscCache, refreshGscQueryCache } from '@/lib/gsc'
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
  const queryResult = await refreshGscQueryCache()
  return NextResponse.json({
    pagesUpdated: result.pagesUpdated,
    queriesUpdated: queryResult.queriesUpdated,
    queryError: queryResult.error ?? null,
  })
}
