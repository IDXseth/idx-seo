import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const competitors = await prisma.competitor.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(competitors)
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const brandName = String(body.brandName ?? '').trim()
  const domain = normalizeDomain(String(body.domain ?? ''))
  const aliases = String(body.aliases ?? '').trim()
  const active = typeof body.active === 'boolean' ? body.active : true

  if (!brandName || !domain) {
    return NextResponse.json({ error: 'brandName and domain are required' }, { status: 400 })
  }

  const competitor = await prisma.competitor.create({
    data: { userId, brandName, domain, aliases, active },
  })
  return NextResponse.json(competitor, { status: 201 })
}
