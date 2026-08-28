import { prisma } from './prisma'
import type { SessionOption } from '@/components/run-session-picker'

// Shared by the dashboard and every segment detail page (category/market/care-level/
// community) to populate the "run snapshot" picker, optionally scoped to one project
// (batch) so a run session with no results in that project doesn't show up as an option.
export async function getSessionList(projectId?: string): Promise<SessionOption[]> {
  const sessions = await prisma.runSession.findMany({
    where: {
      status: 'done',
      results: projectId ? { some: { prompt: { batchId: projectId } } } : { some: {} },
    },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      startedAt: true,
      triggeredBy: true,
      _count: { select: { results: { where: projectId ? { prompt: { batchId: projectId } } : {} } } },
    },
  })
  return sessions.map((s) => ({
    id: s.id,
    startedAt: s.startedAt.toISOString(),
    triggeredBy: s.triggeredBy,
    resultCount: s._count.results,
  }))
}
