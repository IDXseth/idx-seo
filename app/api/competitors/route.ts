import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getViewer } from '@/lib/access'
import { getActiveProject } from '@/lib/projects'
import { normalizeDomain } from '@/lib/detection'

// Competitors belong to the active project. Without one (no project created
// yet), a user's own unassigned competitors are shown, as before projects.
export async function GET() {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getActiveProject()
  const competitors = await prisma.competitor.findMany({
    where: project ? { projectId: project.id } : { userId: viewer.id, projectId: null },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(competitors)
}

export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const project = await getActiveProject()
  if (!project) return NextResponse.json({ error: 'Create a project first' }, { status: 400 })
  if (!project.canEdit) return NextResponse.json({ error: 'Only the project owner can change its competitors' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const brandName = String(body.brandName ?? '').trim()
  const domain = normalizeDomain(String(body.domain ?? ''))
  const aliases = String(body.aliases ?? '').trim()
  const active = typeof body.active === 'boolean' ? body.active : true

  if (!brandName || !domain) {
    return NextResponse.json({ error: 'brandName and domain are required' }, { status: 400 })
  }

  const competitor = await prisma.competitor.create({
    data: { userId: viewer.id, projectId: project.id, brandName, domain, aliases, active },
  })
  return NextResponse.json(competitor, { status: 201 })
}
