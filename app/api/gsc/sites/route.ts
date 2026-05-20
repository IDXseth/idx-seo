import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listGscSites } from '@/lib/gsc'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find any Google account — include debug info to diagnose connection issues
  const googleAccount = await prisma.account.findFirst({
    where: { provider: 'google' },
    select: { id: true, scope: true, refresh_token: true },
  })

  const sites = await listGscSites()
  const connected = !!(googleAccount?.refresh_token)
  return NextResponse.json({
    sites,
    connected,
    debug: {
      hasGoogleAccount: !!googleAccount,
      hasRefreshToken: !!googleAccount?.refresh_token,
      scope: googleAccount?.scope ?? null,
    },
  })
}
