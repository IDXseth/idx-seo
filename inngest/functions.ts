import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/prisma'
import { queryPlatform } from '@/lib/ai-clients'
import { PLATFORMS } from '@/lib/utils'
import { sendRunCompleteEmail } from '@/lib/email'

// Fan-out: one event per prompt
export const batchFanOut = inngest.createFunction(
  { id: 'batch-fan-out' },
  { event: 'batch/run.requested' },
  async ({ event, step }) => {
    const { batchId, batchRunId } = event.data as { batchId?: string; batchRunId: string }

    const prompts = await step.run('fetch-unrun-prompts', async () => {
      return prisma.prompt.findMany({
        where: {
          ...(batchId ? { batchId } : {}),
          results: { none: {} },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
    })

    if (prompts.length === 0) {
      await step.run('mark-done-empty', async () => {
        await prisma.batchRun.update({
          where: { id: batchRunId },
          data: { status: 'done', finishedAt: new Date() },
        })
      })
      return { queued: 0 }
    }

    await step.sendEvent(
      'fan-out-prompts',
      prompts.map((p) => ({
        name: 'prompt/run.requested' as const,
        data: { promptId: p.id, batchRunId },
      }))
    )

    return { queued: prompts.length }
  }
)

// Per-prompt runner with 5-concurrent cap
export const runSinglePrompt = inngest.createFunction(
  {
    id: 'run-single-prompt',
    concurrency: { limit: 5 },
  },
  { event: 'prompt/run.requested' },
  async ({ event, step }) => {
    const { promptId, batchRunId } = event.data as { promptId: string; batchRunId: string }

    const prompt = await step.run('fetch-prompt', async () => {
      return prisma.prompt.findUnique({ where: { id: promptId } })
    })

    if (!prompt) {
      await step.run('increment-fail-no-prompt', async () => {
        await prisma.$executeRaw`UPDATE "Prompt" SET "jobStatus" = 'failed' WHERE id = ${promptId}`
        await prisma.$executeRaw`UPDATE "BatchRun" SET "failCount" = "failCount" + 1 WHERE id = ${batchRunId}`
        await checkAndFinalize(batchRunId)
      })
      return
    }

    // Skip if already run (idempotent)
    const existing = await step.run('check-existing', async () => {
      return prisma.result.findFirst({ where: { promptId } })
    })

    if (existing) {
      await step.run('increment-done-skipped', async () => {
        await prisma.$executeRaw`UPDATE "BatchRun" SET "doneCount" = "doneCount" + 1 WHERE id = ${batchRunId}`
        await checkAndFinalize(batchRunId)
      })
      return
    }

    await step.run('mark-running', async () => {
      await prisma.$executeRaw`UPDATE "Prompt" SET "jobStatus" = 'running' WHERE id = ${promptId}`
    })

    const platformResults = await step.run('query-platforms', async () => {
      const results = await Promise.all(
        PLATFORMS.map(async (platform) => {
          const result = await queryPlatform(platform, prompt.promptText, prompt.communityName)
          return { platform, result }
        })
      )

      for (const { platform, result } of results) {
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
            })),
          })
        }
      }

      return results.map(({ platform, result }) => ({
        platform,
        isMentioned: result.isMentioned,
        isCited: result.isCited,
        error: result.error ?? null,
      }))
    })

    await step.run('mark-done-increment', async () => {
      await prisma.$executeRaw`UPDATE "Prompt" SET "jobStatus" = 'done' WHERE id = ${promptId}`
      await prisma.$executeRaw`UPDATE "BatchRun" SET "doneCount" = "doneCount" + 1 WHERE id = ${batchRunId}`
      await checkAndFinalize(batchRunId)
    })
  }
)

async function checkAndFinalize(batchRunId: string) {
  const run = await prisma.batchRun.findUnique({ where: { id: batchRunId } })
  if (!run || run.status === 'done') return

  if (run.doneCount + run.failCount >= run.totalPrompts) {
    await prisma.batchRun.update({
      where: { id: batchRunId },
      data: { status: 'done', finishedAt: new Date() },
    })

    if (run.notifyEmail) {
      const promptWhere = run.batchId ? { batchId: run.batchId, results: { some: {} } } : { results: { some: {} } }
      const results = await prisma.result.findMany({
        where: { prompt: promptWhere },
      })

      const totalResults = results.length
      const mentionedCount = results.filter((r) => r.isMentioned).length
      const citedCount = results.filter((r) => r.isCited).length

      const batchName = run.batchId
        ? (await prisma.batch.findUnique({ where: { id: run.batchId }, select: { name: true } }))?.name
        : undefined

      await sendRunCompleteEmail({
        to: run.notifyEmail,
        batchName,
        processed: run.doneCount,
        errors: run.failCount,
        mentionedCount,
        citedCount,
        totalResults,
      })
    }
  }
}
