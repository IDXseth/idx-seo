import { prisma } from './prisma'
import { promptScope } from './projects'
import type { SessionOption } from '@/components/run-session-picker'

// Shared by the dashboard and every segment detail page (category/market/care-level/
// community) to populate the "run snapshot" picker, optionally scoped to one project
// (batch) so a run session with no results in that project doesn't show up as an option.
export async function getSessionList(projectId?: string): Promise<SessionOption[]> {
  const scope = await promptScope()
  const promptWhere = projectId ? { ...scope, batchId: projectId } : scope
  const sessions = await prisma.runSession.findMany({
    where: {
      status: 'done',
      results: { some: { prompt: promptWhere } },
    },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      startedAt: true,
      triggeredBy: true,
      _count: { select: { results: { where: { prompt: promptWhere } } } },
    },
  })
  return sessions.map((s) => ({
    id: s.id,
    startedAt: s.startedAt.toISOString(),
    triggeredBy: s.triggeredBy,
    resultCount: s._count.results,
  }))
}
