import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listGscSites } from '@/lib/gsc'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find any Google account for this user or any user (needed for shared GSC access)
  const [myAccount, anyAccount] = await Promise.all([
    prisma.account.findFirst({
      where: { provider: 'google', userId: session.user.id },
      select: { id: true, scope: true, refresh_token: true },
    }),
    prisma.account.findFirst({
      where: { provider: 'google' },
      select: { id: true, scope: true, refresh_token: true, userId: true },
    }),
  ])

  const account = myAccount ?? anyAccount
  const sites = await listGscSites()
  const connected = !!(account)
  return NextResponse.json({
    sites,
    connected,
    debug: {
      sessionUserId: session.user.id,
      hasMyGoogleAccount: !!myAccount,
      myAccountHasRefreshToken: !!myAccount?.refresh_token,
      myAccountScope: myAccount?.scope ?? null,
      hasAnyGoogleAccount: !!anyAccount,
      anyAccountUserId: anyAccount?.userId ?? null,
      anyAccountHasRefreshToken: !!anyAccount?.refresh_token,
      anyAccountScope: anyAccount?.scope ?? null,
    },
  })
}
