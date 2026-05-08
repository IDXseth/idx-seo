import { prisma } from '@/lib/prisma'
import { queryPlatform } from '@/lib/ai-clients'
import { PLATFORMS } from '@/lib/utils'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const batchId = body.batchId as string | undefined

  const prompts = await prisma.prompt.findMany({
    where: {
      ...(batchId ? { batchId } : {}),
      results: { none: {} },
    },
  })

  if (prompts.length === 0) {
    return Response.json({ success: true, processed: 0, message: 'No unrun prompts found' })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let processed = 0
      let errors = 0
      const total = prompts.length

      send({ type: 'start', total })

      for (const prompt of prompts) {
        // Run all 6 platforms concurrently for this prompt
        const platformResults = await Promise.all(
          PLATFORMS.map(async (platform) => {
            const result = await queryPlatform(platform, prompt.promptText, prompt.communityName)
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
      }

      send({ type: 'done', processed, errors })
      controller.close()
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
