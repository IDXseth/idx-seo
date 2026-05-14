import { prisma } from '@/lib/prisma'
import { queryPlatform, PlatformResult } from '@/lib/ai-clients'
import { PLATFORMS } from '@/lib/utils'
import { sendRunCompleteEmail } from '@/lib/email'

export const maxDuration = 300

const PLATFORM_TIMEOUT_MS = 28_000

function withTimeout(promise: Promise<PlatformResult>): Promise<PlatformResult> {
  return Promise.race([
    promise,
    new Promise<PlatformResult>((resolve) =>
      setTimeout(
        () => resolve({ responseText: '[Timeout]', isMentioned: false, isCited: false, citations: [], sentiment: 'neutral', error: 'Platform timed out' }),
        PLATFORM_TIMEOUT_MS
      )
    ),
  ])
}

// Returns unrun prompts for a batch (or all batches). Used by the client loop.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const batchId = searchParams.get('batchId') ?? undefined

  const prompts = await prisma.prompt.findMany({
    where: { ...(batchId ? { batchId } : {}), results: { none: {} } },
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
  const body = await req.json().catch(() => ({}))
  const batchId = body.batchId as string | undefined
  const notifyEmail = body.email as string | undefined

  const prompts = await prisma.prompt.findMany({
    where: {
      ...(batchId ? { batchId } : {}),
      results: { none: {} },
    },
    include: { batch: { select: { name: true } } },
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
        const platformResults = await Promise.all(
          PLATFORMS.map(async (platform) => {
            const result = await withTimeout(queryPlatform(platform, prompt.promptText, prompt.communityName))
            return { platform, result }
          })
        )

        for (const { platform, result } of platformResults) {
          const saved = await prisma.result.create({
            data: {
              promptId: prompt.id,
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
