import { auth } from '@/lib/auth'
import { refreshGscCache } from '@/lib/gsc'
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
  return NextResponse.json({ pagesUpdated: result.pagesUpdated })
}
