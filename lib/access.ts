import { cache } from 'react'
import type { Prisma } from '@prisma/client'
import { auth } from './auth'
import { prisma } from './prisma'
import { YOUR_BRAND_DOMAIN } from './utils'

export const SUPER_USER_DOMAIN = '@idx.inc'

export function isSuperUser(email?: string | null): boolean {
  return !!email?.toLowerCase().endsWith(SUPER_USER_DOMAIN)
}

export function canWrite(
  userId: string,
  userEmail: string | null | undefined,
  batchOwnerId: string
): boolean {
  return userId === batchOwnerId || isSuperUser(userEmail)
}

export interface Viewer {
  id: string
  email: string | null
}

// Cached per request, so data functions deep in a page can call it freely.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth()
  if (!session?.user?.id) return null
  return { id: session.user.id, email: session.user.email?.toLowerCase() ?? null }
})

// Batches a viewer can read: ones they own, ones shared with them (by user or
// invited email — ProjectShare emails are stored lowercased), or every batch
// for super users. AND this into every query that reads prompt/result data.
export function readableBatchWhere(viewer: Viewer): Prisma.BatchWhereInput {
  if (isSuperUser(viewer.email)) return {}
  return {
    OR: [
      { userId: viewer.id },
      { shares: { some: { OR: [{ userId: viewer.id }, ...(viewer.email ? [{ email: viewer.email }] : [])] } } },
    ],
  }
}

export function readablePromptWhere(viewer: Viewer): Prisma.PromptWhereInput {
  return { batch: readableBatchWhere(viewer) }
}

// Prompt filter for the current request's viewer, for server-component data
// functions to spread into their where clauses. Throws when nobody is signed in,
// so a page that forgets its own auth check fails closed instead of open.
export async function promptScope(): Promise<Prisma.PromptWhereInput> {
  const viewer = await getViewer()
  if (!viewer) throw new Error('Not signed in')
  return readablePromptWhere(viewer)
}

// Batches a viewer can run, edit or delete — owner or super user, same rule as canWrite.
export function writableBatchWhere(viewer: Viewer): Prisma.BatchWhereInput {
  return isSuperUser(viewer.email) ? {} : { userId: viewer.id }
}

export async function canReadBatch(viewer: Viewer, batchId: string): Promise<boolean> {
  const count = await prisma.batch.count({ where: { AND: [{ id: batchId }, readableBatchWhere(viewer)] } })
  return count > 0
}

// The GSC page/query caches and the sitemap analysis are a single global
// dataset for YOUR_BRAND_DOMAIN until they move onto Project (Step 6), so only
// people who can already see that brand's data get them.
export async function canViewSiteHealth(viewer: Viewer): Promise<boolean> {
  if (isSuperUser(viewer.email)) return true
  const count = await prisma.batch.count({
    where: { AND: [{ project: { primaryDomain: YOUR_BRAND_DOMAIN } }, readableBatchWhere(viewer)] },
  })
  return count > 0
}
