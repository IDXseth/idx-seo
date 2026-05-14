import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/prisma'
import { queryPlatform } from '@/lib/ai-clients'
import { PLATFORMS } from '@/lib/utils'
import { sendRunCompleteEmail } from '@/lib/email'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeNextRunAt(schedule: {
  frequency: string
  customDays?: number | null
  dayOfWeek?: number | null
  dayOfMonth?: number | null
  hour: number
}): Date {
  const now = new Date()
  const next = new Date(now)

  switch (schedule.frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break
    case 'weekly': {
      const target = schedule.dayOfWeek ?? 1
      let diff = target - now.getDay()
      if (diff <= 0) diff += 7
      next.setDate(next.getDate() + diff)
      break
    }
    case 'monthly': {
      const dom = schedule.dayOfMonth ?? 1
      next.setMonth(next.getMonth() + 1)
      next.setDate(dom)
      break
    }
    case 'custom':
    default:
      next.setDate(next.getDate() + (schedule.customDays ?? 7))
  }

  next.setHours(schedule.hour, 0, 0, 0)
  return next
}

// ─── Fan-out: one event per prompt ───────────────────────────────────────────

export const batchFanOut = inngest.createFunction(
  { id: 'batch-fan-out', triggers: [{ event: 'batch/run.requested' }] },
  async ({ event, step }) => {
    const { batchId, batchRunId, runSessionId, isRerun } = event.data as {
      batchId?: string
      batchRunId: string
      runSessionId: string
      isRerun?: boolean
      notifyEmail?: string
    }

    const prompts = await step.run('fetch-prompts', async () => {
      return prisma.prompt.findMany({
        where: {
          ...(batchId ? { batchId } : {}),
          // For re-runs include all; for first runs only unrun ones
          ...(isRerun ? {} : { results: { none: {} } }),
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
    })

    if (prompts.length === 0) {
      await step.run('mark-done-empty', async () => {
        await prisma.$executeRaw`UPDATE "BatchRun" SET "status" = 'done', "finishedAt" = NOW() WHERE id = ${batchRunId}`
        await prisma.$executeRaw`UPDATE "RunSession" SET "status" = 'done', "finishedAt" = NOW() WHERE id = ${runSessionId}`
      })
      return { queued: 0 }
    }

    // Update totalPrompts to actual count (may differ from initial estimate for re-runs)
    await step.run('sync-total', async () => {
      await prisma.$executeRaw`UPDATE "BatchRun" SET "totalPrompts" = ${prompts.length} WHERE id = ${batchRunId}`
    })

    await step.sendEvent(
      'fan-out-prompts',
      prompts.map((p) => ({
        name: 'prompt/run.requested' as const,
        data: { promptId: p.id, batchRunId, runSessionId },
      }))
    )

    return { queued: prompts.length }
  }
)

// ─── Per-prompt runner (max 5 concurrent) ────────────────────────────────────

export const runSinglePrompt = inngest.createFunction(
  {
    id: 'run-single-prompt',
    triggers: [{ event: 'prompt/run.requested' }],
    concurrency: { limit: 5 },
  },
  async ({ event, step }) => {
    const { promptId, batchRunId, runSessionId } = event.data as {
      promptId: string
      batchRunId: string
      runSessionId: string
    }

    const prompt = await step.run('fetch-prompt', async () => {
      return prisma.prompt.findUnique({ where: { id: promptId } })
    })

    if (!prompt) {
      await step.run('fail-missing', async () => {
        await prisma.$executeRaw`UPDATE "BatchRun" SET "failCount" = "failCount" + 1 WHERE id = ${batchRunId}`
        await checkAndFinalize(batchRunId, runSessionId)
      })
      return
    }

    // Skip if already run in THIS session (idempotent per session)
    const existing = await step.run('check-existing', async () => {
      return prisma.result.findFirst({ where: { promptId, runSessionId } })
    })

    if (existing) {
      await step.run('skip-already-run', async () => {
        await prisma.$executeRaw`UPDATE "BatchRun" SET "doneCount" = "doneCount" + 1 WHERE id = ${batchRunId}`
        await checkAndFinalize(batchRunId, runSessionId)
      })
      return
    }

    await step.run('mark-running', async () => {
      await prisma.$executeRaw`UPDATE "Prompt" SET "jobStatus" = 'running' WHERE id = ${promptId}`
    })

    await step.run('query-and-save', async () => {
      const platformResults = await Promise.all(
        PLATFORMS.map(async (platform) => {
          const result = await queryPlatform(platform, prompt.promptText, prompt.communityName)
          return { platform, result }
        })
      )

      for (const { platform, result } of platformResults) {
        const saved = await prisma.result.create({
          data: {
            promptId,
            runSessionId,
            platform,
            responseText: result.responseText,
            isMentioned: result.isMentioned,
            isCited: result.isCited,
            sentiment: result.sentiment,
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

      await prisma.$executeRaw`UPDATE "Prompt" SET "jobStatus" = 'done' WHERE id = ${promptId}`
      await prisma.$executeRaw`UPDATE "BatchRun" SET "doneCount" = "doneCount" + 1 WHERE id = ${batchRunId}`
      await checkAndFinalize(batchRunId, runSessionId)
    })
  }
)

// ─── Hourly schedule checker ──────────────────────────────────────────────────

export const checkSchedules = inngest.createFunction(
  { id: 'check-schedules', triggers: [{ cron: '0 * * * *' }] },
  async ({ step }) => {
    const due = await step.run('find-due-schedules', async () => {
      return prisma.schedule.findMany({
        where: { enabled: true, nextRunAt: { lte: new Date() } },
        include: { batch: { select: { userId: true } } },
      })
    })

    for (const schedule of due) {
      await step.sendEvent(`fire-schedule-${schedule.id}`, {
        name: 'batch/run.requested',
        data: {
          batchId: schedule.batchId,
          triggeredBy: 'scheduled',
          scheduleId: schedule.id,
          isRerun: true,
        },
      })

      // Create RunSession and BatchRun for this scheduled run
      await step.run(`init-session-${schedule.id}`, async () => {
        const totalPrompts = await prisma.prompt.count({ where: { batchId: schedule.batchId } })
        const runSession = await prisma.runSession.create({
          data: {
            batchId: schedule.batchId,
            triggeredBy: 'scheduled',
            scheduleId: schedule.id,
            status: 'running',
          },
        })
        await prisma.batchRun.create({
          data: {
            batchId: schedule.batchId,
            runSessionId: runSession.id,
            totalPrompts,
            status: 'running',
            notifyEmail: null,
          },
        })
        const nextRunAt = computeNextRunAt(schedule)
        await prisma.schedule.update({
          where: { id: schedule.id },
          data: { lastRunAt: new Date(), nextRunAt },
        })
      })
    }

    return { fired: due.length }
  }
)

// ─── Finalize when all prompts done ──────────────────────────────────────────

async function checkAndFinalize(batchRunId: string, runSessionId: string) {
  const run = await prisma.batchRun.findUnique({ where: { id: batchRunId } })
  if (!run || run.status === 'done') return

  if (run.doneCount + run.failCount >= run.totalPrompts) {
    await prisma.$executeRaw`UPDATE "BatchRun" SET "status" = 'done', "finishedAt" = NOW() WHERE id = ${batchRunId}`
    await prisma.$executeRaw`UPDATE "RunSession" SET "status" = 'done', "finishedAt" = NOW() WHERE id = ${runSessionId}`

    if (run.notifyEmail) {
      const batchFilter = run.batchId ? { batchId: run.batchId } : {}
      const results = await prisma.result.findMany({
        where: { runSessionId, prompt: batchFilter },
      })
      const batchName = run.batchId
        ? (await prisma.batch.findUnique({ where: { id: run.batchId }, select: { name: true } }))?.name
        : undefined

      await sendRunCompleteEmail({
        to: run.notifyEmail,
        batchName,
        processed: run.doneCount,
        errors: run.failCount,
        mentionedCount: results.filter((r) => r.isMentioned).length,
        citedCount: results.filter((r) => r.isCited).length,
        totalResults: results.length,
      })
    }
  }
}
