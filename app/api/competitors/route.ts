import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

// GET /api/competitors — list the current user's competitor sites
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sites = await prisma.competitorSite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(sites)
}

// POST /api/competitors — add a competitor site { name, domain }
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const domain = typeof body.domain === 'string' ? normalizeDomain(body.domain) : ''

  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 })
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'domain must look like a bare hostname, e.g. brookdale.com' }, { status: 400 })
  }

  const site = await prisma.competitorSite.upsert({
    where: { userId_domain: { userId: session.user.id, domain } },
    create: { userId: session.user.id, name: name || domain, domain },
    update: { name: name || domain },
  })

  return NextResponse.json(site, { status: 201 })
}
