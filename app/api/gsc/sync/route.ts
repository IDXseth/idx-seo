import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { syncGscMetrics } from '@/lib/gsc'

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await syncGscMetrics()
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ synced: result.synced })
}
