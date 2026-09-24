import { prisma } from '@/lib/prisma'
import { queryPlatform } from '@/lib/ai-clients'
import { PLATFORMS } from '@/lib/utils'
import { getViewer, canWrite } from '@/lib/access'
import { getActiveCompetitors, matchCompetitors, saveCompetitorMentions } from '@/lib/competitors'

// Per-prompt timeout: all platforms run in parallel so ~30s is sufficient.
export const maxDuration = 60

export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { promptId } = await req.json()
  if (!promptId) return Response.json({ error: 'promptId required' }, { status: 400 })

  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: { batch: { select: { userId: true } } },
  })
  if (!prompt || !canWrite(viewer.id, viewer.email, prompt.batch.userId)) {
    return Response.json({ error: 'Prompt not found' }, { status: 404 })
  }

  // Idempotent — skip if already run
  const existing = await prisma.result.findFirst({ where: { promptId } })
  if (existing) return Response.json({ skipped: true })

  const [platformResults, competitors] = await Promise.all([
    Promise.all(
      PLATFORMS.map(async (platform) => {
        const result = await queryPlatform(platform, prompt.promptText, prompt.communityName)
        return { platform, result }
      })
    ),
    getActiveCompetitors(prompt.batch.userId),
  ])

  for (const { platform, result } of platformResults) {
    const saved = await prisma.result.create({
      data: {
        promptId,
        platform,
        responseText: result.responseText,
        isMentioned: result.isMentioned,
        isCited: result.isCited,
      },
    })
    if (result.citations.length > 0) {
      await prisma.citation.createMany({
        data: result.citations.map((c) => ({
          resultId: saved.id,
          url: c.url,
          title: c.title,
          domain: c.domain,
          isExplicitCitation: c.isExplicitCitation,
        })),
      })
    }
    if (competitors.length > 0) {
      const matches = await matchCompetitors(result.responseText, result.citations, competitors)
      await saveCompetitorMentions(saved.id, matches)
    }
  }

  return Response.json({
    platformResults: platformResults.map(({ platform, result }) => ({
      platform,
      isMentioned: result.isMentioned,
      isCited: result.isCited,
      error: result.error ?? null,
    })),
  })
}
