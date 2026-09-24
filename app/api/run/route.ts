import { prisma } from '@/lib/prisma'
import { sendRunCompleteEmail } from '@/lib/email'
import { getViewer, writableBatchWhere } from '@/lib/access'
import { runPromptOnPlatforms } from '@/lib/run-prompt'

export const maxDuration = 300

const PLATFORM_TIMEOUT_MS = 28_000

// Returns unrun prompts for a batch (or all of the viewer's runnable batches). Used by the client loop.
export async function GET(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batchId') ?? undefined

  const prompts = await prisma.prompt.findMany({
    where: { ...(batchId ? { batchId } : {}), batch: writableBatchWhere(viewer), results: { none: {} } },
    select: {
      id: true,
      promptText: true,
      communityName: true,
      batch: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json(prompts)
}

export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const batchId = body.batchId as string | undefined
  const notifyEmail = body.email as string | undefined

  const prompts = await prisma.prompt.findMany({
    where: {
      ...(batchId ? { batchId } : {}),
      batch: writableBatchWhere(viewer),
      results: { none: {} },
    },
    include: { batch: { select: { name: true, userId: true, projectId: true } } },
  })

  if (prompts.length === 0) {
    return Response.json({ success: true, processed: 0, message: 'No unrun prompts found' })
  }

  const batchName = prompts[0]?.batch?.name

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let processed = 0
      let errors = 0
      let mentionedCount = 0
      let citedCount = 0
      let totalResults = 0
      const total = prompts.length

      send({ type: 'start', total })

      for (const prompt of prompts) {
        const platformResults = await runPromptOnPlatforms(prompt, { timeoutMs: PLATFORM_TIMEOUT_MS })

        for (const { result } of platformResults) {
          if (result.error) errors++
          if (result.isMentioned) mentionedCount++
          if (result.isCited) citedCount++
          totalResults++
        }

        processed++
        send({
          type: 'progress',
          processed,
          total,
          prompt: prompt.promptText.slice(0, 80),
          community: prompt.communityName,
          platformResults: platformResults.map(({ platform, result }) => ({
            platform,
            isMentioned: result.isMentioned,
            isCited: result.isCited,
            error: result.error ?? null,
          })),
        })

        // Brief pause between prompts to respect API rate limits
        if (processed < total) {
          await new Promise((r) => setTimeout(r, 500))
        }
      }

      send({ type: 'done', processed, errors })
      controller.close()

      // Send email notification after stream closes
      if (notifyEmail) {
        try {
          await sendRunCompleteEmail({
            to: notifyEmail,
            batchName,
            processed,
            errors,
            mentionedCount,
            citedCount,
            totalResults,
          })
        } catch (err) {
          console.error('Failed to send completion email:', err)
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
