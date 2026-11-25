import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getViewer } from '@/lib/access'
import { normalizeDomain } from '@/lib/detection'
import { canEditCompetitor } from '@/lib/projects'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.competitor.findUnique({ where: { id } })
  if (!existing || !(await canEditCompetitor(viewer, existing))) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const data: { brandName?: string; domain?: string; aliases?: string; active?: boolean } = {}
  if (typeof body.brandName === 'string') data.brandName = body.brandName.trim()
  if (typeof body.domain === 'string') data.domain = normalizeDomain(body.domain)
  if (typeof body.aliases === 'string') data.aliases = body.aliases.trim()
  if (typeof body.active === 'boolean') data.active = body.active

  if (data.brandName === '' || data.domain === '') {
    return NextResponse.json({ error: 'brandName and domain cannot be empty' }, { status: 400 })
  }

  const competitor = await prisma.competitor.update({ where: { id }, data })
  return NextResponse.json(competitor)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await prisma.competitor.findUnique({ where: { id } })
  if (!existing || !(await canEditCompetitor(viewer, existing))) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
  }

  await prisma.competitor.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
