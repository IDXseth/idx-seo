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
