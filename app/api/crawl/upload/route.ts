import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/lib/inngest'
import { parseScreamingFrogExport } from '@/lib/screaming-frog'

export async function POST(req: Request) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const batchName = (formData.get('batchName') as string) || 'Unnamed Crawl'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const rows = parseScreamingFrogExport(buffer)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No pages found in file. Export "Internal:All" from Screaming Frog and upload the CSV or XLSX.' }, { status: 400 })
    }

    const crawlBatch = await prisma.crawlBatch.create({
      data: {
        name: batchName,
        fileName: file.name,
        userId,
        totalPages: rows.length,
      },
    })

    await prisma.crawlPage.createMany({
      data: rows.map((r) => ({
        crawlBatchId: crawlBatch.id,
        url: r.url,
        statusCode: r.statusCode,
        indexability: r.indexability,
        indexabilityStatus: r.indexabilityStatus,
        title: r.title,
        titleLength: r.titleLength,
        metaDescription: r.metaDescription,
        metaDescriptionLength: r.metaDescriptionLength,
        h1: r.h1,
        wordCount: r.wordCount,
        canonicalUrl: r.canonicalUrl,
        inlinks: r.inlinks,
      })),
      skipDuplicates: true,
    })

    await inngest.send({ name: 'crawl/uploaded', data: { crawlBatchId: crawlBatch.id } })

    return NextResponse.json({ crawlBatchId: crawlBatch.id, pagesImported: rows.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
