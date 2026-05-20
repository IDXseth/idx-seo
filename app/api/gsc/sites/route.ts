import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listGscSites } from '@/lib/gsc'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: 'google', refresh_token: { not: null } },
    select: { userId: true, scope: true, refresh_token: true, access_token: true },
  })

  if (!account) {
    return NextResponse.json({ sites: [], reason: 'no_google_account' })
  }
  if (!account.refresh_token) {
    return NextResponse.json({ sites: [], reason: 'no_refresh_token', scope: account.scope })
  }

  try {
    const sites = await listGscSites()
    return NextResponse.json({ sites })
  } catch (err) {
    return NextResponse.json({
      sites: [],
      reason: 'api_error',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
