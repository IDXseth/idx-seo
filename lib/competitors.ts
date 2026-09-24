import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export interface CompetitorInput {
  id: string
  brandName: string
  domain: string
  aliases: string  // comma-separated alternate names
}

// Competitors tracked for a project; for data outside any project (from
// before projects existed), the owning user's own unassigned competitors.
export function competitorScope(projectId: string | null | undefined, userId: string): Prisma.CompetitorWhereInput {
  return projectId ? { projectId } : { userId, projectId: null }
}

export async function getActiveCompetitors(scope: Prisma.CompetitorWhereInput): Promise<CompetitorInput[]> {
  try {
    return await prisma.competitor.findMany({
      where: { ...scope, active: true },
      select: { id: true, brandName: true, domain: true, aliases: true },
      orderBy: { createdAt: 'asc' },
    })
  } catch {
    // DB unreachable — never let this break a prompt run.
    return []
  }
}
