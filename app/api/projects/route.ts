import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getViewer } from '@/lib/access'
import { canCreateProjects, getActiveProject, getViewerProjects, setActiveProjectCookie } from '@/lib/projects'
import { parseCompetitors, parseProjectSettings } from '@/lib/project-input'

// GET /api/projects — projects the viewer can see, which one is active, and
// whether they may create more.
export async function GET() {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [projects, active] = await Promise.all([getViewerProjects(), getActiveProject()])
  return NextResponse.json({ projects, activeProjectId: active?.id ?? null, canCreate: canCreateProjects(viewer) })
}

// POST /api/projects — create a project (and its initial competitors) and make it active.
export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canCreateProjects(viewer)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { data, error } = parseProjectSettings(body)
  if (!data) return NextResponse.json({ error }, { status: 400 })
  const competitors = parseCompetitors(body.competitors)

  try {
    const project = await prisma.project.create({
      data: {
        ...data,
        userId: viewer.id,
        competitors: { create: competitors.map((c) => ({ ...c, userId: viewer.id })) },
      },
      select: { id: true, name: true, primaryDomain: true },
    })
    await setActiveProjectCookie(project.id)
    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: `You already have a project for ${data.primaryDomain}` }, { status: 409 })
    }
    throw err
  }
}
