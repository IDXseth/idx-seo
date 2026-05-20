import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const raw = await prisma.account.findMany({
    where: { provider: 'google' },
    select: { userId: true, scope: true, refresh_token: true, access_token: true },
  })

  return NextResponse.json({
    sessionUserId: session.user.id,
    googleAccounts: raw.map(a => ({
      userId: a.userId,
      isCurrentUser: a.userId === session.user.id,
      scope: a.scope,
      hasRefreshToken: !!a.refresh_token,
      hasAccessToken: !!a.access_token,
    })),
  })
}
