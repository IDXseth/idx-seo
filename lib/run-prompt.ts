import { prisma } from './prisma'
import { queryPlatform, type PlatformResult } from './ai-clients'
import { getDetectionContext, type PromptForDetection } from './detection-context'
import { PLATFORMS } from './utils'

export interface PromptToRun extends PromptForDetection {
  id: string
  promptText: string
  city: string
}

// Queries every platform for one prompt, scores each response for the
// project's brand and competitors, and saves the Result, its Citations and one
// CompetitorMention per tracked competitor. Shared by every way a prompt runs
// (Inngest jobs and the direct /api/run routes) so they can't drift apart.
//
// With a runSessionId, platforms that already have a Result in that session
// are skipped, so a retried background job resumes instead of re-querying
// every platform and saving duplicates.
export async function runPromptOnPlatforms(
  prompt: PromptToRun,
  options: { runSessionId?: string; timeoutMs?: number } = {}
): Promise<Array<{ platform: string; result: PlatformResult }>> {
  const saved = options.runSessionId
    ? new Set(
        (await prisma.result.findMany({
          where: { promptId: prompt.id, runSessionId: options.runSessionId },
          select: { platform: true },
        })).map((r) => r.platform)
      )
    : new Set<string>()
  const pending = PLATFORMS.filter((p) => !saved.has(p))
  if (pending.length === 0) return []

  const ctx = await getDetectionContext(prompt)
  const platformResults = await Promise.all(
    pending.map(async (platform) => ({
      platform,
      result: await queryPlatform(platform, prompt.promptText, ctx, {
        city: prompt.city || undefined,
        timeoutMs: options.timeoutMs,
      }),
    }))
  )

  for (const { platform, result } of platformResults) {
    const row = await prisma.result.create({
      data: {
        promptId: prompt.id,
        runSessionId: options.runSessionId ?? null,
        platform,
        responseText: result.responseText,
        isMentioned: result.isMentioned,
        isCited: result.isCited,
        sentiment: result.sentiment,
        brandPosition: result.brandPosition,
      },
    })
    if (result.citations.length > 0) {
      await prisma.citation.createMany({
        data: result.citations.map((c) => ({
          resultId: row.id,
          url: c.url,
          title: c.title,
          domain: c.domain,
          isExplicitCitation: c.isExplicitCitation,
        })),
      })
    }
    if (result.competitors.length > 0) {
      await prisma.competitorMention.createMany({
        data: result.competitors.map((m) => ({
          resultId: row.id,
          competitorId: m.competitorId,
          isMentioned: m.isMentioned,
          isCited: m.isCited,
          sentiment: m.sentiment,
          position: m.position,
        })),
      })
    }
  }

  return platformResults
}
