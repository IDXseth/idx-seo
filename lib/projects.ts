import { cache } from 'react'
import { cookies } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { getViewer, isSuperUser, readableBatchWhere, writableBatchWhere, type Viewer } from './access'
import { getBrandTarget } from './detection-context'
import type { BrandTarget } from './detection'

// A Project is one tracked brand/domain. The app works inside one "active"
// project at a time — chosen in the nav and remembered in this cookie — and
// every dashboard, prompt-set list and run is limited to it.
export const ACTIVE_PROJECT_COOKIE = 'activeProject'

export interface ProjectSummary {
  id: string
  name: string
  primaryDomain: string
  canEdit: boolean
}

// Projects a viewer can see: ones they own, ones containing a prompt set they
// can read, or every project for super users.
export function readableProjectWhere(viewer: Viewer): Prisma.ProjectWhereInput {
  if (isSuperUser(viewer.email)) return {}
  return { OR: [{ userId: viewer.id }, { batches: { some: readableBatchWhere(viewer) } }] }
}

// Editing a project's brand settings or competitors changes everyone's
// numbers in it — owner or super user only.
export function canEditProject(viewer: Viewer, project: { userId: string }): boolean {
  return project.userId === viewer.id || isSuperUser(viewer.email)
}

// Project competitors are edited by the project's editors; unassigned legacy
// ones (from before projects) only by the user who made them.
export async function canEditCompetitor(
  viewer: Viewer,
  competitor: { userId: string; projectId: string | null }
): Promise<boolean> {
  if (!competitor.projectId) return competitor.userId === viewer.id
  const project = await prisma.project.findUnique({ where: { id: competitor.projectId }, select: { userId: true } })
  return !!project && canEditProject(viewer, project)
}

// Every project runs paid AI queries, and sign-up is open, so only super users
// create projects; others work in projects shared with them.
export function canCreateProjects(viewer: Viewer): boolean {
  return isSuperUser(viewer.email)
}

export const getViewerProjects = cache(async (): Promise<ProjectSummary[]> => {
  const viewer = await getViewer()
  if (!viewer) return []
  const projects = await prisma.project.findMany({
    where: readableProjectWhere(viewer),
    orderBy: { name: 'asc' },
    select: { id: true, name: true, primaryDomain: true, userId: true },
  })
  return projects.map(({ userId, ...p }) => ({ ...p, canEdit: canEditProject(viewer, { userId }) }))
})

// The cookie's project if the viewer can still see it, else their first one.
export const getActiveProject = cache(async (): Promise<ProjectSummary | null> => {
  const projects = await getViewerProjects()
  const id = (await cookies()).get(ACTIVE_PROJECT_COOKIE)?.value
  return projects.find((p) => p.id === id) ?? projects[0] ?? null
})

// Prompt sets in the active project that the viewer can read. With no project
// (e.g. none created yet) it falls back to everything they can read.
export async function activeBatchWhere(viewer: Viewer): Promise<Prisma.BatchWhereInput> {
  const project = await getActiveProject()
  return project ? { AND: [readableBatchWhere(viewer), { projectId: project.id }] } : readableBatchWhere(viewer)
}

// Same, limited to prompt sets the viewer may run or edit.
export async function activeWritableBatchWhere(viewer: Viewer): Promise<Prisma.BatchWhereInput> {
  const project = await getActiveProject()
  return project ? { AND: [writableBatchWhere(viewer), { projectId: project.id }] } : writableBatchWhere(viewer)
}

// Prompt filter for server-component data functions to spread into their where
// clauses: the viewer's readable prompts in the active project. Throws when
// nobody is signed in, so a page that forgets its own auth check fails closed.
export async function promptScope(): Promise<Prisma.PromptWhereInput> {
  const viewer = await getViewer()
  if (!viewer) throw new Error('Not signed in')
  return { batch: await activeBatchWhere(viewer) }
}

// Route Handlers / Server Functions only — cookies can't be set while rendering.
export async function setActiveProjectCookie(projectId: string): Promise<void> {
  ;(await cookies()).set(ACTIVE_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}

// The active project's brand (name/domains), for labelling "you" in charts.
// Outside any project it's the legacy Senior Lifestyle brand, as detection uses.
export const getActiveBrand = cache(async (): Promise<BrandTarget> => {
  return getBrandTarget((await getActiveProject())?.id ?? null)
})
