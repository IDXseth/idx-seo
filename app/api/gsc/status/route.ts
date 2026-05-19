import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getGscStatus } from '@/lib/gsc'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = await getGscStatus()
  return NextResponse.json(status)
}
