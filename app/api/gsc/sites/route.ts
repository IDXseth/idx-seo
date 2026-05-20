import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listGscSites } from '@/lib/gsc'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if any Google account exists (even if webmasters scope wasn't stored correctly)
  const googleAccount = await prisma.account.findFirst({
    where: { provider: 'google', refresh_token: { not: null } },
    select: { id: true },
  })

  const sites = await listGscSites()
  return NextResponse.json({ sites, connected: !!googleAccount })
}
