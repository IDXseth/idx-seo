import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getViewer } from '@/lib/access'
import { canEditProject, readableProjectWhere } from '@/lib/projects'
import { parseProjectSettings } from '@/lib/project-input'

const SETTINGS_SELECT = {
  id: true,
  name: true,
  primaryDomain: true,
  additionalDomains: true,
  brandNames: true,
  sitemapUrl: true,
  sitemapPathPrefix: true,
  userId: true,
} as const

// GET /api/projects/[id] — a project's brand settings.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const project = await prisma.project.findFirst({
    where: { AND: [{ id }, readableProjectWhere(viewer)] },
    select: SETTINGS_SELECT,
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { userId, ...settings } = project
  return NextResponse.json({ ...settings, canEdit: canEditProject(viewer, { userId }) })
}

// PATCH /api/projects/[id] — update brand settings. Takes effect on the next run;
// existing results keep the detection they were scored with.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await prisma.project.findUnique({ where: { id }, select: { userId: true } })
  if (!existing || !canEditProject(viewer, existing)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = parseProjectSettings(await req.json().catch(() => ({})))
  if (!data) return NextResponse.json({ error }, { status: 400 })

  try {
    const project = await prisma.project.update({ where: { id }, data, select: SETTINGS_SELECT })
    const { userId, ...settings } = project
    return NextResponse.json({ ...settings, canEdit: canEditProject(viewer, { userId }) })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: `A project for ${data.primaryDomain} already exists` }, { status: 409 })
    }
    throw err
  }
}
