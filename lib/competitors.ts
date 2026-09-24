import { prisma } from './prisma'

export interface CompetitorInput {
  id: string
  brandName: string
  domain: string
  aliases: string  // comma-separated alternate names
}

export async function getActiveCompetitors(userId: string): Promise<CompetitorInput[]> {
  try {
    return await prisma.competitor.findMany({
      where: { userId, active: true },
      select: { id: true, brandName: true, domain: true, aliases: true },
    })
  } catch {
    // DB unreachable — never let this break a prompt run.
    return []
  }
}
