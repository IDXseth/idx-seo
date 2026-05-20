import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { gscSiteUrl: true },
  })

  return NextResponse.json({ siteUrl: user?.gscSiteUrl ?? null })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const siteUrl: string | null = body.siteUrl ?? null

  await prisma.user.update({
    where: { id: session.user.id },
    data: { gscSiteUrl: siteUrl },
  })

  return NextResponse.json({ siteUrl })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Clear GSC tokens from the linked Google account so the user can reconnect
  await prisma.account.updateMany({
    where: { userId: session.user.id, provider: 'google' },
    data: { access_token: null, refresh_token: null, scope: null, expires_at: null },
  })

  // Also clear the selected site
  await prisma.user.update({
    where: { id: session.user.id },
    data: { gscSiteUrl: null },
  })

  return NextResponse.json({ ok: true })
}
