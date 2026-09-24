import { prisma } from '@/lib/prisma'
import { getViewer, canWrite } from '@/lib/access'
import { runPromptOnPlatforms } from '@/lib/run-prompt'

// Per-prompt timeout: all platforms run in parallel so ~30s is sufficient.
export const maxDuration = 60

export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { promptId } = await req.json()
  if (!promptId) return Response.json({ error: 'promptId required' }, { status: 400 })

  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: { batch: { select: { userId: true, projectId: true } } },
  })
  if (!prompt || !canWrite(viewer.id, viewer.email, prompt.batch.userId)) {
    return Response.json({ error: 'Prompt not found' }, { status: 404 })
  }

  // Idempotent — skip if already run
  const existing = await prisma.result.findFirst({ where: { promptId } })
  if (existing) return Response.json({ skipped: true })

  const platformResults = await runPromptOnPlatforms(prompt)

  return Response.json({
    platformResults: platformResults.map(({ platform, result }) => ({
      platform,
      isMentioned: result.isMentioned,
      isCited: result.isCited,
      error: result.error ?? null,
    })),
  })
}
