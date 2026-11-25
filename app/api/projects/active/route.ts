import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getViewer } from '@/lib/access'
import { readableProjectWhere, setActiveProjectCookie } from '@/lib/projects'

// POST /api/projects/active { projectId } — switch the project the app is working in.
export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await req.json().catch(() => ({}))
  if (typeof projectId !== 'string') return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const count = await prisma.project.count({ where: { AND: [{ id: projectId }, readableProjectWhere(viewer)] } })
  if (count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await setActiveProjectCookie(projectId)
  return NextResponse.json({ ok: true })
}
